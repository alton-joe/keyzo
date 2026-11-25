Imports System.Security.Claims
Imports Keyzo.Application
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Mvc
Imports Microsoft.Extensions.Logging

Namespace Infrastructure

    Public NotInheritable Class HttpCurrentUser
        Implements ICurrentUser

        Private ReadOnly accessor As IHttpContextAccessor

        Public Sub New(accessor As IHttpContextAccessor)
            Me.accessor = accessor
        End Sub

        Private ReadOnly Property Principal As ClaimsPrincipal
            Get
                Return accessor.HttpContext?.User
            End Get
        End Property

        Public ReadOnly Property Id As Long? Implements ICurrentUser.Id
            Get
                Dim parsed As Long
                If Long.TryParse(Principal?.FindFirst("sub")?.Value, parsed) Then Return parsed
                Return Nothing
            End Get
        End Property

        Public ReadOnly Property Email As String Implements ICurrentUser.Email
            Get
                Return Principal?.FindFirst("email")?.Value
            End Get
        End Property

        Public ReadOnly Property IsAuthenticated As Boolean Implements ICurrentUser.IsAuthenticated
            Get
                Dim identity = Principal?.Identity
                Return identity IsNot Nothing AndAlso identity.IsAuthenticated
            End Get
        End Property

        Public Function InRole(role As String) As Boolean Implements ICurrentUser.InRole
            Dim p = Principal
            Return p IsNot Nothing AndAlso p.IsInRole(role)
        End Function
    End Class

    ''' <summary>Converts application exceptions into consistent RFC 7807 problem responses.</summary>
    Public NotInheritable Class ExceptionMiddleware
        Private ReadOnly [next] As RequestDelegate
        Private ReadOnly log As ILogger(Of ExceptionMiddleware)

        Public Sub New([next] As RequestDelegate, log As ILogger(Of ExceptionMiddleware))
            Me.[next] = [next]
            Me.log = log
        End Sub

        Public Async Function InvokeAsync(ctx As HttpContext) As Task
            ' VB does not allow Await inside Catch, so the failure is captured and handled after the Try block.
            Dim failure As Exception = Nothing
            Try
                Await [next](ctx)
            Catch ex As Exception
                failure = ex
            End Try
            If failure Is Nothing Then Return

            Dim status As Integer
            Dim title As String
            If TypeOf failure Is NotFoundException Then
                status = 404 : title = "Not found"
            ElseIf TypeOf failure Is ForbiddenException Then
                status = 403 : title = "Forbidden"
            ElseIf TypeOf failure Is UnauthorizedAppException Then
                status = 401 : title = "Unauthorized"
            ElseIf TypeOf failure Is ConflictException Then
                status = 409 : title = "Conflict"
            ElseIf TypeOf failure Is BusinessRuleException Then
                status = 400 : title = "Request not allowed"
            ElseIf TypeOf failure Is BadHttpRequestException Then
                status = 400 : title = "Bad request"
            Else
                status = 500 : title = "Server error"
            End If
            If status = 500 Then log.LogError(failure, "Unhandled exception for {Path}", ctx.Request.Path)
            If ctx.Response.HasStarted Then System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(failure).Throw()

            ctx.Response.Clear()
            ctx.Response.StatusCode = status
            ctx.Response.ContentType = "application/problem+json"
            Await ctx.Response.WriteAsJsonAsync(New ProblemDetails With {
                .Status = status,
                .Title = title,
                .Detail = If(status = 500, "Something went wrong on our side. Please try again.", failure.Message)
            })
        End Function
    End Class

    <ApiController>
    <Route("api/v1/[controller]")>
    Public MustInherit Class ApiControllerBase
        Inherits ControllerBase
    End Class

End Namespace
