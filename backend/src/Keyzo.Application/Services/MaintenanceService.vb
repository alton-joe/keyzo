Imports System.ComponentModel.DataAnnotations
Imports Keyzo.Application.Security
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class MaintenanceListItem
        Public Property Id As Long
        Public Property Title As String
        Public Property Category As String
        Public Property Priority As String
        Public Property Status As String
        Public Property UnitId As Long
        Public Property UnitNumber As String
        Public Property PropertyId As Long
        Public Property PropertyName As String
        Public Property TenantName As String
        Public Property AssignedTo As String
        Public Property ScheduledFor As DateOnly?
        Public Property CreatedAt As DateTime
        Public Property CompletedAt As DateTime?
        Public Property TotalCost As Decimal
    End Class

    Public Class MaintenanceLogDto
        Public Property Id As Long
        Public Property Status As String
        Public Property Note As String
        Public Property Cost As Decimal
        Public Property Author As String
        Public Property CreatedAt As DateTime
    End Class

    Public Class MaintenanceImageDto
        Public Property Id As Long
    End Class

    Public Class MaintenanceDetail
        Public Property Item As MaintenanceListItem
        Public Property Description As String
        Public Property AssignedStaffId As Long?
        Public Property Images As IReadOnlyList(Of MaintenanceImageDto)
        Public Property Logs As IReadOnlyList(Of MaintenanceLogDto)
    End Class

    Public Class CreateMaintenanceRequest
        Public Property UnitId As Long
        <Required, MaxLength(150)> Public Property Title As String = ""
        <Required, MaxLength(4000)> Public Property Description As String = ""
        <Required> Public Property Category As String = ""
        <Required> Public Property Priority As String = ""
    End Class

    Public Class AssignRequest
        <Range(1, Long.MaxValue)> Public Property StaffId As Long
        Public Property ScheduledFor As DateOnly?
    End Class

    Public Class AddLogRequest
        <Required> Public Property Status As String = ""
        <MaxLength(1000)> Public Property Note As String
        <Range(0, 100000000)> Public Property Cost As Decimal
    End Class

    Public Class MaintenanceFilter
        Public Property Status As String
        Public Property Priority As String
        Public Property PropertyId As Long?
        Public Property UnitId As Long?
        Public Property Search As String
        Public Property Page As Integer = 1
        Public Property PageSize As Integer = 20
    End Class

    Public Class ExpenseDto
        Public Property Id As Long
        Public Property PropertyId As Long
        Public Property PropertyName As String
        Public Property UnitNumber As String
        Public Property RequestId As Long?
        Public Property Category As String
        Public Property Description As String
        Public Property Amount As Decimal
        Public Property ExpenseDate As DateOnly
        Public Property RecordedBy As String
    End Class

    Public Class CreateExpenseRequest
        Public Property PropertyId As Long
        Public Property UnitId As Long?
        <Required> Public Property Category As String = ""
        <Required, MaxLength(300)> Public Property Description As String = ""
        <Range(0.01, 1000000000)> Public Property Amount As Decimal
        Public Property ExpenseDate As DateOnly
    End Class

    Public Class ExpenseFilter
        Public Property PropertyId As Long?
        Public Property Category As String
        Public Property [From] As DateOnly?
        Public Property [To] As DateOnly?
        Public Property Page As Integer = 1
        Public Property PageSize As Integer = 20
    End Class

    Public Interface IMaintenanceService
        Function ListAsync(filter As MaintenanceFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of MaintenanceListItem))
        Function GetAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail)
        Function CreateAsync(request As CreateMaintenanceRequest, images As IReadOnlyList(Of (Content As Stream, FileName As String)), Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail)
        Function AssignAsync(id As Long, request As AssignRequest, Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail)
        Function AddLogAsync(id As Long, request As AddLogRequest, Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail)
        Function CancelAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail)
        Function DownloadImageAsync(imageId As Long, Optional ct As CancellationToken = Nothing) As Task(Of PrivateFile)

        Function ListExpensesAsync(filter As ExpenseFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of ExpenseDto))
        Function CreateExpenseAsync(request As CreateExpenseRequest, Optional ct As CancellationToken = Nothing) As Task(Of ExpenseDto)
        Function DeleteExpenseAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task
    End Interface

    Public NotInheritable Class MaintenanceService
        Implements IMaintenanceService

        Private Shared ReadOnly Categories As String() = {"plumbing", "electrical", "appliance", "structural", "pest_control", "cleaning", "other"}
        Private Shared ReadOnly Priorities As String() = {"low", "medium", "high", "urgent"}
        Private Shared ReadOnly ExpenseCategories As String() = {"maintenance", "repairs", "utilities", "tax", "insurance", "salary", "other"}
        Private Shared ReadOnly StaffStatuses As String() = {MaintenanceStatus.InProgress, MaintenanceStatus.Completed}

        Private ReadOnly db As IAppDbContext
        Private ReadOnly scope As IAccessScope
        Private ReadOnly current As ICurrentUser
        Private ReadOnly storage As IFileStorage
        Private ReadOnly audit As IAuditService

        Public Sub New(db As IAppDbContext, scope As IAccessScope, current As ICurrentUser, storage As IFileStorage, audit As IAuditService)
            Me.db = db
            Me.scope = scope
            Me.current = current
            Me.storage = storage
            Me.audit = audit
        End Sub

        Public Function ListAsync(filter As MaintenanceFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of MaintenanceListItem)) Implements IMaintenanceService.ListAsync
            Dim q = scope.MaintenanceRequests().AsNoTracking()
            If Not String.IsNullOrWhiteSpace(filter.Status) Then
                Dim status = filter.Status
                If status = "active" Then
                    q = q.Where(Function(r) r.Status <> MaintenanceStatus.Completed AndAlso r.Status <> MaintenanceStatus.Cancelled)
                Else
                    q = q.Where(Function(r) r.Status = status)
                End If
            End If
            If Not String.IsNullOrWhiteSpace(filter.Priority) Then
                Dim priority = filter.Priority
                q = q.Where(Function(r) r.Priority = priority)
            End If
            If filter.PropertyId.HasValue Then
                Dim propertyId = filter.PropertyId.Value
                q = q.Where(Function(r) r.Unit.PropertyId = propertyId)
            End If
            If filter.UnitId.HasValue Then
                Dim unitId = filter.UnitId.Value
                q = q.Where(Function(r) r.UnitId = unitId)
            End If
            If Not String.IsNullOrWhiteSpace(filter.Search) Then
                Dim search = filter.Search
                q = q.Where(Function(r) r.Title.Contains(search) OrElse r.Unit.UnitNumber.Contains(search) OrElse r.Unit.Property.Name.Contains(search))
            End If

            ' open work first, urgent first, then newest
            Dim ordered = q.OrderBy(Function(r) If(r.Status = MaintenanceStatus.Completed OrElse r.Status = MaintenanceStatus.Cancelled, 1, 0)).
                ThenBy(Function(r) If(r.Priority = "urgent", 0, If(r.Priority = "high", 1, If(r.Priority = "medium", 2, 3)))).
                ThenByDescending(Function(r) r.CreatedAt)
            Return Project(ordered).ToPagedAsync(New PageQuery(filter.Page, filter.PageSize), ct)
        End Function

        Public Async Function GetAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail) Implements IMaintenanceService.GetAsync
            Dim item = Await Project(scope.MaintenanceRequests().AsNoTracking().Where(Function(r) r.Id = id)).FirstOrDefaultAsync(ct)
            If item Is Nothing Then Throw New NotFoundException("Request not found.")
            Dim req = Await db.MaintenanceRequests.AsNoTracking().Where(Function(r) r.Id = id).
                Select(Function(r) New With {
                    Key .Description = r.Description,
                    Key .Staff = r.Assignments.Where(Function(a) a.IsCurrent).Select(Function(a) CType(a.StaffId, Long?)).FirstOrDefault()
                }).FirstAsync(ct)
            Dim images = Await db.MaintenanceImages.AsNoTracking().Where(Function(i) i.RequestId = id).
                Select(Function(i) New MaintenanceImageDto With {.Id = i.Id}).ToListAsync(ct)
            Dim logs = Await db.MaintenanceLogs.AsNoTracking().Where(Function(l) l.RequestId = id).OrderByDescending(Function(l) l.CreatedAt).ThenByDescending(Function(l) l.Id).
                Select(Function(l) New MaintenanceLogDto With {
                    .Id = l.Id,
                    .Status = l.Status,
                    .Note = l.Note,
                    .Cost = l.Cost,
                    .Author = If(l.Author IsNot Nothing, l.Author.FullName, Nothing),
                    .CreatedAt = l.CreatedAt
                }).ToListAsync(ct)
            Return New MaintenanceDetail With {
                .Item = item,
                .Description = req.Description,
                .AssignedStaffId = req.Staff,
                .Images = images,
                .Logs = logs
            }
        End Function

        Public Async Function CreateAsync(request As CreateMaintenanceRequest, images As IReadOnlyList(Of (Content As Stream, FileName As String)), Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail) Implements IMaintenanceService.CreateAsync
            Dim tenantId = Await scope.RequireTenantProfileIdAsync(ct)
            If Not Categories.Contains(request.Category) Then Throw New BusinessRuleException("Unknown category.")
            If Not Priorities.Contains(request.Priority) Then Throw New BusinessRuleException("Unknown priority.")
            If images.Count > 5 Then Throw New BusinessRuleException("You can attach up to 5 photos.")

            Dim today = DateOnly.FromDateTime(DateTime.UtcNow)
            Dim requestedUnitId = request.UnitId
            Dim hasLease = Await db.Leases.AnyAsync(Function(l) l.UnitId = requestedUnitId AndAlso l.TenantId = tenantId AndAlso l.Status = LeaseStatus.Active AndAlso l.StartDate <= today AndAlso l.EndDate >= today, ct)
            If Not hasLease Then Throw New ForbiddenException("You can only raise requests for a unit you currently rent.")

            Dim req As New MaintenanceRequest With {
                .UnitId = request.UnitId,
                .TenantId = tenantId,
                .Title = request.Title.Trim(),
                .Description = request.Description.Trim(),
                .Category = request.Category,
                .Priority = request.Priority
            }
            db.MaintenanceRequests.Add(req)
            Await db.SaveChangesAsync(ct)   ' trg_maint_requests_ai notifies owner / manager

            For Each img In images
                Dim saved = Await storage.SaveAsync(img.Content, img.FileName, "maintenance", ct)
                db.MaintenanceImages.Add(New MaintenanceImage With {.RequestId = req.Id, .FilePath = saved.RelativePath})
            Next
            db.MaintenanceLogs.Add(New MaintenanceLog With {.RequestId = req.Id, .AuthorId = current.RequiredId(), .Status = MaintenanceStatus.Open, .Note = "Request submitted"})
            Await db.SaveChangesAsync(ct)
            Return Await GetAsync(req.Id, ct)
        End Function

        Public Async Function AssignAsync(id As Long, request As AssignRequest, Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail) Implements IMaintenanceService.AssignAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim req = Await scope.MaintenanceRequests().FirstOrDefaultAsync(Function(x) x.Id = id, ct)
            If req Is Nothing Then Throw New NotFoundException("Request not found.")
            If req.Status = MaintenanceStatus.Completed OrElse req.Status = MaintenanceStatus.Cancelled Then Throw New BusinessRuleException("This request is already closed.")

            Dim staffId = request.StaffId
            Dim staffRoleId = Roles.IdOf(Roles.MaintenanceStaff)
            Dim staff = Await db.Users.Where(Function(u) u.Id = staffId AndAlso u.IsActive AndAlso u.UserRoles.Any(Function(x) x.RoleId = staffRoleId)).
                Select(Function(u) New With {Key .Id = u.Id, Key .FullName = u.FullName}).FirstOrDefaultAsync(ct)
            If staff Is Nothing Then Throw New BusinessRuleException("The selected user is not an active maintenance staff member.")
            If request.ScheduledFor.HasValue AndAlso request.ScheduledFor.Value < DateOnly.FromDateTime(DateTime.UtcNow.Date) Then
                Throw New BusinessRuleException("The scheduled date cannot be in the past.")
            End If

            Using tx = Await db.Database.BeginTransactionAsync(ct)
                Dim previous = Await db.MaintenanceAssignments.Where(Function(a) a.RequestId = id AndAlso a.IsCurrent).ToListAsync(ct)
                For Each old In previous
                    old.IsCurrent = False
                Next
                Await db.SaveChangesAsync(ct)
                db.MaintenanceAssignments.Add(New MaintenanceAssignment With {.RequestId = id, .StaffId = staff.Id, .AssignedBy = current.RequiredId(), .ScheduledFor = request.ScheduledFor})
                db.MaintenanceLogs.Add(New MaintenanceLog With {.RequestId = id, .AuthorId = current.RequiredId(), .Status = MaintenanceStatus.Assigned, .Note = $"Assigned to {staff.FullName}"})
                Await db.SaveChangesAsync(ct)
                Await tx.CommitAsync(ct)
            End Using
            Return Await GetAsync(id, ct)
        End Function

        Public Async Function AddLogAsync(id As Long, request As AddLogRequest, Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail) Implements IMaintenanceService.AddLogAsync
            If Not MaintenanceStatus.All.Contains(request.Status) Then Throw New BusinessRuleException("Unknown status.")
            Dim req = Await scope.MaintenanceRequests().AsNoTracking().FirstOrDefaultAsync(Function(x) x.Id = id, ct)
            If req Is Nothing Then Throw New NotFoundException("Request not found.")
            If req.Status = MaintenanceStatus.Completed OrElse req.Status = MaintenanceStatus.Cancelled Then Throw New BusinessRuleException("This request is already closed.")

            Dim uid = current.RequiredId()
            Dim isAssignedStaff = False
            If current.IsStaff() Then
                isAssignedStaff = Await db.MaintenanceAssignments.AnyAsync(Function(a) a.RequestId = id AndAlso a.StaffId = uid AndAlso a.IsCurrent, ct)
            End If
            If Not current.IsOperator() Then
                If Not isAssignedStaff Then Throw New ForbiddenException()
                If Not StaffStatuses.Contains(request.Status) Then Throw New BusinessRuleException("Staff can mark a job as in progress or completed.")
            ElseIf request.Status = MaintenanceStatus.Open OrElse request.Status = MaintenanceStatus.Assigned Then
                Throw New BusinessRuleException("Use the assign action to assign a request.")
            End If
            If request.Status = MaintenanceStatus.InProgress AndAlso req.Status = MaintenanceStatus.Open Then
                Throw New BusinessRuleException("Assign the request to a staff member first.")
            End If

            db.MaintenanceLogs.Add(New MaintenanceLog With {.RequestId = id, .AuthorId = uid, .Status = request.Status, .Note = request.Note?.Trim(), .Cost = request.Cost})
            Await db.SaveChangesAsync(ct)   ' trg_maint_logs_ai moves the request status and books the expense when cost > 0
            Return Await GetAsync(id, ct)
        End Function

        Public Async Function CancelAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of MaintenanceDetail) Implements IMaintenanceService.CancelAsync
            Dim req = Await scope.MaintenanceRequests().AsNoTracking().FirstOrDefaultAsync(Function(x) x.Id = id, ct)
            If req Is Nothing Then Throw New NotFoundException("Request not found.")
            Dim requestTenantId = req.TenantId
            Dim tenantUserId = Await db.TenantProfiles.Where(Function(t) t.Id = requestTenantId).Select(Function(t) t.UserId).FirstAsync(ct)
            Dim isRequester = current.Id.HasValue AndAlso tenantUserId = current.Id.Value
            If Not (current.IsOperator() OrElse isRequester) Then Throw New ForbiddenException()
            If req.Status = MaintenanceStatus.Completed OrElse req.Status = MaintenanceStatus.Cancelled Then Throw New BusinessRuleException("This request is already closed.")
            db.MaintenanceLogs.Add(New MaintenanceLog With {.RequestId = id, .AuthorId = current.RequiredId(), .Status = MaintenanceStatus.Cancelled, .Note = "Request cancelled"})
            Await db.SaveChangesAsync(ct)
            Return Await GetAsync(id, ct)
        End Function

        Public Async Function DownloadImageAsync(imageId As Long, Optional ct As CancellationToken = Nothing) As Task(Of PrivateFile) Implements IMaintenanceService.DownloadImageAsync
            Dim img = Await db.MaintenanceImages.AsNoTracking().FirstOrDefaultAsync(Function(i) i.Id = imageId, ct)
            If img Is Nothing Then Throw New NotFoundException()
            Dim imgRequestId = img.RequestId
            If Not Await scope.MaintenanceRequests().AnyAsync(Function(r) r.Id = imgRequestId, ct) Then Throw New ForbiddenException()
            Return storage.OpenPrivate(img.FilePath, Path.GetFileName(img.FilePath))
        End Function

        ' ------------------------------------------------------------ expenses
        Public Function ListExpensesAsync(filter As ExpenseFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of ExpenseDto)) Implements IMaintenanceService.ListExpensesAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim q = scope.Expenses().AsNoTracking()
            If filter.PropertyId.HasValue Then
                Dim propertyId = filter.PropertyId.Value
                q = q.Where(Function(e) e.PropertyId = propertyId)
            End If
            If Not String.IsNullOrWhiteSpace(filter.Category) Then
                Dim category = filter.Category
                q = q.Where(Function(e) e.Category = category)
            End If
            If filter.From.HasValue Then
                Dim dateFrom = filter.From.Value
                q = q.Where(Function(e) e.ExpenseDate >= dateFrom)
            End If
            If filter.To.HasValue Then
                Dim dateTo = filter.To.Value
                q = q.Where(Function(e) e.ExpenseDate <= dateTo)
            End If
            Return q.OrderByDescending(Function(e) e.ExpenseDate).ThenByDescending(Function(e) e.Id).
                Select(Function(e) New ExpenseDto With {
                    .Id = e.Id,
                    .PropertyId = e.PropertyId,
                    .PropertyName = e.Property.Name,
                    .UnitNumber = db.Units.Where(Function(u) e.UnitId.HasValue AndAlso u.Id = e.UnitId.Value).Select(Function(u) u.UnitNumber).FirstOrDefault(),
                    .RequestId = e.RequestId,
                    .Category = e.Category,
                    .Description = e.Description,
                    .Amount = e.Amount,
                    .ExpenseDate = e.ExpenseDate,
                    .RecordedBy = db.Users.Where(Function(u) e.RecordedBy.HasValue AndAlso u.Id = e.RecordedBy.Value).Select(Function(u) u.FullName).FirstOrDefault()
                }).ToPagedAsync(New PageQuery(filter.Page, filter.PageSize), ct)
        End Function

        Public Async Function CreateExpenseAsync(request As CreateExpenseRequest, Optional ct As CancellationToken = Nothing) As Task(Of ExpenseDto) Implements IMaintenanceService.CreateExpenseAsync
            Await scope.EnsureCanManagePropertyAsync(request.PropertyId, ct)
            If Not ExpenseCategories.Contains(request.Category) Then Throw New BusinessRuleException("Unknown expense category.")
            If request.UnitId.HasValue Then
                Dim expenseUnitId = request.UnitId.Value
                Dim expensePropertyId = request.PropertyId
                If Not Await db.Units.AnyAsync(Function(u) u.Id = expenseUnitId AndAlso u.PropertyId = expensePropertyId, ct) Then
                    Throw New BusinessRuleException("The unit does not belong to this property.")
                End If
            End If
            Dim expense As New Expense With {
                .PropertyId = request.PropertyId,
                .UnitId = request.UnitId,
                .Category = request.Category,
                .Description = request.Description.Trim(),
                .Amount = request.Amount,
                .ExpenseDate = request.ExpenseDate,
                .RecordedBy = current.RequiredId()
            }
            db.Expenses.Add(expense)
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("create", "expense", expense.Id, New With {.Amount = expense.Amount, .Category = expense.Category}, ct:=ct)
            Dim newId = expense.Id
            Return Await scope.Expenses().AsNoTracking().Where(Function(x) x.Id = newId).
                Select(Function(x) New ExpenseDto With {
                    .Id = x.Id,
                    .PropertyId = x.PropertyId,
                    .PropertyName = x.Property.Name,
                    .UnitNumber = db.Units.Where(Function(u) x.UnitId.HasValue AndAlso u.Id = x.UnitId.Value).Select(Function(u) u.UnitNumber).FirstOrDefault(),
                    .RequestId = x.RequestId,
                    .Category = x.Category,
                    .Description = x.Description,
                    .Amount = x.Amount,
                    .ExpenseDate = x.ExpenseDate,
                    .RecordedBy = Nothing
                }).FirstAsync(ct)
        End Function

        Public Async Function DeleteExpenseAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task Implements IMaintenanceService.DeleteExpenseAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim expense = Await scope.Expenses().FirstOrDefaultAsync(Function(x) x.Id = id, ct)
            If expense Is Nothing Then Throw New NotFoundException()
            If expense.RequestId.HasValue Then Throw New BusinessRuleException("This expense was created from a maintenance job and cannot be deleted.")
            db.Expenses.Remove(expense)
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("delete", "expense", id, ct:=ct)
        End Function

        Private Function Project(q As IQueryable(Of MaintenanceRequest)) As IQueryable(Of MaintenanceListItem)
            Return q.Select(Function(r) New MaintenanceListItem With {
                .Id = r.Id,
                .Title = r.Title,
                .Category = r.Category,
                .Priority = r.Priority,
                .Status = r.Status,
                .UnitId = r.UnitId,
                .UnitNumber = r.Unit.UnitNumber,
                .PropertyId = r.Unit.PropertyId,
                .PropertyName = r.Unit.Property.Name,
                .TenantName = r.Tenant.User.FullName,
                .AssignedTo = r.Assignments.Where(Function(a) a.IsCurrent).Select(Function(a) a.Staff.FullName).FirstOrDefault(),
                .ScheduledFor = r.Assignments.Where(Function(a) a.IsCurrent).Select(Function(a) a.ScheduledFor).FirstOrDefault(),
                .CreatedAt = r.CreatedAt,
                .CompletedAt = r.CompletedAt,
                .TotalCost = If(db.MaintenanceLogs.Where(Function(l) l.RequestId = r.Id).Sum(Function(l) CType(l.Cost, Decimal?)), 0D)
            })
        End Function

    End Class

End Namespace
