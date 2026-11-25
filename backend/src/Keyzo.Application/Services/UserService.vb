Imports System.ComponentModel.DataAnnotations
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class CreateUserRequest
        <Required, EmailAddress, MaxLength(190)> Public Property Email As String = ""
        <Required, MinLength(8), MaxLength(100)> Public Property Password As String = ""
        <Required, MaxLength(120)> Public Property FullName As String = ""
        <MaxLength(20)> Public Property Phone As String
        <Required> Public Property Role As String = ""
    End Class

    Public Class UserLookupDto
        Public Property Id As Long
        Public Property FullName As String
        Public Property Email As String
        Public Property Role As String
    End Class

    Public Interface IUserService
        Function ListAsync(search As String, role As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of UserDto))
        Function CreateAsync(request As CreateUserRequest, Optional ct As CancellationToken = Nothing) As Task(Of UserDto)
        Function SetActiveAsync(id As Long, active As Boolean, Optional ct As CancellationToken = Nothing) As Task
        ''' <summary>Id/name pairs for dropdowns (managers, maintenance staff, owners).</summary>
        Function LookupAsync(role As String, Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of UserLookupDto))
    End Interface

    Public NotInheritable Class UserService
        Implements IUserService

        Private ReadOnly db As IAppDbContext
        Private ReadOnly current As ICurrentUser
        Private ReadOnly hasher As IPasswordHasher
        Private ReadOnly audit As IAuditService

        Public Sub New(db As IAppDbContext, current As ICurrentUser, hasher As IPasswordHasher, audit As IAuditService)
            Me.db = db
            Me.current = current
            Me.hasher = hasher
            Me.audit = audit
        End Sub

        Public Async Function ListAsync(search As String, role As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of UserDto)) Implements IUserService.ListAsync
            If Not (current.IsAdmin() OrElse current.IsOwner()) Then Throw New ForbiddenException()
            Dim uid = current.RequiredId()

            Dim q As IQueryable(Of User) = db.Users.AsNoTracking().Include("UserRoles.Role")
            If Not current.IsAdmin() Then
                q = q.Where(Function(u) u.CreatedBy.HasValue AndAlso u.CreatedBy.Value = uid)   ' owners manage the accounts they created
            End If
            If Not String.IsNullOrWhiteSpace(role) Then
                q = q.Where(Function(u) u.UserRoles.Any(Function(r) r.Role.Name = role))
            End If
            If Not String.IsNullOrWhiteSpace(search) Then
                q = q.Where(Function(u) u.FullName.Contains(search) OrElse u.Email.Contains(search))
            End If

            Dim total = Await q.CountAsync(ct)
            Dim users = Await q.OrderByDescending(Function(u) u.CreatedAt).Skip(page.Skip).Take(page.SafeSize).ToListAsync(ct)
            Dim dtos = users.Select(Function(u) UserDto.FromUser(u)).ToList()
            Return New PagedResult(Of UserDto)(dtos, total, page.SafePage, page.SafeSize)
        End Function

        Public Async Function CreateAsync(request As CreateUserRequest, Optional ct As CancellationToken = Nothing) As Task(Of UserDto) Implements IUserService.CreateAsync
            Dim allowed As String()
            If current.IsAdmin() Then
                allowed = Roles.All.Where(Function(r) r <> Roles.SuperAdmin).ToArray()   ' admins are fixed in code
            ElseIf current.IsOwner() Then
                allowed = New String() {Roles.Manager, Roles.MaintenanceStaff}
            Else
                allowed = New String() {}
            End If
            If Not allowed.Contains(request.Role) Then
                Throw New ForbiddenException(If(current.IsAdmin() OrElse current.IsOwner(),
                    "You can only create Manager or Maintenance Staff accounts.",
                    "Only an admin or owner can create accounts."))
            End If

            Dim email = request.Email.Trim().ToLowerInvariant()
            If Roles.IsAdminEmail(email) Then Throw New BusinessRuleException("That email belongs to a fixed administrator account, which registers itself.")
            If Await db.Users.AnyAsync(Function(x) x.Email = email, ct) Then
                Throw New ConflictException("An account with this email already exists.")
            End If

            Dim created As New User With {
                .Email = email,
                .FullName = request.FullName.Trim(),
                .Phone = request.Phone?.Trim(),
                .PasswordHash = hasher.Hash(request.Password),
                .CreatedBy = current.RequiredId()
            }
            created.UserRoles.Add(New UserRole With {.RoleId = Roles.IdOf(request.Role)})
            If request.Role = Roles.Tenant Then created.TenantProfile = New TenantProfile()
            db.Users.Add(created)
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("create", "user", created.Id, New With {.role = request.Role}, ct:=ct)

            Dim createdId = created.Id
            Dim loaded = Await db.Users.Include("UserRoles.Role").FirstAsync(Function(x) x.Id = createdId, ct)
            Return UserDto.FromUser(loaded)
        End Function

        Public Async Function SetActiveAsync(id As Long, active As Boolean, Optional ct As CancellationToken = Nothing) As Task Implements IUserService.SetActiveAsync
            If Not (current.IsAdmin() OrElse current.IsOwner()) Then Throw New ForbiddenException()
            Dim target = Await db.Users.FirstOrDefaultAsync(Function(u) u.Id = id, ct)
            If target Is Nothing Then Throw New NotFoundException("User not found.")
            If target.Id = current.RequiredId() Then Throw New BusinessRuleException("You cannot deactivate your own account.")
            If Roles.IsAdminEmail(target.Email) Then Throw New ForbiddenException("Administrator accounts are fixed and cannot be changed.")
            If Not current.IsAdmin() AndAlso Not (target.CreatedBy.HasValue AndAlso target.CreatedBy.Value = current.RequiredId()) Then Throw New ForbiddenException()

            target.IsActive = active
            target.UpdatedAt = DateTime.UtcNow
            If Not active Then
                For Each token In Await db.RefreshTokens.Where(Function(t) t.UserId = id AndAlso Not t.RevokedAt.HasValue).ToListAsync(ct)
                    token.RevokedAt = DateTime.UtcNow
                Next
            End If
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync(If(active, "activate", "deactivate"), "user", id, ct:=ct)
        End Function

        Public Async Function LookupAsync(role As String, Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of UserLookupDto)) Implements IUserService.LookupAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            If Not (role = Roles.Manager OrElse role = Roles.MaintenanceStaff OrElse role = Roles.Owner) Then Throw New BusinessRuleException("Unsupported lookup role.")
            If role = Roles.Owner AndAlso Not current.IsAdmin() Then Throw New ForbiddenException()

            Return Await db.Users.AsNoTracking().
                Where(Function(u) u.IsActive AndAlso u.UserRoles.Any(Function(r) r.Role.Name = role)).
                OrderBy(Function(u) u.FullName).
                Select(Function(u) New UserLookupDto With {.Id = u.Id, .FullName = u.FullName, .Email = u.Email, .Role = role}).
                ToListAsync(ct)
        End Function
    End Class

End Namespace
