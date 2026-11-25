Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Security

    ''' <summary>
    ''' Row-level access rules (the application-layer counterpart of PostgreSQL RLS in the original synopsis).
    ''' Every service reads data through these scoped queries, so a role can never see rows outside its remit:
    '''  - SuperAdmin : everything
    '''  - Owner      : properties they own (and everything under them)
    '''  - Manager    : properties assigned to them
    '''  - Tenant     : their own applications, leases, invoices, requests
    '''  - Staff      : maintenance requests assigned to them
    ''' A user holding several roles gets the union of the rules.
    ''' </summary>
    Public Interface IAccessScope
        Function Properties() As IQueryable(Of [Property])
        Function Units() As IQueryable(Of PropertyUnit)
        Function Applications() As IQueryable(Of RentalApplication)
        Function Leases() As IQueryable(Of Lease)
        Function Invoices() As IQueryable(Of RentInvoice)
        Function Payments() As IQueryable(Of Payment)
        Function Deposits() As IQueryable(Of Deposit)
        Function MaintenanceRequests() As IQueryable(Of MaintenanceRequest)
        Function Expenses() As IQueryable(Of Expense)
        Function Tenants() As IQueryable(Of TenantProfile)
        Function RequireTenantProfileIdAsync(Optional ct As CancellationToken = Nothing) As Task(Of Long)
        ''' <summary>Throws Forbidden unless the user may manage (admin/owner/manager) the given property.</summary>
        Function EnsureCanManagePropertyAsync(propertyId As Long, Optional ct As CancellationToken = Nothing) As Task
    End Interface

    Public NotInheritable Class AccessScope
        Implements IAccessScope

        Private ReadOnly db As IAppDbContext
        Private ReadOnly currentUser As ICurrentUser

        Public Sub New(db As IAppDbContext, currentUser As ICurrentUser)
            Me.db = db
            Me.currentUser = currentUser
        End Sub

        Private ReadOnly Property Uid As Long
            Get
                If currentUser.Id.HasValue Then Return currentUser.Id.Value
                Return -1
            End Get
        End Property

        ' Note: comparisons against nullable columns are written as HasValue AndAlso Value = x
        ' because VB's lifted "=" returns Boolean? which cannot be used as an EF predicate.

        Public Function Properties() As IQueryable(Of [Property]) Implements IAccessScope.Properties
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Return db.Properties.Where(Function(p) isAdmin OrElse
                (isOwner AndAlso p.OwnerId = me_) OrElse
                (isManager AndAlso p.ManagerId.HasValue AndAlso p.ManagerId.Value = me_))
        End Function

        Public Function Units() As IQueryable(Of PropertyUnit) Implements IAccessScope.Units
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Return db.Units.Where(Function(u) isAdmin OrElse
                (isOwner AndAlso u.Property.OwnerId = me_) OrElse
                (isManager AndAlso u.Property.ManagerId.HasValue AndAlso u.Property.ManagerId.Value = me_))
        End Function

        Public Function Applications() As IQueryable(Of RentalApplication) Implements IAccessScope.Applications
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Dim isTenant = currentUser.IsTenant()
            Return db.Applications.Where(Function(a) isAdmin OrElse
                (isOwner AndAlso a.Unit.Property.OwnerId = me_) OrElse
                (isManager AndAlso a.Unit.Property.ManagerId.HasValue AndAlso a.Unit.Property.ManagerId.Value = me_) OrElse
                (isTenant AndAlso a.Tenant.UserId = me_))
        End Function

        Public Function Leases() As IQueryable(Of Lease) Implements IAccessScope.Leases
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Dim isTenant = currentUser.IsTenant()
            Return db.Leases.Where(Function(l) isAdmin OrElse
                (isOwner AndAlso l.Unit.Property.OwnerId = me_) OrElse
                (isManager AndAlso l.Unit.Property.ManagerId.HasValue AndAlso l.Unit.Property.ManagerId.Value = me_) OrElse
                (isTenant AndAlso l.Tenant.UserId = me_))
        End Function

        Public Function Invoices() As IQueryable(Of RentInvoice) Implements IAccessScope.Invoices
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Dim isTenant = currentUser.IsTenant()
            Return db.Invoices.Where(Function(i) isAdmin OrElse
                (isOwner AndAlso i.Lease.Unit.Property.OwnerId = me_) OrElse
                (isManager AndAlso i.Lease.Unit.Property.ManagerId.HasValue AndAlso i.Lease.Unit.Property.ManagerId.Value = me_) OrElse
                (isTenant AndAlso i.Lease.Tenant.UserId = me_))
        End Function

        Public Function Payments() As IQueryable(Of Payment) Implements IAccessScope.Payments
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Dim isTenant = currentUser.IsTenant()
            Return db.Payments.Where(Function(p) isAdmin OrElse
                (isOwner AndAlso p.Invoice.Lease.Unit.Property.OwnerId = me_) OrElse
                (isManager AndAlso p.Invoice.Lease.Unit.Property.ManagerId.HasValue AndAlso p.Invoice.Lease.Unit.Property.ManagerId.Value = me_) OrElse
                (isTenant AndAlso p.Invoice.Lease.Tenant.UserId = me_))
        End Function

        Public Function Deposits() As IQueryable(Of Deposit) Implements IAccessScope.Deposits
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Dim isTenant = currentUser.IsTenant()
            Return db.Deposits.Where(Function(d) isAdmin OrElse
                (isOwner AndAlso d.Lease.Unit.Property.OwnerId = me_) OrElse
                (isManager AndAlso d.Lease.Unit.Property.ManagerId.HasValue AndAlso d.Lease.Unit.Property.ManagerId.Value = me_) OrElse
                (isTenant AndAlso d.Lease.Tenant.UserId = me_))
        End Function

        Public Function MaintenanceRequests() As IQueryable(Of MaintenanceRequest) Implements IAccessScope.MaintenanceRequests
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Dim isTenant = currentUser.IsTenant()
            Dim isStaff = currentUser.IsStaff()
            Return db.MaintenanceRequests.Where(Function(r) isAdmin OrElse
                (isOwner AndAlso r.Unit.Property.OwnerId = me_) OrElse
                (isManager AndAlso r.Unit.Property.ManagerId.HasValue AndAlso r.Unit.Property.ManagerId.Value = me_) OrElse
                (isTenant AndAlso r.Tenant.UserId = me_) OrElse
                (isStaff AndAlso r.Assignments.Any(Function(a) a.StaffId = me_)))
        End Function

        Public Function Expenses() As IQueryable(Of Expense) Implements IAccessScope.Expenses
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Return db.Expenses.Where(Function(e) isAdmin OrElse
                (isOwner AndAlso e.Property.OwnerId = me_) OrElse
                (isManager AndAlso e.Property.ManagerId.HasValue AndAlso e.Property.ManagerId.Value = me_))
        End Function

        Public Function Tenants() As IQueryable(Of TenantProfile) Implements IAccessScope.Tenants
            Dim me_ = Uid
            Dim isAdmin = currentUser.IsAdmin()
            Dim isOwner = currentUser.IsOwner()
            Dim isManager = currentUser.IsManager()
            Dim isTenant = currentUser.IsTenant()
            ' operators see tenants who applied to / lease their properties
            Return db.TenantProfiles.Where(Function(t) isAdmin OrElse
                (isTenant AndAlso t.UserId = me_) OrElse
                ((isOwner OrElse isManager) AndAlso (
                    db.Leases.Any(Function(l) l.TenantId = t.Id AndAlso
                        ((isOwner AndAlso l.Unit.Property.OwnerId = me_) OrElse
                         (isManager AndAlso l.Unit.Property.ManagerId.HasValue AndAlso l.Unit.Property.ManagerId.Value = me_))) OrElse
                    db.Applications.Any(Function(a) a.TenantId = t.Id AndAlso
                        ((isOwner AndAlso a.Unit.Property.OwnerId = me_) OrElse
                         (isManager AndAlso a.Unit.Property.ManagerId.HasValue AndAlso a.Unit.Property.ManagerId.Value = me_))))))
        End Function

        Public Async Function RequireTenantProfileIdAsync(Optional ct As CancellationToken = Nothing) As Task(Of Long) Implements IAccessScope.RequireTenantProfileIdAsync
            Dim userId = currentUser.RequiredId()
            Dim id = Await db.TenantProfiles.Where(Function(t) t.UserId = userId).Select(Function(t) CType(t.Id, Long?)).FirstOrDefaultAsync(ct)
            If Not id.HasValue Then Throw New ForbiddenException("Only tenants have a tenant profile.")
            Return id.Value
        End Function

        Public Async Function EnsureCanManagePropertyAsync(propertyId As Long, Optional ct As CancellationToken = Nothing) As Task Implements IAccessScope.EnsureCanManagePropertyAsync
            If Not currentUser.IsOperator() Then Throw New ForbiddenException()
            Dim ok = Await Properties().AnyAsync(Function(p) p.Id = propertyId, ct)
            If Not ok Then Throw New ForbiddenException("You do not manage this property.")
        End Function

    End Class

End Namespace
