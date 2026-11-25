Imports System.ComponentModel.DataAnnotations
Imports Keyzo.Application.Security
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class LeaseListItem
        Public Property Id As Long
        Public Property UnitId As Long
        Public Property UnitNumber As String
        Public Property PropertyId As Long
        Public Property PropertyName As String
        Public Property TenantId As Long
        Public Property TenantName As String
        Public Property StartDate As DateOnly
        Public Property EndDate As DateOnly
        Public Property MonthlyRent As Decimal
        Public Property SecurityDeposit As Decimal
        Public Property Status As String
        Public Property DaysToExpiry As Integer
        Public Property Outstanding As Decimal
        Public Property RenewalPending As Boolean
    End Class

    Public Class LeaseVersionDto
        Public Property VersionNo As Integer
        Public Property StartDate As DateOnly
        Public Property EndDate As DateOnly
        Public Property MonthlyRent As Decimal
        Public Property SecurityDeposit As Decimal
        Public Property ChangeReason As String
        Public Property CreatedAt As DateTime
    End Class

    Public Class RenewalDto
        Public Property Id As Long
        Public Property LeaseId As Long
        Public Property RequestedEndDate As DateOnly
        Public Property ProposedRent As Decimal?
        Public Property Note As String
        Public Property Status As String
        Public Property CreatedAt As DateTime
        Public Property DecidedAt As DateTime?
        Public Property UnitNumber As String
        Public Property PropertyName As String
        Public Property TenantName As String
    End Class

    Public Class DepositDto
        Public Property Id As Long
        Public Property LeaseId As Long
        Public Property Amount As Decimal
        Public Property ReceivedOn As DateOnly
        Public Property Status As String
        Public Property RefundedAmount As Decimal
        Public Property RefundedOn As DateOnly?
        Public Property DeductionReason As String
        Public Property TenantName As String
        Public Property UnitNumber As String
        Public Property PropertyName As String
    End Class

    Public Class LeaseDetail
        Public Property Lease As LeaseListItem
        Public Property RentDueDay As Byte
        Public Property LateFee As Decimal
        Public Property Terms As String
        Public Property ApplicationId As Long?
        Public Property CreatedAt As DateTime
        Public Property Versions As IReadOnlyList(Of LeaseVersionDto)
        Public Property Renewals As IReadOnlyList(Of RenewalDto)
        Public Property Deposit As DepositDto
    End Class

    Public Class CreateLeaseRequest
        Public Property ApplicationId As Long
        Public Property StartDate As DateOnly
        Public Property EndDate As DateOnly
        <Range(1, 100000000)> Public Property MonthlyRent As Decimal
        <Range(0, 100000000)> Public Property SecurityDeposit As Decimal
        <Range(1, 28)> Public Property RentDueDay As Integer
        <Range(0, 10000000)> Public Property LateFee As Decimal
        <MaxLength(8000)> Public Property Terms As String
    End Class

    Public Class UpdateLeaseRequest
        Public Property EndDate As DateOnly
        <Range(1, 100000000)> Public Property MonthlyRent As Decimal
        <Range(0, 100000000)> Public Property SecurityDeposit As Decimal
        <Range(1, 28)> Public Property RentDueDay As Integer
        <Range(0, 10000000)> Public Property LateFee As Decimal
        <MaxLength(8000)> Public Property Terms As String
    End Class

    Public Class RenewalRequest
        Public Property RequestedEndDate As DateOnly
        <Range(1, 100000000)> Public Property ProposedRent As Decimal?
        <MaxLength(500)> Public Property Note As String
    End Class

    Public Class DecideRenewalRequest
        Public Property Approve As Boolean
    End Class

    Public Class LeaseFilter
        Public Property Status As String
        Public Property PropertyId As Long?
        Public Property TenantId As Long?
        Public Property Search As String
        Public Property Page As Integer = 1
        Public Property PageSize As Integer = 20
    End Class

    Public Interface ILeaseService
        Function ListAsync(filter As LeaseFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of LeaseListItem))
        Function GetAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of LeaseDetail)
        Function CreateAsync(request As CreateLeaseRequest, Optional ct As CancellationToken = Nothing) As Task(Of LeaseDetail)
        Function UpdateAsync(id As Long, request As UpdateLeaseRequest, Optional ct As CancellationToken = Nothing) As Task(Of LeaseDetail)
        Function TerminateAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task
        Function RequestRenewalAsync(leaseId As Long, request As RenewalRequest, Optional ct As CancellationToken = Nothing) As Task(Of RenewalDto)
        Function ListRenewalsAsync(status As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of RenewalDto))
        Function DecideRenewalAsync(renewalId As Long, request As DecideRenewalRequest, Optional ct As CancellationToken = Nothing) As Task(Of LeaseDetail)
    End Interface

    Public NotInheritable Class LeaseService
        Implements ILeaseService

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

        Private Shared ReadOnly Property UtcToday As DateOnly
            Get
                Return DateOnly.FromDateTime(DateTime.UtcNow)
            End Get
        End Property

        Public Function ListAsync(filter As LeaseFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of LeaseListItem)) Implements ILeaseService.ListAsync
            Dim today = UtcToday
            Dim q = scope.Leases().AsNoTracking()
            If filter.PropertyId.HasValue Then
                Dim propertyId = filter.PropertyId.Value
                q = q.Where(Function(l) l.Unit.PropertyId = propertyId)
            End If
            If filter.TenantId.HasValue Then
                Dim tenantId = filter.TenantId.Value
                q = q.Where(Function(l) l.TenantId = tenantId)
            End If
            If Not String.IsNullOrWhiteSpace(filter.Search) Then
                Dim search = filter.Search
                q = q.Where(Function(l) l.Tenant.User.FullName.Contains(search) OrElse l.Unit.UnitNumber.Contains(search) OrElse l.Unit.Property.Name.Contains(search))
            End If

            Select Case filter.Status
                Case "terminated"
                    q = q.Where(Function(l) l.Status = LeaseStatus.Terminated)
                Case "upcoming"
                    q = q.Where(Function(l) l.Status <> LeaseStatus.Terminated AndAlso l.StartDate > today)
                Case "expired"
                    q = q.Where(Function(l) l.Status <> LeaseStatus.Terminated AndAlso l.EndDate < today)
                Case "active"
                    q = q.Where(Function(l) l.Status <> LeaseStatus.Terminated AndAlso l.StartDate <= today AndAlso l.EndDate >= today)
                Case "expiring"
                    Dim limit = today.AddDays(45)
                    q = q.Where(Function(l) l.Status = LeaseStatus.Active AndAlso l.EndDate >= today AndAlso l.EndDate <= limit)
            End Select
            Return ListPagedAsync(q, today, New PageQuery(filter.Page, filter.PageSize), ct)
        End Function

        Private Async Function ListPagedAsync(q As IQueryable(Of Lease), today As DateOnly, page As PageQuery, ct As CancellationToken) As Task(Of PagedResult(Of LeaseListItem))
            Dim result = Await ProjectList(q.OrderByDescending(Function(l) l.StartDate).ThenByDescending(Function(l) l.Id), today).ToPagedAsync(page, ct)
            For Each item In result.Items
                WithDays(item, today)
            Next
            Return result
        End Function

        Private Shared Function WithDays(i As LeaseListItem, today As DateOnly) As LeaseListItem
            i.DaysToExpiry = i.EndDate.DayNumber - today.DayNumber
            Return i
        End Function

        Public Async Function GetAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of LeaseDetail) Implements ILeaseService.GetAsync
            Dim today = UtcToday
            Dim item = Await ProjectList(scope.Leases().AsNoTracking().Where(Function(l) l.Id = id), today).FirstOrDefaultAsync(ct)
            If item Is Nothing Then Throw New NotFoundException("Lease not found.")
            item = WithDays(item, today)
            Dim leaseRow = Await db.Leases.AsNoTracking().FirstAsync(Function(x) x.Id = id, ct)

            Dim versions = Await db.LeaseVersions.AsNoTracking().Where(Function(v) v.LeaseId = id).OrderByDescending(Function(v) v.VersionNo).
                Select(Function(v) New LeaseVersionDto With {
                    .VersionNo = v.VersionNo,
                    .StartDate = v.StartDate,
                    .EndDate = v.EndDate,
                    .MonthlyRent = v.MonthlyRent,
                    .SecurityDeposit = v.SecurityDeposit,
                    .ChangeReason = v.ChangeReason,
                    .CreatedAt = v.CreatedAt
                }).ToListAsync(ct)
            Dim renewals = Await db.LeaseRenewals.AsNoTracking().Where(Function(r) r.LeaseId = id).OrderByDescending(Function(r) r.CreatedAt).
                Select(Function(r) New RenewalDto With {
                    .Id = r.Id,
                    .LeaseId = r.LeaseId,
                    .RequestedEndDate = r.RequestedEndDate,
                    .ProposedRent = r.ProposedRent,
                    .Note = r.Note,
                    .Status = r.Status,
                    .CreatedAt = r.CreatedAt,
                    .DecidedAt = r.DecidedAt
                }).ToListAsync(ct)
            Dim deposit = Await scope.Deposits().AsNoTracking().Where(Function(d) d.LeaseId = id).
                Select(Function(d) New DepositDto With {
                    .Id = d.Id,
                    .LeaseId = d.LeaseId,
                    .Amount = d.Amount,
                    .ReceivedOn = d.ReceivedOn,
                    .Status = d.Status,
                    .RefundedAmount = d.RefundedAmount,
                    .RefundedOn = d.RefundedOn,
                    .DeductionReason = d.DeductionReason,
                    .TenantName = d.Lease.Tenant.User.FullName,
                    .UnitNumber = d.Lease.Unit.UnitNumber,
                    .PropertyName = d.Lease.Unit.Property.Name
                }).FirstOrDefaultAsync(ct)

            Return New LeaseDetail With {
                .Lease = item,
                .RentDueDay = leaseRow.RentDueDay,
                .LateFee = leaseRow.LateFee,
                .Terms = leaseRow.Terms,
                .ApplicationId = leaseRow.ApplicationId,
                .CreatedAt = leaseRow.CreatedAt,
                .Versions = versions,
                .Renewals = renewals,
                .Deposit = deposit
            }
        End Function

        Public Async Function CreateAsync(request As CreateLeaseRequest, Optional ct As CancellationToken = Nothing) As Task(Of LeaseDetail) Implements ILeaseService.CreateAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            If request.EndDate <= request.StartDate Then Throw New BusinessRuleException("The lease end date must be after the start date.")
            Dim applicationId = request.ApplicationId
            If Not Await scope.Applications().AnyAsync(Function(a) a.Id = applicationId, ct) Then Throw New NotFoundException("Application not found.")

            Dim leaseId = Await procs.CreateLeaseAsync(New CreateLeaseCommand With {
                .ApplicationId = request.ApplicationId,
                .StartDate = request.StartDate,
                .EndDate = request.EndDate,
                .MonthlyRent = request.MonthlyRent,
                .SecurityDeposit = request.SecurityDeposit,
                .RentDueDay = request.RentDueDay,
                .LateFee = request.LateFee,
                .Terms = request.Terms,
                .UserId = current.RequiredId()
            }, ct)   ' transaction + overlap trigger in MySQL
            Return Await GetAsync(leaseId, ct)
        End Function

        Public Async Function UpdateAsync(id As Long, request As UpdateLeaseRequest, Optional ct As CancellationToken = Nothing) As Task(Of LeaseDetail) Implements ILeaseService.UpdateAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim lease = Await scope.Leases().FirstOrDefaultAsync(Function(l) l.Id = id, ct)
            If lease Is Nothing Then Throw New NotFoundException("Lease not found.")
            If lease.Status <> LeaseStatus.Active Then Throw New BusinessRuleException("Only active leases can be edited.")
            If request.EndDate <= lease.StartDate Then Throw New BusinessRuleException("The lease end date must be after the start date.")

            lease.EndDate = request.EndDate
            lease.MonthlyRent = request.MonthlyRent
            lease.SecurityDeposit = request.SecurityDeposit
            lease.RentDueDay = CByte(request.RentDueDay)
            lease.LateFee = request.LateFee
            lease.Terms = request.Terms?.Trim()
            Await db.SaveChangesAsync(ct)   ' trg_leases_bu re-checks overlap; trg_leases_au writes the new lease_versions row
            Await audit.LogAsync("update", "lease_terms", id, ct:=ct)
            Return Await GetAsync(id, ct)
        End Function

        Public Async Function TerminateAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task Implements ILeaseService.TerminateAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            If Not Await scope.Leases().AnyAsync(Function(l) l.Id = id, ct) Then Throw New NotFoundException("Lease not found.")
            Await procs.TerminateLeaseAsync(id, current.RequiredId(), ct)
            Await audit.LogAsync("terminate", "lease", id, ct:=ct)
        End Function

        Public Async Function RequestRenewalAsync(leaseId As Long, request As RenewalRequest, Optional ct As CancellationToken = Nothing) As Task(Of RenewalDto) Implements ILeaseService.RequestRenewalAsync
            Dim tenantId = Await scope.RequireTenantProfileIdAsync(ct)
            Dim lease = Await db.Leases.AsNoTracking().FirstOrDefaultAsync(Function(l) l.Id = leaseId AndAlso l.TenantId = tenantId, ct)
            If lease Is Nothing Then Throw New NotFoundException("Lease not found.")
            If lease.Status <> LeaseStatus.Active OrElse lease.EndDate < UtcToday Then Throw New BusinessRuleException("Only an active lease can be renewed.")
            If request.RequestedEndDate <= lease.EndDate Then Throw New BusinessRuleException("The new end date must be after the current end date.")
            If Await db.LeaseRenewals.AnyAsync(Function(x) x.LeaseId = leaseId AndAlso x.Status = RenewalStatus.Pending, ct) Then
                Throw New ConflictException("A renewal request is already pending for this lease.")
            End If

            Dim renewal As New LeaseRenewal With {
                .LeaseId = leaseId,
                .RequestedBy = current.RequiredId(),
                .RequestedEndDate = request.RequestedEndDate,
                .ProposedRent = request.ProposedRent,
                .Note = request.Note?.Trim()
            }
            db.LeaseRenewals.Add(renewal)
            Await db.SaveChangesAsync(ct)

            ' tell the people who run the property
            Dim leaseUnitId = lease.UnitId
            Dim owners = Await db.Units.Where(Function(u) u.Id = leaseUnitId).
                Select(Function(u) New With {Key .UnitNumber = u.UnitNumber, Key .OwnerId = u.Property.OwnerId, Key .ManagerId = u.Property.ManagerId}).FirstAsync(ct)
            Dim managerId As Long = If(owners.ManagerId, 0L)
            Dim recipients = New Long() {owners.OwnerId, managerId}.Where(Function(x) x > 0).Distinct().ToList()
            For Each recipient In recipients
                db.Notifications.Add(New Notification With {
                    .UserId = recipient,
                    .Type = "renewal_request",
                    .Title = "Lease renewal requested",
                    .Message = $"A tenant asked to extend the lease for unit {owners.UnitNumber}.",
                    .Link = $"/app/leases/{leaseId}"
                })
            Next
            Await db.SaveChangesAsync(ct)
            Return New RenewalDto With {
                .Id = renewal.Id,
                .LeaseId = leaseId,
                .RequestedEndDate = renewal.RequestedEndDate,
                .ProposedRent = renewal.ProposedRent,
                .Note = renewal.Note,
                .Status = renewal.Status,
                .CreatedAt = renewal.CreatedAt
            }
        End Function

        Public Function ListRenewalsAsync(status As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of RenewalDto)) Implements ILeaseService.ListRenewalsAsync
            Dim leaseIds = scope.Leases().Select(Function(l) l.Id)
            Dim q = db.LeaseRenewals.AsNoTracking().Where(Function(r) leaseIds.Contains(r.LeaseId))
            If Not String.IsNullOrWhiteSpace(status) Then q = q.Where(Function(r) r.Status = status)
            Return q.OrderByDescending(Function(r) r.CreatedAt).
                Select(Function(r) New RenewalDto With {
                    .Id = r.Id,
                    .LeaseId = r.LeaseId,
                    .RequestedEndDate = r.RequestedEndDate,
                    .ProposedRent = r.ProposedRent,
                    .Note = r.Note,
                    .Status = r.Status,
                    .CreatedAt = r.CreatedAt,
                    .DecidedAt = r.DecidedAt,
                    .UnitNumber = r.Lease.Unit.UnitNumber,
                    .PropertyName = r.Lease.Unit.Property.Name,
                    .TenantName = r.Lease.Tenant.User.FullName
                }).ToPagedAsync(page, ct)
        End Function

        Public Async Function DecideRenewalAsync(renewalId As Long, request As DecideRenewalRequest, Optional ct As CancellationToken = Nothing) As Task(Of LeaseDetail) Implements ILeaseService.DecideRenewalAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim renewal = Await db.LeaseRenewals.FirstOrDefaultAsync(Function(x) x.Id = renewalId, ct)
            If renewal Is Nothing Then Throw New NotFoundException()
            Dim renewalLeaseId = renewal.LeaseId
            Dim lease = Await scope.Leases().FirstOrDefaultAsync(Function(l) l.Id = renewalLeaseId, ct)
            If lease Is Nothing Then Throw New ForbiddenException()
            If renewal.Status <> RenewalStatus.Pending Then Throw New BusinessRuleException("This renewal has already been decided.")

            renewal.Status = If(request.Approve, RenewalStatus.Approved, RenewalStatus.Rejected)
            renewal.DecidedBy = current.RequiredId()
            renewal.DecidedAt = DateTime.UtcNow
            If request.Approve Then
                lease.EndDate = renewal.RequestedEndDate
                If renewal.ProposedRent.HasValue Then lease.MonthlyRent = renewal.ProposedRent.Value
            End If
            Await db.SaveChangesAsync(ct)

            Dim leaseTenantId = lease.TenantId
            Dim tenantUserId = Await db.TenantProfiles.Where(Function(t) t.Id = leaseTenantId).Select(Function(t) t.UserId).FirstAsync(ct)
            db.Notifications.Add(New Notification With {
                .UserId = tenantUserId,
                .Type = "renewal_decision",
                .Title = $"Renewal {renewal.Status}",
                .Message = If(request.Approve, $"Your lease now runs until {lease.EndDate.ToString("dd MMM yyyy")}.", "Your renewal request was declined."),
                .Link = $"/app/leases/{lease.Id}"
            })
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync(renewal.Status, "lease_renewal", renewalId, ct:=ct)
            Return Await GetAsync(lease.Id, ct)
        End Function

        Private Function ProjectList(q As IQueryable(Of Lease), today As DateOnly) As IQueryable(Of LeaseListItem)
            Return q.Select(Function(l) New LeaseListItem With {
                .Id = l.Id,
                .UnitId = l.UnitId,
                .UnitNumber = l.Unit.UnitNumber,
                .PropertyId = l.Unit.PropertyId,
                .PropertyName = l.Unit.Property.Name,
                .TenantId = l.TenantId,
                .TenantName = l.Tenant.User.FullName,
                .StartDate = l.StartDate,
                .EndDate = l.EndDate,
                .MonthlyRent = l.MonthlyRent,
                .SecurityDeposit = l.SecurityDeposit,
                .Status = If(l.Status = LeaseStatus.Terminated, "terminated",
                             If(today < l.StartDate, "upcoming",
                                If(today > l.EndDate, "expired", "active"))),
                .DaysToExpiry = 0,   ' filled in by WithDays() after materialisation (DateOnly arithmetic is not translated to SQL)
                .Outstanding = If(db.Invoices.Where(Function(i) i.LeaseId = l.Id AndAlso i.Status <> InvoiceStatus.Cancelled).
                                  Sum(Function(i) CType(i.Amount + i.LateFee - i.AmountPaid, Decimal?)), 0D),
                .RenewalPending = db.LeaseRenewals.Any(Function(r) r.LeaseId = l.Id AndAlso r.Status = RenewalStatus.Pending)
            })
        End Function

    End Class

End Namespace
