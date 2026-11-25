Imports Keyzo.Api.Infrastructure
Imports Keyzo.Application
Imports Keyzo.Application.Services
Imports Keyzo.Domain
Imports Microsoft.AspNetCore.Authorization
Imports Microsoft.AspNetCore.Mvc
Imports Microsoft.AspNetCore.RateLimiting

Namespace Controllers

    <Route("api/v1/auth")>
    Public Class AuthController
        Inherits ApiControllerBase

        Private ReadOnly auth As IAuthService

        Public Sub New(auth As IAuthService)
            Me.auth = auth
        End Sub

        ' brute-force protection applies to the credential endpoints only (not /me, which every page load calls)
        <AllowAnonymous, EnableRateLimiting("auth"), HttpPost("register")>
        Public Async Function Register(r As RegisterRequest, ct As CancellationToken) As Task(Of AuthResponse)
            Return Await auth.RegisterAsync(r, ct)
        End Function

        <AllowAnonymous, EnableRateLimiting("auth"), HttpPost("login")>
        Public Async Function Login(r As LoginRequest, ct As CancellationToken) As Task(Of AuthResponse)
            Return Await auth.LoginAsync(r, ct)
        End Function

        <AllowAnonymous, EnableRateLimiting("auth"), HttpPost("refresh")>
        Public Async Function Refresh(r As RefreshRequest, ct As CancellationToken) As Task(Of AuthResponse)
            Return Await auth.RefreshAsync(r.RefreshToken, ct)
        End Function

        <AllowAnonymous, HttpPost("logout")>
        Public Async Function Logout(r As RefreshRequest, ct As CancellationToken) As Task(Of IActionResult)
            Await auth.LogoutAsync(r.RefreshToken, ct)
            Return NoContent()
        End Function

        <HttpGet("me")>
        Public Async Function [Me](ct As CancellationToken) As Task(Of UserDto)
            Return Await auth.MeAsync(ct)
        End Function

        <HttpPut("me")>
        Public Async Function UpdateMe(r As UpdateProfileRequest, ct As CancellationToken) As Task(Of UserDto)
            Return Await auth.UpdateProfileAsync(r, ct)
        End Function

        <HttpPost("change-password")>
        Public Async Function ChangePassword(r As ChangePasswordRequest, ct As CancellationToken) As Task(Of IActionResult)
            Await auth.ChangePasswordAsync(r, ct)
            Return NoContent()
        End Function
    End Class

    <Route("api/v1/users")>
    Public Class UsersController
        Inherits ApiControllerBase

        Private ReadOnly users As IUserService

        Public Sub New(users As IUserService)
            Me.users = users
        End Sub

        <HttpGet>
        Public Async Function List(<FromQuery> search As String, <FromQuery> role As String,
                                   <FromQuery> Optional page As Integer = 1, <FromQuery> Optional pageSize As Integer = 20,
                                   Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of UserDto))
            Return Await users.ListAsync(search, role, New PageQuery(page, pageSize), ct)
        End Function

        <HttpPost>
        Public Async Function Create(r As CreateUserRequest, ct As CancellationToken) As Task(Of UserDto)
            Return Await users.CreateAsync(r, ct)
        End Function

        Public Class ActiveBody
            Public Property Active As Boolean
        End Class

        <HttpPatch("{id:long}/active")>
        Public Async Function SetActive(id As Long, body As ActiveBody, ct As CancellationToken) As Task(Of IActionResult)
            Await users.SetActiveAsync(id, body.Active, ct)
            Return NoContent()
        End Function

        <HttpGet("lookup/{role}")>
        Public Async Function Lookup(role As String, ct As CancellationToken) As Task(Of IReadOnlyList(Of UserLookupDto))
            Return Await users.LookupAsync(role, ct)
        End Function
    End Class

    ''' <summary>Anonymous endpoints for the marketing site and the "browse available units" page.</summary>
    <Route("api/v1/public")>
    <AllowAnonymous>
    Public Class PublicController
        Inherits ApiControllerBase

        Private ReadOnly svc As IPublicService
        Private ReadOnly tours As ITourService

        Public Sub New(svc As IPublicService, tours As ITourService)
            Me.svc = svc
            Me.tours = tours
        End Sub

        <HttpGet("units")>
        Public Async Function Units(<FromQuery> search As UnitSearch, ct As CancellationToken) As Task(Of PagedResult(Of UnitCard))
            Return Await svc.SearchUnitsAsync(search, ct)
        End Function

        <HttpGet("units/{id:long}")>
        Public Async Function Unit(id As Long, ct As CancellationToken) As Task(Of PublicUnitDetail)
            Return Await svc.GetUnitAsync(id, ct)
        End Function

        ''' <summary>Room-by-room house tour. Empty stops = no custom tour; the client uses its built-in photo library.</summary>
        <HttpGet("units/{id:long}/tour")>
        Public Async Function Tour(id As Long, ct As CancellationToken) As Task(Of UnitTourDto)
            Return Await tours.GetPublicTourAsync(id, ct)
        End Function

        <HttpGet("cities")>
        Public Async Function Cities(ct As CancellationToken) As Task(Of IReadOnlyList(Of String))
            Return Await svc.CitiesAsync(ct)
        End Function

        <HttpGet("stats")>
        Public Async Function Stats(ct As CancellationToken) As Task(Of PublicStats)
            Return Await svc.StatsAsync(ct)
        End Function
    End Class

    <Route("api/v1/amenities")>
    <AllowAnonymous>
    Public Class AmenitiesController
        Inherits ApiControllerBase

        Private ReadOnly props As IPropertyService

        Public Sub New(props As IPropertyService)
            Me.props = props
        End Sub

        <HttpGet>
        Public Async Function List(ct As CancellationToken) As Task(Of IReadOnlyList(Of AmenityDto))
            Return Await props.AmenitiesAsync(ct)
        End Function
    End Class

    <Route("api/v1/notifications")>
    Public Class NotificationsController
        Inherits ApiControllerBase

        Private ReadOnly svc As INotificationService

        Public Sub New(svc As INotificationService)
            Me.svc = svc
        End Sub

        <HttpGet>
        Public Async Function List(<FromQuery> Optional unreadOnly As Boolean = False, <FromQuery> Optional page As Integer = 1,
                                   <FromQuery> Optional pageSize As Integer = 20, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of NotificationDto))
            Return Await svc.ListAsync(unreadOnly, New PageQuery(page, pageSize), ct)
        End Function

        Public Class CountResult
            Public Property Count As Integer
        End Class

        <HttpGet("unread-count")>
        Public Async Function UnreadCount(ct As CancellationToken) As Task(Of CountResult)
            Return New CountResult With {.Count = Await svc.UnreadCountAsync(ct)}
        End Function

        <HttpPost("{id:long}/read")>
        Public Async Function MarkRead(id As Long, ct As CancellationToken) As Task(Of IActionResult)
            Await svc.MarkReadAsync(id, ct)
            Return NoContent()
        End Function

        <HttpPost("read-all")>
        Public Async Function MarkAll(ct As CancellationToken) As Task(Of IActionResult)
            Await svc.MarkAllReadAsync(ct)
            Return NoContent()
        End Function
    End Class

    <Route("api/v1/audit-logs")>
    <Authorize(Roles:=Keyzo.Domain.Roles.SuperAdmin)>
    Public Class AuditController
        Inherits ApiControllerBase

        Private ReadOnly audit As IAuditService

        Public Sub New(audit As IAuditService)
            Me.audit = audit
        End Sub

        <HttpGet>
        Public Async Function List(<FromQuery> entity As String, <FromQuery> action As String,
                                   <FromQuery> Optional page As Integer = 1, <FromQuery> Optional pageSize As Integer = 30,
                                   Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of AuditLogDto))
            Return Await audit.ListAsync(entity, action, New PageQuery(page, pageSize), ct)
        End Function
    End Class

End Namespace
