Imports System.ComponentModel.DataAnnotations
Imports Keyzo.Application.Security
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class ApplicationDto
        Public Property Id As Long
        Public Property UnitId As Long
        Public Property UnitNumber As String
        Public Property PropertyId As Long
        Public Property PropertyName As String
        Public Property MonthlyRent As Decimal
        Public Property TenantId As Long
        Public Property TenantName As String
        Public Property TenantEmail As String
        Public Property TenantPhone As String
        Public Property TenantIncome As Decimal?
        Public Property DesiredMoveIn As DateOnly
        Public Property LeaseMonths As Byte
        Public Property Occupants As Byte
        Public Property Message As String
        Public Property Status As String
        Public Property ReviewNote As String
        Public Property ReviewedAt As DateTime?
        Public Property CreatedAt As DateTime
        Public Property DocumentCount As Integer
        Public Property VerifiedDocuments As Integer
        Public Property LeaseId As Long?
    End Class

    Public Class SubmitApplicationRequest
        Public Property UnitId As Long
        Public Property DesiredMoveIn As DateOnly
        <Range(1, 60)> Public Property LeaseMonths As Byte
        <Range(1, 20)> Public Property Occupants As Byte
        <MaxLength(1000)> Public Property Message As String
        Public Property DocumentIds As List(Of Long)
    End Class

    Public Class DecideApplicationRequest
        Public Property Approve As Boolean
        <MaxLength(500)> Public Property Note As String
    End Class

    Public Class ApplicationFilter
        Public Property Status As String
        Public Property UnitId As Long?
        Public Property PropertyId As Long?
        Public Property Page As Integer = 1
        Public Property PageSize As Integer = 20
    End Class

    Public Interface IApplicationService
        Function ListAsync(filter As ApplicationFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of ApplicationDto))
        Function GetAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of ApplicationDto)
        Function SubmitAsync(request As SubmitApplicationRequest, Optional ct As CancellationToken = Nothing) As Task(Of ApplicationDto)
        Function DecideAsync(id As Long, request As DecideApplicationRequest, Optional ct As CancellationToken = Nothing) As Task(Of ApplicationDto)
        Function WithdrawAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task
    End Interface

    Public NotInheritable Class ApplicationService
        Implements IApplicationService

        Private ReadOnly db As IAppDbContext
        Private ReadOnly scope As IAccessScope
        Private ReadOnly current As ICurrentUser
        Private ReadOnly procs As IStoredProcedures
        Private ReadOnly audit As IAuditService

        Public Sub New(db As IAppDbContext, scope As IAccessScope, current As ICurrentUser, procs As IStoredProcedures, audit As IAuditService)
            Me.db = db
            Me.scope = scope
            Me.current = current
            Me.procs = procs
            Me.audit = audit
        End Sub

        Public Function ListAsync(filter As ApplicationFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of ApplicationDto)) Implements IApplicationService.ListAsync
            Dim q = scope.Applications().AsNoTracking()
            If Not String.IsNullOrWhiteSpace(filter.Status) Then
                Dim status = filter.Status
                q = q.Where(Function(a) a.Status = status)
            End If
            If filter.UnitId.HasValue Then
                Dim unitId = filter.UnitId.Value
                q = q.Where(Function(a) a.UnitId = unitId)
            End If
            If filter.PropertyId.HasValue Then
                Dim propertyId = filter.PropertyId.Value
                q = q.Where(Function(a) a.Unit.PropertyId = propertyId)
            End If
            ' order BEFORE projecting: EF cannot translate ordering over a projected DTO
            Return Project(q.OrderByDescending(Function(a) a.CreatedAt).ThenByDescending(Function(a) a.Id)).ToPagedAsync(New PageQuery(filter.Page, filter.PageSize), ct)
        End Function

        Public Async Function GetAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of ApplicationDto) Implements IApplicationService.GetAsync
            Dim dto = Await Project(scope.Applications().AsNoTracking().Where(Function(a) a.Id = id)).FirstOrDefaultAsync(ct)
            If dto Is Nothing Then Throw New NotFoundException("Application not found.")
            Return dto
        End Function

        Public Async Function SubmitAsync(request As SubmitApplicationRequest, Optional ct As CancellationToken = Nothing) As Task(Of ApplicationDto) Implements IApplicationService.SubmitAsync
            Dim tenantId = Await scope.RequireTenantProfileIdAsync(ct)
            If request.DesiredMoveIn < DateOnly.FromDateTime(DateTime.UtcNow.Date) Then
                Throw New BusinessRuleException("The desired move-in date cannot be in the past.")
            End If

            Dim requestedUnitId = request.UnitId
            Dim unit = Await db.Units.Include(Function(x) x.Property).FirstOrDefaultAsync(Function(x) x.Id = requestedUnitId, ct)
            If unit Is Nothing Then Throw New NotFoundException("Unit not found.")
            If unit.Status <> UnitStatus.Available OrElse Not unit.Property.IsActive Then
                Throw New BusinessRuleException("This unit is not available for rent right now.")
            End If

            Dim today = DateOnly.FromDateTime(DateTime.UtcNow)
            Dim reserved = Await db.Leases.AnyAsync(Function(l) l.UnitId = requestedUnitId AndAlso l.Status = LeaseStatus.Active AndAlso l.EndDate >= today, ct)
            If Not reserved Then
                reserved = Await db.Applications.AnyAsync(Function(a) a.UnitId = requestedUnitId AndAlso a.Status = ApplicationStatus.Approved AndAlso
                    Not db.Leases.Any(Function(l2) l2.ApplicationId.HasValue AndAlso l2.ApplicationId.Value = a.Id), ct)
            End If
            If reserved Then Throw New ConflictException("This home has just been reserved by another applicant.")

            Dim hasActive = Await db.Applications.AnyAsync(Function(a) a.UnitId = requestedUnitId AndAlso a.TenantId = tenantId AndAlso
                (a.Status = ApplicationStatus.Pending OrElse a.Status = ApplicationStatus.Approved), ct)
            If hasActive Then Throw New ConflictException("You already have an active application for this unit.")

            Dim app As New RentalApplication With {
                .UnitId = request.UnitId,
                .TenantId = tenantId,
                .DesiredMoveIn = request.DesiredMoveIn,
                .LeaseMonths = request.LeaseMonths,
                .Occupants = request.Occupants,
                .Message = request.Message?.Trim()
            }
            db.Applications.Add(app)
            Await db.SaveChangesAsync(ct)

            If request.DocumentIds IsNot Nothing AndAlso request.DocumentIds.Count > 0 Then
                Dim docIds = request.DocumentIds.ToList()
                Dim docs = Await db.TenantDocuments.Where(Function(d) d.TenantId = tenantId AndAlso docIds.Contains(d.Id)).ToListAsync(ct)
                For Each doc In docs
                    doc.ApplicationId = app.Id
                Next
                Await db.SaveChangesAsync(ct)
            End If
            Return Await GetAsync(app.Id, ct)
        End Function

        Public Async Function DecideAsync(id As Long, request As DecideApplicationRequest, Optional ct As CancellationToken = Nothing) As Task(Of ApplicationDto) Implements IApplicationService.DecideAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            If Not Await scope.Applications().AnyAsync(Function(a) a.Id = id, ct) Then Throw New NotFoundException("Application not found.")
            Await procs.DecideApplicationAsync(id, request.Approve, request.Note, current.RequiredId(), ct)   ' transaction in MySQL
            Return Await GetAsync(id, ct)
        End Function

        Public Async Function WithdrawAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task Implements IApplicationService.WithdrawAsync
            Dim tenantId = Await scope.RequireTenantProfileIdAsync(ct)
            Dim app = Await db.Applications.FirstOrDefaultAsync(Function(a) a.Id = id AndAlso a.TenantId = tenantId, ct)
            If app Is Nothing Then Throw New NotFoundException()
            If app.Status <> ApplicationStatus.Pending Then Throw New BusinessRuleException("Only pending applications can be withdrawn.")
            app.Status = ApplicationStatus.Withdrawn
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("withdraw", "rental_application", id, ct:=ct)
        End Function

        Private Function Project(q As IQueryable(Of RentalApplication)) As IQueryable(Of ApplicationDto)
            Return q.Select(Function(a) New ApplicationDto With {
                .Id = a.Id,
                .UnitId = a.UnitId,
                .UnitNumber = a.Unit.UnitNumber,
                .PropertyId = a.Unit.PropertyId,
                .PropertyName = a.Unit.Property.Name,
                .MonthlyRent = a.Unit.MonthlyRent,
                .TenantId = a.TenantId,
                .TenantName = a.Tenant.User.FullName,
                .TenantEmail = a.Tenant.User.Email,
                .TenantPhone = a.Tenant.User.Phone,
                .TenantIncome = a.Tenant.MonthlyIncome,
                .DesiredMoveIn = a.DesiredMoveIn,
                .LeaseMonths = a.LeaseMonths,
                .Occupants = a.Occupants,
                .Message = a.Message,
                .Status = a.Status,
                .ReviewNote = a.ReviewNote,
                .ReviewedAt = a.ReviewedAt,
                .CreatedAt = a.CreatedAt,
                .DocumentCount = db.TenantDocuments.Count(Function(d) d.TenantId = a.TenantId),
                .VerifiedDocuments = db.TenantDocuments.Count(Function(d) d.TenantId = a.TenantId AndAlso d.IsVerified),
                .LeaseId = db.Leases.Where(Function(l) l.ApplicationId.HasValue AndAlso l.ApplicationId.Value = a.Id).Select(Function(l) CType(l.Id, Long?)).FirstOrDefault()
            })
        End Function

    End Class

End Namespace
