Imports System.ComponentModel.DataAnnotations
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class RegisterRequest
        <Required, EmailAddress, MaxLength(190)> Public Property Email As String = ""
        <Required, MinLength(8), MaxLength(100)> Public Property Password As String = ""
        <Required, MaxLength(120)> Public Property FullName As String = ""
        <MaxLength(20)> Public Property Phone As String
        <Required> Public Property Role As String = ""
    End Class

    Public Class LoginRequest
        <Required> Public Property Email As String = ""
        <Required> Public Property Password As String = ""
    End Class

    Public Class RefreshRequest
        <Required> Public Property RefreshToken As String = ""
    End Class

    Public Class UpdateProfileRequest
        <Required, MaxLength(120)> Public Property FullName As String = ""
        <MaxLength(20)> Public Property Phone As String
    End Class

    Public Class ChangePasswordRequest
        <Required> Public Property CurrentPassword As String = ""
        <Required, MinLength(8), MaxLength(100)> Public Property NewPassword As String = ""
    End Class

    Public Class UserDto
        Public Property Id As Long
        Public Property Email As String
        Public Property FullName As String
        Public Property Phone As String
        Public Property AvatarUrl As String
        Public Property IsActive As Boolean
        Public Property Roles As IReadOnlyList(Of String)
        Public Property CreatedAt As DateTime

        Public Shared Function FromUser(u As User) As UserDto
            Return New UserDto With {
                .Id = u.Id,
                .Email = u.Email,
                .FullName = u.FullName,
                .Phone = u.Phone,
                .AvatarUrl = u.AvatarUrl,
                .IsActive = u.IsActive,
                .Roles = Keyzo.Domain.Roles.EffectiveRoles(u.Email, u.UserRoles.Select(Function(ur) ur.Role.Name)).OrderBy(Function(n) n).ToList(),
                .CreatedAt = u.CreatedAt
            }
        End Function
    End Class

    Public Class AuthResponse
        Public Property AccessToken As String
        Public Property AccessExpiresAt As DateTime
        Public Property RefreshToken As String
        Public Property User As UserDto
    End Class

    Public Interface IAuthService
        Function RegisterAsync(request As RegisterRequest, Optional ct As CancellationToken = Nothing) As Task(Of AuthResponse)
        Function LoginAsync(request As LoginRequest, Optional ct As CancellationToken = Nothing) As Task(Of AuthResponse)
        Function RefreshAsync(refreshToken As String, Optional ct As CancellationToken = Nothing) As Task(Of AuthResponse)
        Function LogoutAsync(refreshToken As String, Optional ct As CancellationToken = Nothing) As Task
        Function MeAsync(Optional ct As CancellationToken = Nothing) As Task(Of UserDto)
        Function UpdateProfileAsync(request As UpdateProfileRequest, Optional ct As CancellationToken = Nothing) As Task(Of UserDto)
        Function ChangePasswordAsync(request As ChangePasswordRequest, Optional ct As CancellationToken = Nothing) As Task
    End Interface

    Public NotInheritable Class AuthService
        Implements IAuthService

        ' Only these roles may self-register; Manager / MaintenanceStaff accounts are created by an admin or owner.
        ' SuperAdmin is never self-selected: it is granted automatically, and only, to the fixed Roles.AdminEmails.
        Private Shared ReadOnly SelfRegisterRoles As String() = {Roles.Owner, Roles.Tenant, Roles.Manager, Roles.MaintenanceStaff}

        Private ReadOnly db As IAppDbContext
        Private ReadOnly hasher As IPasswordHasher
        Private ReadOnly tokens As ITokenService
        Private ReadOnly current As ICurrentUser
        Private ReadOnly audit As IAuditService

        Public Sub New(db As IAppDbContext, hasher As IPasswordHasher, tokens As ITokenService, current As ICurrentUser, audit As IAuditService)
            Me.db = db
            Me.hasher = hasher
            Me.tokens = tokens
            Me.current = current
            Me.audit = audit
        End Sub

        Public Async Function RegisterAsync(request As RegisterRequest, Optional ct As CancellationToken = Nothing) As Task(Of AuthResponse) Implements IAuthService.RegisterAsync
            Dim email = request.Email.Trim().ToLowerInvariant()
            Dim isAdmin = Roles.IsAdminEmail(email)
            If Not isAdmin AndAlso Not SelfRegisterRoles.Contains(request.Role) Then
                Throw New BusinessRuleException("You can register as an Owner, Tenant, Manager or Maintenance Staff.")
            End If
            Dim assignedRole = If(isAdmin, Roles.SuperAdmin, request.Role)
            If Await db.Users.AnyAsync(Function(x) x.Email = email, ct) Then
                Throw New ConflictException("An account with this email already exists.")
            End If

            Dim created As New User With {
                .Email = email,
                .FullName = request.FullName.Trim(),
                .Phone = request.Phone?.Trim(),
                .PasswordHash = hasher.Hash(request.Password)
            }
            created.UserRoles.Add(New UserRole With {.RoleId = Roles.IdOf(assignedRole)})
            If assignedRole = Roles.Tenant Then created.TenantProfile = New TenantProfile()

            db.Users.Add(created)
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("register", "user", created.Id, New With {.role = assignedRole}, created.Id, ct)

            Dim loaded = Await LoadUserAsync(created.Id, ct)
            Return Await IssueAsync(loaded, ct)
        End Function

        Public Async Function LoginAsync(request As LoginRequest, Optional ct As CancellationToken = Nothing) As Task(Of AuthResponse) Implements IAuthService.LoginAsync
            Dim email = request.Email.Trim().ToLowerInvariant()
            Dim found = Await db.Users.Include("UserRoles.Role").FirstOrDefaultAsync(Function(x) x.Email = email, ct)

            If found Is Nothing OrElse Not hasher.Verify(request.Password, found.PasswordHash) Then
                Throw New UnauthorizedAppException("Incorrect email or password.")
            End If
            If Not found.IsActive Then
                Throw New ForbiddenException("This account has been deactivated. Please contact the administrator.")
            End If

            found.LastLoginAt = DateTime.UtcNow
            SyncAdminRole(found)
            Await db.SaveChangesAsync(ct)
            Return Await IssueAsync(found, ct)
        End Function

        Public Async Function RefreshAsync(refreshToken As String, Optional ct As CancellationToken = Nothing) As Task(Of AuthResponse) Implements IAuthService.RefreshAsync
            Dim hash = tokens.HashRefreshToken(refreshToken)
            Dim stored = Await db.RefreshTokens.FirstOrDefaultAsync(Function(t) t.TokenHash = hash, ct)
            If stored Is Nothing OrElse stored.RevokedAt.HasValue OrElse stored.ExpiresAt < DateTime.UtcNow Then
                Throw New UnauthorizedAppException("Session expired. Please sign in again.")
            End If

            Dim loaded = Await LoadUserAsync(stored.UserId, ct)
            If Not loaded.IsActive Then Throw New ForbiddenException("This account has been deactivated.")

            stored.RevokedAt = DateTime.UtcNow   ' rotate
            Return Await IssueAsync(loaded, ct)
        End Function

        Public Async Function LogoutAsync(refreshToken As String, Optional ct As CancellationToken = Nothing) As Task Implements IAuthService.LogoutAsync
            Dim hash = tokens.HashRefreshToken(refreshToken)
            Dim stored = Await db.RefreshTokens.FirstOrDefaultAsync(Function(t) t.TokenHash = hash AndAlso Not t.RevokedAt.HasValue, ct)
            If stored Is Nothing Then Return
            stored.RevokedAt = DateTime.UtcNow
            Await db.SaveChangesAsync(ct)
        End Function

        Public Async Function MeAsync(Optional ct As CancellationToken = Nothing) As Task(Of UserDto) Implements IAuthService.MeAsync
            Return UserDto.FromUser(Await LoadUserAsync(current.RequiredId(), ct))
        End Function

        Public Async Function UpdateProfileAsync(request As UpdateProfileRequest, Optional ct As CancellationToken = Nothing) As Task(Of UserDto) Implements IAuthService.UpdateProfileAsync
            Dim loaded = Await LoadUserAsync(current.RequiredId(), ct)
            loaded.FullName = request.FullName.Trim()
            loaded.Phone = request.Phone?.Trim()
            loaded.UpdatedAt = DateTime.UtcNow
            Await db.SaveChangesAsync(ct)
            Return UserDto.FromUser(loaded)
        End Function

        Public Async Function ChangePasswordAsync(request As ChangePasswordRequest, Optional ct As CancellationToken = Nothing) As Task Implements IAuthService.ChangePasswordAsync
            Dim loaded = Await LoadUserAsync(current.RequiredId(), ct)
            If Not hasher.Verify(request.CurrentPassword, loaded.PasswordHash) Then
                Throw New BusinessRuleException("Your current password is incorrect.")
            End If
            loaded.PasswordHash = hasher.Hash(request.NewPassword)
            loaded.UpdatedAt = DateTime.UtcNow
            ' sign out other sessions
            Dim userId = loaded.Id
            For Each token In Await db.RefreshTokens.Where(Function(t) t.UserId = userId AndAlso Not t.RevokedAt.HasValue).ToListAsync(ct)
                token.RevokedAt = DateTime.UtcNow
            Next
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("change_password", "user", loaded.Id, Nothing, loaded.Id, ct)
        End Function

        Private Async Function LoadUserAsync(id As Long, ct As CancellationToken) As Task(Of User)
            Dim found = Await db.Users.Include("UserRoles.Role").FirstOrDefaultAsync(Function(x) x.Id = id, ct)
            If found Is Nothing Then Throw New NotFoundException("User not found.")
            Return found
        End Function

        ''' <summary>Keeps the stored SuperAdmin row in step with the fixed admin list (the claims already ignore it).</summary>
        Private Sub SyncAdminRole(account As User)
            Dim stored = account.UserRoles.FirstOrDefault(Function(ur) ur.RoleId = Roles.IdOf_SuperAdmin)
            If Roles.IsAdminEmail(account.Email) Then
                If stored Is Nothing Then account.UserRoles.Add(New UserRole With {.RoleId = Roles.IdOf_SuperAdmin})
            ElseIf stored IsNot Nothing Then
                account.UserRoles.Remove(stored)
                db.UserRoles.Remove(stored)
            End If
        End Sub

        Private Async Function IssueAsync(account As User, ct As CancellationToken) As Task(Of AuthResponse)
            Dim roleNames = Roles.EffectiveRoles(account.Email, account.UserRoles.Select(Function(ur) ur.Role.Name))
            Dim pair = tokens.Create(account, roleNames)
            db.RefreshTokens.Add(New RefreshToken With {
                .UserId = account.Id,
                .TokenHash = tokens.HashRefreshToken(pair.RefreshToken),
                .ExpiresAt = pair.RefreshExpiresAt
            })
            Await db.SaveChangesAsync(ct)
            Return New AuthResponse With {
                .AccessToken = pair.AccessToken,
                .AccessExpiresAt = pair.AccessExpiresAt,
                .RefreshToken = pair.RefreshToken,
                .User = UserDto.FromUser(account)
            }
        End Function
    End Class

End Namespace
