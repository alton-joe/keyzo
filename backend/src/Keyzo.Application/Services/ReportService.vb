Imports Keyzo.Application.Security
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class MonthPoint
        Public Property Month As String
        Public Property Billed As Decimal
        Public Property Collected As Decimal
    End Class

    Public Class NamedValue
        Public Property Name As String
        Public Property Value As Decimal
    End Class

    Public Class OccupancyPoint
        Public Property PropertyId As Long
        Public Property [Property] As String
        Public Property TotalUnits As Integer
        Public Property OccupiedUnits As Integer
        Public Property OccupancyPct As Decimal
    End Class

    Public Class OperatorStats
        Public Property Properties As Integer
        Public Property Units As Integer
        Public Property OccupiedUnits As Integer
        Public Property OccupancyPct As Decimal
        Public Property ActiveLeases As Integer
        Public Property ExpiringLeases As Integer
        Public Property PendingApplications As Integer
        Public Property OpenMaintenance As Integer
        Public Property UrgentMaintenance As Integer
        Public Property CollectedThisMonth As Decimal
        Public Property BilledThisMonth As Decimal
        Public Property Outstanding As Decimal
        Public Property OverdueInvoices As Integer
        Public Property ExpensesThisMonth As Decimal
    End Class

    Public Class TenantActiveLease
        Public Property LeaseId As Long
        Public Property UnitNumber As String
        Public Property PropertyName As String
        Public Property MonthlyRent As Decimal
        Public Property EndDate As DateOnly
        Public Property DaysToExpiry As Integer
    End Class

    Public Class TenantStats
        Public Property ActiveLease As TenantActiveLease
        Public Property NextInvoice As InvoiceDto
        Public Property Outstanding As Decimal
        Public Property OpenRequests As Integer
        Public Property PendingApplications As Integer
    End Class

    Public Class StaffStats
        Public Property Assigned As Integer
        Public Property InProgress As Integer
        Public Property CompletedThisMonth As Integer
        Public Property Urgent As Integer
    End Class

    ''' <summary>System-wide numbers only the fixed administrators see (on top of the operator figures).</summary>
    Public Class AdminStats
        Public Property TotalUsers As Integer
        Public Property ActiveUsers As Integer
        Public Property InactiveUsers As Integer
        Public Property NewUsersThisMonth As Integer
        Public Property Administrators As Integer
        Public Property UsersByRole As IReadOnlyList(Of NamedValue) = New List(Of NamedValue)()
        Public Property AuditEventsToday As Integer
        Public Property RecentActivity As IReadOnlyList(Of AuditLogDto) = New List(Of AuditLogDto)()
    End Class

    Public Class DashboardDto
        Public Property View As String
        Public Property Admin As AdminStats
        Public Property [Operator] As OperatorStats
        Public Property Tenant As TenantStats
        Public Property Staff As StaffStats
        Public Property RentByMonth As IReadOnlyList(Of MonthPoint) = New List(Of MonthPoint)()
        Public Property Occupancy As IReadOnlyList(Of OccupancyPoint) = New List(Of OccupancyPoint)()
        Public Property ExpensesByCategory As IReadOnlyList(Of NamedValue) = New List(Of NamedValue)()
        Public Property MaintenanceByStatus As IReadOnlyList(Of NamedValue) = New List(Of NamedValue)()
    End Class

    Public Class IncomeRow
        Public Property Month As String
        Public Property Billed As Decimal
        Public Property Collected As Decimal
        Public Property Outstanding As Decimal
        Public Property Expenses As Decimal
        Public Property Net As Decimal
    End Class

    Public Class PropertyIncomeRow
        Public Property PropertyId As Long
        Public Property [Property] As String
        Public Property Billed As Decimal
        Public Property Collected As Decimal
        Public Property Outstanding As Decimal
        Public Property Expenses As Decimal
        Public Property Net As Decimal
    End Class

    Public Class IncomeReport
        Public Property Months As IReadOnlyList(Of IncomeRow)
        Public Property Properties As IReadOnlyList(Of PropertyIncomeRow)
        Public Property Totals As IncomeRow
    End Class

    Public Class OutstandingRow
        Public Property InvoiceId As Long
        Public Property InvoiceNumber As String
        Public Property DueDate As DateOnly
        Public Property Balance As Decimal
        Public Property DaysOverdue As Integer
        Public Property [Property] As String
        Public Property Unit As String
        Public Property TenantId As Long
        Public Property Tenant As String
    End Class

    Public Class ExpenseReport
        Public Property ByCategory As IReadOnlyList(Of NamedValue)
        Public Property ByProperty As IReadOnlyList(Of NamedValue)
        Public Property ByMonth As IReadOnlyList(Of NamedValue)
        Public Property Total As Decimal
    End Class

    Public Class TenantReport
        Public Property TenantId As Long
        Public Property Name As String
        Public Property Email As String
        Public Property Leases As Integer
        Public Property Billed As Decimal
        Public Property Paid As Decimal
        Public Property Outstanding As Decimal
        Public Property MaintenanceRequests As Integer
        Public Property LeaseHistory As IReadOnlyList(Of LeaseListItem)
        Public Property RecentPayments As IReadOnlyList(Of PaymentDto)
    End Class

    Public Class PropertyReport
        Public Property PropertyId As Long
        Public Property Name As String
        Public Property City As String
        Public Property Units As Integer
        Public Property OccupiedUnits As Integer
        Public Property OccupancyPct As Decimal
        Public Property ActiveLeases As Integer
        Public Property CollectedLast12Months As Decimal
        Public Property ExpensesLast12Months As Decimal
        Public Property Outstanding As Decimal
        Public Property OpenMaintenance As Integer
        Public Property RentByMonth As IReadOnlyList(Of MonthPoint)
    End Class

    Public Interface IReportService
        Function DashboardAsync(Optional ct As CancellationToken = Nothing) As Task(Of DashboardDto)
        Function IncomeAsync(fromDate As DateOnly?, toDate As DateOnly?, propertyId As Long?, Optional ct As CancellationToken = Nothing) As Task(Of IncomeReport)
        Function OccupancyAsync(Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of OccupancyPoint))
        Function OutstandingAsync(propertyId As Long?, Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of OutstandingRow))
        Function ExpensesAsync(fromDate As DateOnly?, toDate As DateOnly?, propertyId As Long?, Optional ct As CancellationToken = Nothing) As Task(Of ExpenseReport)
        Function TenantAsync(tenantId As Long, Optional ct As CancellationToken = Nothing) As Task(Of TenantReport)
        Function PropertyAsync(propertyId As Long, Optional ct As CancellationToken = Nothing) As Task(Of PropertyReport)
    End Interface

    Public NotInheritable Class ReportService
        Implements IReportService

        Private ReadOnly db As IAppDbContext
        Private ReadOnly scope As IAccessScope
        Private ReadOnly current As ICurrentUser

        Public Sub New(db As IAppDbContext, scope As IAccessScope, current As ICurrentUser)
            Me.db = db
            Me.scope = scope
            Me.current = current
        End Sub

        Private Shared ReadOnly Property UtcToday As DateOnly
            Get
                Return DateOnly.FromDateTime(DateTime.UtcNow)
            End Get
        End Property

        Private Shared Function FirstOf(d As DateOnly) As DateOnly
            Return New DateOnly(d.Year, d.Month, 1)
        End Function

        Private Shared Function MonthKey(d As DateOnly) As String
            Return d.ToString("yyyy-MM")
        End Function

        ' the reporting views carry owner_id / manager_id so the same visibility rules apply to them
        Private Function Billing() As IQueryable(Of MonthlyBillingRow)
            Dim me_ = If(current.Id.HasValue, current.Id.Value, -1L)
            Dim isAdmin = current.IsAdmin()
            Dim isOwner = current.IsOwner()
            Dim isManager = current.IsManager()
            Return db.MonthlyBilling.AsNoTracking().Where(Function(v) isAdmin OrElse
                (isOwner AndAlso v.OwnerId = me_) OrElse
                (isManager AndAlso v.ManagerId.HasValue AndAlso v.ManagerId.Value = me_))
        End Function

        Private Function OccupancyRows() As IQueryable(Of PropertyOccupancyRow)
            Dim me_ = If(current.Id.HasValue, current.Id.Value, -1L)
            Dim isAdmin = current.IsAdmin()
            Dim isOwner = current.IsOwner()
            Dim isManager = current.IsManager()
            Return db.PropertyOccupancy.AsNoTracking().Where(Function(v) isAdmin OrElse
                (isOwner AndAlso v.OwnerId = me_) OrElse
                (isManager AndAlso v.ManagerId.HasValue AndAlso v.ManagerId.Value = me_))
        End Function

        Private Function OverdueRows() As IQueryable(Of OverdueInvoiceRow)
            Dim me_ = If(current.Id.HasValue, current.Id.Value, -1L)
            Dim isAdmin = current.IsAdmin()
            Dim isOwner = current.IsOwner()
            Dim isManager = current.IsManager()
            Return db.OverdueInvoices.AsNoTracking().Where(Function(v) isAdmin OrElse
                (isOwner AndAlso v.OwnerId = me_) OrElse
                (isManager AndAlso v.ManagerId.HasValue AndAlso v.ManagerId.Value = me_))
        End Function

        Private Shared Function LastMonths(count As Integer) As List(Of DateOnly)
            Dim first = FirstOf(UtcToday)
            Return Enumerable.Range(0, count).Select(Function(i) first.AddMonths(-(count - 1 - i))).ToList()
        End Function

        Private Shared Function RentSeries(months As List(Of DateOnly), billing As List(Of MonthlyBillingRow)) As List(Of MonthPoint)
            Return months.Select(Function(m) New MonthPoint With {
                .Month = MonthKey(m),
                .Billed = billing.Where(Function(b) b.PeriodMonth = m).Sum(Function(b) b.Billed),
                .Collected = billing.Where(Function(b) b.PeriodMonth = m).Sum(Function(b) b.Collected)
            }).ToList()
        End Function

        ' ------------------------------------------------------------------ dashboard
        Public Async Function DashboardAsync(Optional ct As CancellationToken = Nothing) As Task(Of DashboardDto) Implements IReportService.DashboardAsync
            If current.IsAdmin() Then Return Await AdminDashboardAsync(ct)
            If current.IsOperator() Then Return Await OperatorDashboardAsync(ct)
            If current.IsTenant() Then Return Await TenantDashboardAsync(ct)
            If current.IsStaff() Then Return Await StaffDashboardAsync(ct)
            Throw New ForbiddenException()
        End Function

        Private Async Function OperatorDashboardAsync(ct As CancellationToken) As Task(Of DashboardDto)
            Dim today = UtcToday
            Dim monthStart = FirstOf(today)
            Dim monthStartDt = monthStart.ToDateTime(TimeOnly.MinValue)

            Dim props = scope.Properties().Where(Function(p) p.IsActive)
            Dim units = scope.Units().Where(Function(u) u.Property.IsActive AndAlso u.Status <> UnitStatus.Inactive)
            Dim leases = scope.Leases().Where(Function(l) l.Status = LeaseStatus.Active AndAlso l.StartDate <= today AndAlso l.EndDate >= today)
            Dim expiryLimit = today.AddDays(45)
            Dim openRequests = scope.MaintenanceRequests().Where(Function(r) r.Status <> MaintenanceStatus.Completed AndAlso r.Status <> MaintenanceStatus.Cancelled)

            Dim stats As New OperatorStats()
            stats.Properties = Await props.CountAsync(ct)
            stats.Units = Await units.CountAsync(ct)
            stats.OccupiedUnits = Await units.CountAsync(Function(u) u.Status = UnitStatus.Occupied, ct)
            stats.ActiveLeases = Await leases.CountAsync(ct)
            stats.ExpiringLeases = Await leases.CountAsync(Function(l) l.EndDate <= expiryLimit, ct)
            stats.PendingApplications = Await scope.Applications().CountAsync(Function(a) a.Status = ApplicationStatus.Pending, ct)
            stats.OpenMaintenance = Await openRequests.CountAsync(ct)
            stats.UrgentMaintenance = Await openRequests.CountAsync(Function(r) r.Priority = "urgent", ct)
            stats.CollectedThisMonth = If(Await scope.Payments().Where(Function(p) p.PaidAt >= monthStartDt).SumAsync(Function(p) CType(p.Amount, Decimal?), ct), 0D)
            stats.BilledThisMonth = If(Await scope.Invoices().Where(Function(i) i.PeriodMonth = monthStart AndAlso i.Status <> InvoiceStatus.Cancelled).
                                       SumAsync(Function(i) CType(i.Amount + i.LateFee, Decimal?), ct), 0D)
            stats.Outstanding = If(Await scope.Invoices().Where(Function(i) i.Status <> InvoiceStatus.Cancelled AndAlso i.DueDate < today).
                                   SumAsync(Function(i) CType(i.Amount + i.LateFee - i.AmountPaid, Decimal?), ct), 0D)
            stats.OverdueInvoices = Await scope.Invoices().CountAsync(Function(i) i.Status <> InvoiceStatus.Cancelled AndAlso i.DueDate < today AndAlso i.Amount + i.LateFee > i.AmountPaid, ct)
            stats.ExpensesThisMonth = If(Await scope.Expenses().Where(Function(e) e.ExpenseDate >= monthStart).SumAsync(Function(e) CType(e.Amount, Decimal?), ct), 0D)
            stats.OccupancyPct = If(stats.Units = 0, 0D, Math.Round(100D * stats.OccupiedUnits / stats.Units, 1))

            Dim months = LastMonths(6)
            Dim firstMonth = months(0)
            Dim billingRows = Await Billing().Where(Function(b) b.PeriodMonth >= firstMonth).ToListAsync(ct)
            Dim rent = RentSeries(months, billingRows)

            Dim occupancy = (Await OccupancyAsync(ct)).Take(8).ToList()
            Dim expenseByCategory = Await scope.Expenses().Where(Function(e) e.ExpenseDate >= firstMonth).GroupBy(Function(e) e.Category).
                Select(Function(g) New NamedValue With {.Name = g.Key, .Value = g.Sum(Function(x) x.Amount)}).ToListAsync(ct)
            Dim maintByStatus = Await scope.MaintenanceRequests().GroupBy(Function(r) r.Status).
                Select(Function(g) New NamedValue With {.Name = g.Key, .Value = g.Count()}).ToListAsync(ct)
            Return New DashboardDto With {
                .View = "operator",
                .[Operator] = stats,
                .RentByMonth = rent,
                .Occupancy = occupancy,
                .ExpensesByCategory = expenseByCategory,
                .MaintenanceByStatus = maintByStatus
            }
        End Function

        Private Async Function AdminDashboardAsync(ct As CancellationToken) As Task(Of DashboardDto)
            ' admins see everything, so the operator dashboard (already unscoped for them) is the base
            Dim dash = Await OperatorDashboardAsync(ct)
            dash.View = "admin"

            Dim monthStart = FirstOf(UtcToday).ToDateTime(TimeOnly.MinValue)
            Dim dayStart = DateTime.UtcNow.Date
            Dim stats As New AdminStats()
            stats.TotalUsers = Await db.Users.CountAsync(ct)
            stats.ActiveUsers = Await db.Users.CountAsync(Function(u) u.IsActive, ct)
            stats.InactiveUsers = stats.TotalUsers - stats.ActiveUsers
            stats.NewUsersThisMonth = Await db.Users.CountAsync(Function(u) u.CreatedAt >= monthStart, ct)
            stats.AuditEventsToday = Await db.AuditLogs.CountAsync(Function(a) a.CreatedAt >= dayStart, ct)

            ' SuperAdmin is decided by the fixed email list, not by stored role rows
            Dim adminEmails = Roles.AdminEmails.ToList()
            stats.Administrators = Await db.Users.CountAsync(Function(u) adminEmails.Contains(u.Email), ct)
            Dim byRole = Await db.UserRoles.Where(Function(ur) ur.Role.Name <> Roles.SuperAdmin).GroupBy(Function(ur) ur.Role.Name).
                Select(Function(g) New NamedValue With {.Name = g.Key, .Value = g.Count()}).ToListAsync(ct)
            byRole.Insert(0, New NamedValue With {.Name = Roles.SuperAdmin, .Value = stats.Administrators})
            stats.UsersByRole = byRole

            stats.RecentActivity = Await db.AuditLogs.AsNoTracking().OrderByDescending(Function(a) a.CreatedAt).ThenByDescending(Function(a) a.Id).Take(8).
                Select(Function(a) New AuditLogDto With {
                    .Id = a.Id, .UserId = a.UserId,
                    .UserName = If(a.User IsNot Nothing, a.User.FullName, Nothing),
                    .Action = a.Action, .Entity = a.Entity, .EntityId = a.EntityId, .Details = a.Details, .CreatedAt = a.CreatedAt
                }).ToListAsync(ct)
            dash.Admin = stats
            Return dash
        End Function

        Private Async Function TenantDashboardAsync(ct As CancellationToken) As Task(Of DashboardDto)
            Dim today = UtcToday
            Dim tenantId = Await scope.RequireTenantProfileIdAsync(ct)
            Dim lease = Await db.Leases.AsNoTracking().Where(Function(l) l.TenantId = tenantId AndAlso l.Status = LeaseStatus.Active AndAlso l.StartDate <= today AndAlso l.EndDate >= today).
                Select(Function(l) New With {
                    Key .Id = l.Id,
                    Key .UnitNumber = l.Unit.UnitNumber,
                    Key .PropertyName = l.Unit.Property.Name,
                    Key .MonthlyRent = l.MonthlyRent,
                    Key .EndDate = l.EndDate
                }).FirstOrDefaultAsync(ct)

            Dim nextInvoice = Await BillingService.ProjectInvoices(
                scope.Invoices().AsNoTracking().
                    Where(Function(i) i.Lease.TenantId = tenantId AndAlso i.Status <> InvoiceStatus.Cancelled AndAlso i.Status <> InvoiceStatus.Paid).
                    OrderBy(Function(i) i.DueDate)).FirstOrDefaultAsync(ct)
            If nextInvoice IsNot Nothing Then BillingService.Effective(nextInvoice, today)

            Dim dueLimit = today.AddDays(31)
            Dim outstanding = If(Await scope.Invoices().Where(Function(i) i.Lease.TenantId = tenantId AndAlso i.Status <> InvoiceStatus.Cancelled AndAlso i.DueDate <= dueLimit).
                                 SumAsync(Function(i) CType(i.Amount + i.LateFee - i.AmountPaid, Decimal?), ct), 0D)
            Dim openRequests = Await scope.MaintenanceRequests().CountAsync(Function(r) r.TenantId = tenantId AndAlso r.Status <> MaintenanceStatus.Completed AndAlso r.Status <> MaintenanceStatus.Cancelled, ct)
            Dim pendingApps = Await scope.Applications().CountAsync(Function(a) a.TenantId = tenantId AndAlso a.Status = ApplicationStatus.Pending, ct)

            Dim months = LastMonths(6)
            Dim firstMonth = months(0)
            Dim rows = Await scope.Invoices().Where(Function(i) i.Lease.TenantId = tenantId AndAlso i.PeriodMonth >= firstMonth AndAlso i.Status <> InvoiceStatus.Cancelled).
                Select(Function(i) New With {Key .PeriodMonth = i.PeriodMonth, Key .Billed = i.Amount + i.LateFee, Key .Paid = i.AmountPaid}).ToListAsync(ct)
            Dim rent = months.Select(Function(m) New MonthPoint With {
                .Month = MonthKey(m),
                .Billed = rows.Where(Function(r) r.PeriodMonth = m).Sum(Function(r) r.Billed),
                .Collected = rows.Where(Function(r) r.PeriodMonth = m).Sum(Function(r) r.Paid)
            }).ToList()

            Dim active As TenantActiveLease = Nothing
            If lease IsNot Nothing Then
                active = New TenantActiveLease With {
                    .LeaseId = lease.Id,
                    .UnitNumber = lease.UnitNumber,
                    .PropertyName = lease.PropertyName,
                    .MonthlyRent = lease.MonthlyRent,
                    .EndDate = lease.EndDate,
                    .DaysToExpiry = lease.EndDate.DayNumber - today.DayNumber
                }
            End If
            Dim maint = Await scope.MaintenanceRequests().Where(Function(r) r.TenantId = tenantId).GroupBy(Function(r) r.Status).
                Select(Function(g) New NamedValue With {.Name = g.Key, .Value = g.Count()}).ToListAsync(ct)
            Return New DashboardDto With {
                .View = "tenant",
                .Tenant = New TenantStats With {
                    .ActiveLease = active,
                    .NextInvoice = nextInvoice,
                    .Outstanding = outstanding,
                    .OpenRequests = openRequests,
                    .PendingApplications = pendingApps
                },
                .RentByMonth = rent,
                .MaintenanceByStatus = maint
            }
        End Function

        Private Async Function StaffDashboardAsync(ct As CancellationToken) As Task(Of DashboardDto)
            Dim uid = current.RequiredId()
            Dim monthStart = FirstOf(UtcToday).ToDateTime(TimeOnly.MinValue)
            Dim mine = scope.MaintenanceRequests().Where(Function(r) r.Assignments.Any(Function(a) a.StaffId = uid AndAlso a.IsCurrent))
            Dim stats As New StaffStats()
            stats.Assigned = Await mine.CountAsync(Function(r) r.Status = MaintenanceStatus.Assigned, ct)
            stats.InProgress = Await mine.CountAsync(Function(r) r.Status = MaintenanceStatus.InProgress, ct)
            stats.CompletedThisMonth = Await mine.CountAsync(Function(r) r.Status = MaintenanceStatus.Completed AndAlso r.CompletedAt.HasValue AndAlso r.CompletedAt.Value >= monthStart, ct)
            stats.Urgent = Await mine.CountAsync(Function(r) r.Priority = "urgent" AndAlso r.Status <> MaintenanceStatus.Completed AndAlso r.Status <> MaintenanceStatus.Cancelled, ct)
            Dim maint = Await mine.GroupBy(Function(r) r.Status).Select(Function(g) New NamedValue With {.Name = g.Key, .Value = g.Count()}).ToListAsync(ct)
            Return New DashboardDto With {.View = "staff", .Staff = stats, .MaintenanceByStatus = maint}
        End Function

        ' ------------------------------------------------------------------ reports
        Public Async Function IncomeAsync(fromDate As DateOnly?, toDate As DateOnly?, propertyId As Long?, Optional ct As CancellationToken = Nothing) As Task(Of IncomeReport) Implements IReportService.IncomeAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim endMonth = FirstOf(If(toDate, UtcToday))
            Dim startMonth = FirstOf(If(fromDate, endMonth.AddMonths(-5)))
            If startMonth > endMonth Then Throw New BusinessRuleException("The start month must not be after the end month.")
            If endMonth.DayNumber - startMonth.DayNumber > 800 Then Throw New BusinessRuleException("Please choose a range of at most 24 months.")

            Dim endExclusive = endMonth.AddMonths(1)
            Dim billingQuery = Billing().Where(Function(v) v.PeriodMonth >= startMonth AndAlso v.PeriodMonth <= endMonth)
            Dim expenseQuery = scope.Expenses().Where(Function(x) x.ExpenseDate >= startMonth AndAlso x.ExpenseDate < endExclusive)
            If propertyId.HasValue Then
                Dim pid = propertyId.Value
                billingQuery = billingQuery.Where(Function(v) v.PropertyId = pid)
                expenseQuery = expenseQuery.Where(Function(x) x.PropertyId = pid)
            End If

            Dim billingRows = Await billingQuery.ToListAsync(ct)
            Dim expenseRows = Await expenseQuery.Select(Function(x) New With {Key .PropertyId = x.PropertyId, Key .ExpenseDate = x.ExpenseDate, Key .Amount = x.Amount}).ToListAsync(ct)

            Dim months As New List(Of IncomeRow)()
            Dim cursor = startMonth
            Do While cursor <= endMonth
                Dim monthStart = cursor
                Dim billed = billingRows.Where(Function(x) x.PeriodMonth = monthStart).Sum(Function(x) x.Billed)
                Dim collected = billingRows.Where(Function(x) x.PeriodMonth = monthStart).Sum(Function(x) x.Collected)
                Dim outstanding = billingRows.Where(Function(x) x.PeriodMonth = monthStart).Sum(Function(x) x.Outstanding)
                Dim spent = expenseRows.Where(Function(x) x.ExpenseDate.Year = monthStart.Year AndAlso x.ExpenseDate.Month = monthStart.Month).Sum(Function(x) x.Amount)
                months.Add(New IncomeRow With {
                    .Month = MonthKey(monthStart),
                    .Billed = billed,
                    .Collected = collected,
                    .Outstanding = outstanding,
                    .Expenses = spent,
                    .Net = collected - spent
                })
                cursor = cursor.AddMonths(1)
            Loop

            Dim names = Await scope.Properties().Select(Function(p) New With {Key .Id = p.Id, Key .Name = p.Name}).ToDictionaryAsync(Function(p) p.Id, Function(p) p.Name, ct)
            Dim props As New List(Of PropertyIncomeRow)()
            For Each g In billingRows.GroupBy(Function(x) x.PropertyId)
                Dim groupKey = g.Key
                Dim spent = expenseRows.Where(Function(x) x.PropertyId = groupKey).Sum(Function(x) x.Amount)
                Dim collected = g.Sum(Function(x) x.Collected)
                Dim propertyName As String = Nothing
                If Not names.TryGetValue(groupKey, propertyName) Then propertyName = "Property"
                props.Add(New PropertyIncomeRow With {
                    .PropertyId = groupKey,
                    .[Property] = propertyName,
                    .Billed = g.Sum(Function(x) x.Billed),
                    .Collected = collected,
                    .Outstanding = g.Sum(Function(x) x.Outstanding),
                    .Expenses = spent,
                    .Net = collected - spent
                })
            Next
            props = props.OrderByDescending(Function(x) x.Collected).ToList()

            Dim totals As New IncomeRow With {
                .Month = "Total",
                .Billed = months.Sum(Function(x) x.Billed),
                .Collected = months.Sum(Function(x) x.Collected),
                .Outstanding = months.Sum(Function(x) x.Outstanding),
                .Expenses = months.Sum(Function(x) x.Expenses),
                .Net = months.Sum(Function(x) x.Net)
            }
            Return New IncomeReport With {.Months = months, .Properties = props, .Totals = totals}
        End Function

        Public Async Function OccupancyAsync(Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of OccupancyPoint)) Implements IReportService.OccupancyAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim rows = Await OccupancyRows().OrderByDescending(Function(r) r.OccupancyPct).ThenBy(Function(r) r.PropertyName).ToListAsync(ct)
            Return rows.Select(Function(r) New OccupancyPoint With {
                .PropertyId = r.PropertyId,
                .[Property] = r.PropertyName,
                .TotalUnits = CInt(r.TotalUnits),
                .OccupiedUnits = CInt(r.OccupiedUnits),
                .OccupancyPct = If(r.OccupancyPct, 0D)
            }).ToList()
        End Function

        Public Async Function OutstandingAsync(propertyId As Long?, Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of OutstandingRow)) Implements IReportService.OutstandingAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim q = OverdueRows()
            If propertyId.HasValue Then
                Dim pid = propertyId.Value
                q = q.Where(Function(r) r.PropertyId = pid)
            End If
            Dim rows = Await q.OrderByDescending(Function(r) r.DaysOverdue).ToListAsync(ct)
            Return rows.Select(Function(r) New OutstandingRow With {
                .InvoiceId = r.InvoiceId,
                .InvoiceNumber = r.InvoiceNumber,
                .DueDate = r.DueDate,
                .Balance = r.Balance,
                .DaysOverdue = r.DaysOverdue,
                .[Property] = r.PropertyName,
                .Unit = r.UnitNumber,
                .TenantId = r.TenantId,
                .Tenant = r.TenantName
            }).ToList()
        End Function

        Public Async Function ExpensesAsync(fromDate As DateOnly?, toDate As DateOnly?, propertyId As Long?, Optional ct As CancellationToken = Nothing) As Task(Of ExpenseReport) Implements IReportService.ExpensesAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim endDate = If(toDate, UtcToday)
            Dim startDate = If(fromDate, FirstOf(endDate).AddMonths(-5))
            Dim q = scope.Expenses().Where(Function(e) e.ExpenseDate >= startDate AndAlso e.ExpenseDate <= endDate)
            If propertyId.HasValue Then
                Dim pid = propertyId.Value
                q = q.Where(Function(e) e.PropertyId = pid)
            End If

            Dim rows = Await q.Select(Function(e) New With {
                Key .Category = e.Category,
                Key .PropertyName = e.Property.Name,
                Key .ExpenseDate = e.ExpenseDate,
                Key .Amount = e.Amount
            }).ToListAsync(ct)
            Return New ExpenseReport With {
                .ByCategory = rows.GroupBy(Function(r) r.Category).Select(Function(g) New NamedValue With {.Name = g.Key, .Value = g.Sum(Function(x) x.Amount)}).OrderByDescending(Function(x) x.Value).ToList(),
                .ByProperty = rows.GroupBy(Function(r) r.PropertyName).Select(Function(g) New NamedValue With {.Name = g.Key, .Value = g.Sum(Function(x) x.Amount)}).OrderByDescending(Function(x) x.Value).ToList(),
                .ByMonth = rows.GroupBy(Function(r) New DateOnly(r.ExpenseDate.Year, r.ExpenseDate.Month, 1)).OrderBy(Function(g) g.Key).
                    Select(Function(g) New NamedValue With {.Name = MonthKey(g.Key), .Value = g.Sum(Function(x) x.Amount)}).ToList(),
                .Total = rows.Sum(Function(r) r.Amount)
            }
        End Function

        Public Async Function TenantAsync(tenantId As Long, Optional ct As CancellationToken = Nothing) As Task(Of TenantReport) Implements IReportService.TenantAsync
            If Not Await scope.Tenants().AnyAsync(Function(t) t.Id = tenantId, ct) Then Throw New NotFoundException("Tenant not found.")
            Dim who = Await db.TenantProfiles.AsNoTracking().Where(Function(x) x.Id = tenantId).
                Select(Function(x) New With {Key .FullName = x.User.FullName, Key .Email = x.User.Email}).FirstAsync(ct)
            Dim today = UtcToday

            Dim invoices = scope.Invoices().Where(Function(i) i.Lease.TenantId = tenantId AndAlso i.Status <> InvoiceStatus.Cancelled)
            Dim billed = If(Await invoices.SumAsync(Function(i) CType(i.Amount + i.LateFee, Decimal?), ct), 0D)
            Dim paid = If(Await invoices.SumAsync(Function(i) CType(i.AmountPaid, Decimal?), ct), 0D)
            Dim requests = Await scope.MaintenanceRequests().CountAsync(Function(r) r.TenantId = tenantId, ct)

            Dim leases = Await scope.Leases().AsNoTracking().Where(Function(l) l.TenantId = tenantId).OrderByDescending(Function(l) l.StartDate).
                Select(Function(l) New LeaseListItem With {
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
                    .DaysToExpiry = 0,
                    .Outstanding = 0D,
                    .RenewalPending = False
                }).ToListAsync(ct)
            For Each item In leases
                item.DaysToExpiry = item.EndDate.DayNumber - today.DayNumber
            Next

            Dim payments = Await scope.Payments().AsNoTracking().Where(Function(p) p.Invoice.Lease.TenantId = tenantId).OrderByDescending(Function(p) p.PaidAt).Take(10).
                Select(Function(p) New PaymentDto With {
                    .Id = p.Id,
                    .InvoiceId = p.InvoiceId,
                    .InvoiceNumber = p.Invoice.InvoiceNumber,
                    .ReceiptNumber = p.ReceiptNumber,
                    .Amount = p.Amount,
                    .PaidAt = p.PaidAt,
                    .Method = p.Method,
                    .ReferenceNo = p.ReferenceNo,
                    .Note = p.Note,
                    .TenantName = p.Invoice.Lease.Tenant.User.FullName,
                    .UnitNumber = p.Invoice.Lease.Unit.UnitNumber,
                    .PropertyName = p.Invoice.Lease.Unit.Property.Name,
                    .RecordedBy = Nothing
                }).ToListAsync(ct)

            Return New TenantReport With {
                .TenantId = tenantId,
                .Name = who.FullName,
                .Email = who.Email,
                .Leases = leases.Count,
                .Billed = billed,
                .Paid = paid,
                .Outstanding = billed - paid,
                .MaintenanceRequests = requests,
                .LeaseHistory = leases,
                .RecentPayments = payments
            }
        End Function

        Public Async Function PropertyAsync(propertyId As Long, Optional ct As CancellationToken = Nothing) As Task(Of PropertyReport) Implements IReportService.PropertyAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim info = Await scope.Properties().AsNoTracking().Where(Function(x) x.Id = propertyId).
                Select(Function(x) New With {Key .Name = x.Name, Key .City = x.City}).FirstOrDefaultAsync(ct)
            If info Is Nothing Then Throw New NotFoundException("Property not found.")
            Dim today = UtcToday
            Dim months = LastMonths(12)
            Dim firstMonth = months(0)

            Dim occ = Await OccupancyRows().Where(Function(o) o.PropertyId = propertyId).FirstOrDefaultAsync(ct)
            Dim billingRows = Await Billing().Where(Function(b) b.PropertyId = propertyId AndAlso b.PeriodMonth >= firstMonth).ToListAsync(ct)
            Dim expenses = If(Await scope.Expenses().Where(Function(e) e.PropertyId = propertyId AndAlso e.ExpenseDate >= firstMonth).SumAsync(Function(e) CType(e.Amount, Decimal?), ct), 0D)
            Dim activeLeases = Await scope.Leases().CountAsync(Function(l) l.Unit.PropertyId = propertyId AndAlso l.Status = LeaseStatus.Active AndAlso l.StartDate <= today AndAlso l.EndDate >= today, ct)
            Dim openMaint = Await scope.MaintenanceRequests().CountAsync(Function(r) r.Unit.PropertyId = propertyId AndAlso r.Status <> MaintenanceStatus.Completed AndAlso r.Status <> MaintenanceStatus.Cancelled, ct)
            Dim rent = RentSeries(months, billingRows)

            Return New PropertyReport With {
                .PropertyId = propertyId,
                .Name = info.Name,
                .City = info.City,
                .Units = If(occ IsNot Nothing, CInt(occ.TotalUnits), 0),
                .OccupiedUnits = If(occ IsNot Nothing, CInt(occ.OccupiedUnits), 0),
                .OccupancyPct = If(occ IsNot Nothing, If(occ.OccupancyPct, 0D), 0D),
                .ActiveLeases = activeLeases,
                .CollectedLast12Months = billingRows.Sum(Function(b) b.Collected),
                .ExpensesLast12Months = expenses,
                .Outstanding = billingRows.Sum(Function(b) b.Outstanding),
                .OpenMaintenance = openMaint,
                .RentByMonth = rent
            }
        End Function
    End Class

End Namespace
