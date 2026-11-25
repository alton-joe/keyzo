Imports System.Text.Json
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    ' ------------------------------------------------------------------ audit
    Public Class AuditLogDto
        Public Property Id As Long
        Public Property UserId As Long?
        Public Property UserName As String
        Public Property Action As String
        Public Property Entity As String
        Public Property EntityId As Long?
        Public Property Details As String
        Public Property CreatedAt As DateTime
    End Class

    Public Interface IAuditService
        Function LogAsync(action As String, entity As String, entityId As Long?, Optional details As Object = Nothing, Optional userId As Long? = Nothing, Optional ct As CancellationToken = Nothing) As Task
        Function ListAsync(entity As String, action As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of AuditLogDto))
    End Interface

    Public NotInheritable Class AuditService
        Implements IAuditService

        Private ReadOnly db As IAppDbContext
        Private ReadOnly currentUser As ICurrentUser

        Public Sub New(db As IAppDbContext, currentUser As ICurrentUser)
            Me.db = db
            Me.currentUser = currentUser
        End Sub

        Public Async Function LogAsync(action As String, entity As String, entityId As Long?, Optional details As Object = Nothing, Optional userId As Long? = Nothing, Optional ct As CancellationToken = Nothing) As Task Implements IAuditService.LogAsync
            Dim actor As Long? = If(userId.HasValue, userId, currentUser.Id)
            db.AuditLogs.Add(New AuditLog With {
                .UserId = actor,
                .Action = action,
                .Entity = entity,
                .EntityId = entityId,
                .Details = If(details Is Nothing, Nothing, JsonSerializer.Serialize(details))
            })
            Await db.SaveChangesAsync(ct)
        End Function

        Public Async Function ListAsync(entity As String, action As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of AuditLogDto)) Implements IAuditService.ListAsync
            If Not currentUser.IsAdmin() Then Throw New ForbiddenException()
            Dim q = db.AuditLogs.AsNoTracking().AsQueryable()
            If Not String.IsNullOrWhiteSpace(entity) Then q = q.Where(Function(a) a.Entity = entity)
            If Not String.IsNullOrWhiteSpace(action) Then q = q.Where(Function(a) a.Action = action)
            Return Await q.OrderByDescending(Function(a) a.CreatedAt).ThenByDescending(Function(a) a.Id).
                Select(Function(a) New AuditLogDto With {
                    .Id = a.Id,
                    .UserId = a.UserId,
                    .UserName = If(a.User IsNot Nothing, a.User.FullName, Nothing),
                    .Action = a.Action,
                    .Entity = a.Entity,
                    .EntityId = a.EntityId,
                    .Details = a.Details,
                    .CreatedAt = a.CreatedAt
                }).ToPagedAsync(page, ct)
        End Function
    End Class

    ' ------------------------------------------------------------------ notifications
    Public Class NotificationDto
        Public Property Id As Long
        Public Property Type As String
        Public Property Title As String
        Public Property Message As String
        Public Property Link As String
        Public Property IsRead As Boolean
        Public Property CreatedAt As DateTime
    End Class

    Public Interface INotificationService
        Function ListAsync(unreadOnly As Boolean, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of NotificationDto))
        Function UnreadCountAsync(Optional ct As CancellationToken = Nothing) As Task(Of Integer)
        Function MarkReadAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task
        Function MarkAllReadAsync(Optional ct As CancellationToken = Nothing) As Task
        Function NotifyAsync(userId As Long, type As String, title As String, message As String, Optional link As String = Nothing, Optional ct As CancellationToken = Nothing) As Task
    End Interface

    Public NotInheritable Class NotificationService
        Implements INotificationService

        Private ReadOnly db As IAppDbContext
        Private ReadOnly currentUser As ICurrentUser

        Public Sub New(db As IAppDbContext, currentUser As ICurrentUser)
            Me.db = db
            Me.currentUser = currentUser
        End Sub

        Public Function ListAsync(unreadOnly As Boolean, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of NotificationDto)) Implements INotificationService.ListAsync
            Dim uid = currentUser.RequiredId()
            Dim q = db.Notifications.AsNoTracking().Where(Function(n) n.UserId = uid)
            If unreadOnly Then q = q.Where(Function(n) Not n.IsRead)
            Return q.OrderByDescending(Function(n) n.CreatedAt).ThenByDescending(Function(n) n.Id).
                Select(Function(n) New NotificationDto With {
                    .Id = n.Id,
                    .Type = n.Type,
                    .Title = n.Title,
                    .Message = n.Message,
                    .Link = n.Link,
                    .IsRead = n.IsRead,
                    .CreatedAt = n.CreatedAt
                }).ToPagedAsync(page, ct)
        End Function

        Public Function UnreadCountAsync(Optional ct As CancellationToken = Nothing) As Task(Of Integer) Implements INotificationService.UnreadCountAsync
            Dim uid = currentUser.RequiredId()
            Return db.Notifications.CountAsync(Function(n) n.UserId = uid AndAlso Not n.IsRead, ct)
        End Function

        Public Async Function MarkReadAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task Implements INotificationService.MarkReadAsync
            Dim uid = currentUser.RequiredId()
            Dim rows = Await db.Notifications.Where(Function(n) n.Id = id AndAlso n.UserId = uid AndAlso Not n.IsRead).ToListAsync(ct)
            For Each n In rows
                n.IsRead = True
            Next
            Await db.SaveChangesAsync(ct)
        End Function

        Public Async Function MarkAllReadAsync(Optional ct As CancellationToken = Nothing) As Task Implements INotificationService.MarkAllReadAsync
            Dim uid = currentUser.RequiredId()
            Dim rows = Await db.Notifications.Where(Function(n) n.UserId = uid AndAlso Not n.IsRead).ToListAsync(ct)
            For Each n In rows
                n.IsRead = True
            Next
            Await db.SaveChangesAsync(ct)
        End Function

        Public Async Function NotifyAsync(userId As Long, type As String, title As String, message As String, Optional link As String = Nothing, Optional ct As CancellationToken = Nothing) As Task Implements INotificationService.NotifyAsync
            db.Notifications.Add(New Notification With {.UserId = userId, .Type = type, .Title = title, .Message = message, .Link = link})
            Await db.SaveChangesAsync(ct)
        End Function
    End Class

End Namespace
