Imports Keyzo.Application
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore
Imports Microsoft.EntityFrameworkCore.Infrastructure
Imports Microsoft.EntityFrameworkCore.Storage.ValueConversion
Imports MySqlConnector

Namespace Persistence

    ''' <summary>
    ''' EF Core mapping onto the hand-written MySQL schema in /database (no EF migrations: the SQL scripts are the source of truth).
    ''' Column names come from the snake_case naming convention; table names are mapped explicitly below.
    ''' </summary>
    Public Class KeyzoDbContext
        Inherits DbContext
        Implements IAppDbContext

        Public Sub New(options As DbContextOptions(Of KeyzoDbContext))
            MyBase.New(options)
        End Sub

        Public ReadOnly Property Roles As DbSet(Of Role) Implements IAppDbContext.Roles
            Get
                Return [Set](Of Role)()
            End Get
        End Property
        Public ReadOnly Property Users As DbSet(Of User) Implements IAppDbContext.Users
            Get
                Return [Set](Of User)()
            End Get
        End Property
        Public ReadOnly Property UserRoles As DbSet(Of UserRole) Implements IAppDbContext.UserRoles
            Get
                Return [Set](Of UserRole)()
            End Get
        End Property
        Public ReadOnly Property RefreshTokens As DbSet(Of RefreshToken) Implements IAppDbContext.RefreshTokens
            Get
                Return [Set](Of RefreshToken)()
            End Get
        End Property
        Public ReadOnly Property Properties As DbSet(Of [Property]) Implements IAppDbContext.Properties
            Get
                Return [Set](Of [Property])()
            End Get
        End Property
        Public ReadOnly Property Units As DbSet(Of PropertyUnit) Implements IAppDbContext.Units
            Get
                Return [Set](Of PropertyUnit)()
            End Get
        End Property
        Public ReadOnly Property PropertyImages As DbSet(Of PropertyImage) Implements IAppDbContext.PropertyImages
            Get
                Return [Set](Of PropertyImage)()
            End Get
        End Property
        Public ReadOnly Property UnitTourStops As DbSet(Of UnitTourStop) Implements IAppDbContext.UnitTourStops
            Get
                Return [Set](Of UnitTourStop)()
            End Get
        End Property
        Public ReadOnly Property Amenities As DbSet(Of Amenity) Implements IAppDbContext.Amenities
            Get
                Return [Set](Of Amenity)()
            End Get
        End Property
        Public ReadOnly Property PropertyAmenities As DbSet(Of PropertyAmenity) Implements IAppDbContext.PropertyAmenities
            Get
                Return [Set](Of PropertyAmenity)()
            End Get
        End Property
        Public ReadOnly Property TenantProfiles As DbSet(Of TenantProfile) Implements IAppDbContext.TenantProfiles
            Get
                Return [Set](Of TenantProfile)()
            End Get
        End Property
        Public ReadOnly Property Applications As DbSet(Of RentalApplication) Implements IAppDbContext.Applications
            Get
                Return [Set](Of RentalApplication)()
            End Get
        End Property
        Public ReadOnly Property TenantDocuments As DbSet(Of TenantDocument) Implements IAppDbContext.TenantDocuments
            Get
                Return [Set](Of TenantDocument)()
            End Get
        End Property
        Public ReadOnly Property Leases As DbSet(Of Lease) Implements IAppDbContext.Leases
            Get
                Return [Set](Of Lease)()
            End Get
        End Property
        Public ReadOnly Property LeaseVersions As DbSet(Of LeaseVersion) Implements IAppDbContext.LeaseVersions
            Get
                Return [Set](Of LeaseVersion)()
            End Get
        End Property
        Public ReadOnly Property LeaseRenewals As DbSet(Of LeaseRenewal) Implements IAppDbContext.LeaseRenewals
            Get
                Return [Set](Of LeaseRenewal)()
            End Get
        End Property
        Public ReadOnly Property Invoices As DbSet(Of RentInvoice) Implements IAppDbContext.Invoices
            Get
                Return [Set](Of RentInvoice)()
            End Get
        End Property
        Public ReadOnly Property Payments As DbSet(Of Payment) Implements IAppDbContext.Payments
            Get
                Return [Set](Of Payment)()
            End Get
        End Property
        Public ReadOnly Property Deposits As DbSet(Of Deposit) Implements IAppDbContext.Deposits
            Get
                Return [Set](Of Deposit)()
            End Get
        End Property
        Public ReadOnly Property MaintenanceRequests As DbSet(Of MaintenanceRequest) Implements IAppDbContext.MaintenanceRequests
            Get
                Return [Set](Of MaintenanceRequest)()
            End Get
        End Property
        Public ReadOnly Property MaintenanceImages As DbSet(Of MaintenanceImage) Implements IAppDbContext.MaintenanceImages
            Get
                Return [Set](Of MaintenanceImage)()
            End Get
        End Property
        Public ReadOnly Property MaintenanceAssignments As DbSet(Of MaintenanceAssignment) Implements IAppDbContext.MaintenanceAssignments
            Get
                Return [Set](Of MaintenanceAssignment)()
            End Get
        End Property
        Public ReadOnly Property MaintenanceLogs As DbSet(Of MaintenanceLog) Implements IAppDbContext.MaintenanceLogs
            Get
                Return [Set](Of MaintenanceLog)()
            End Get
        End Property
        Public ReadOnly Property Expenses As DbSet(Of Expense) Implements IAppDbContext.Expenses
            Get
                Return [Set](Of Expense)()
            End Get
        End Property
        Public ReadOnly Property Notifications As DbSet(Of Notification) Implements IAppDbContext.Notifications
            Get
                Return [Set](Of Notification)()
            End Get
        End Property
        Public ReadOnly Property AuditLogs As DbSet(Of AuditLog) Implements IAppDbContext.AuditLogs
            Get
                Return [Set](Of AuditLog)()
            End Get
        End Property
        Public ReadOnly Property PropertyOccupancy As DbSet(Of PropertyOccupancyRow) Implements IAppDbContext.PropertyOccupancy
            Get
                Return [Set](Of PropertyOccupancyRow)()
            End Get
        End Property
        Public ReadOnly Property MonthlyBilling As DbSet(Of MonthlyBillingRow) Implements IAppDbContext.MonthlyBilling
            Get
                Return [Set](Of MonthlyBillingRow)()
            End Get
        End Property
        Public ReadOnly Property OverdueInvoices As DbSet(Of OverdueInvoiceRow) Implements IAppDbContext.OverdueInvoices
            Get
                Return [Set](Of OverdueInvoiceRow)()
            End Get
        End Property

        ' DbContext.Database is inherited, so the interface member is bridged explicitly.
        Private ReadOnly Property IAppDbContext_Database As DatabaseFacade Implements IAppDbContext.Database
            Get
                Return MyBase.Database
            End Get
        End Property

        Protected Overrides Sub OnModelCreating(b As ModelBuilder)
            b.Entity(Of Role)().ToTable("roles")
            b.Entity(Of User)(
                Sub(e)
                    e.ToTable("users")
                    e.HasMany(Function(u) u.UserRoles).WithOne(Function(r) r.User).HasForeignKey(Function(r) r.UserId)
                    e.HasOne(Function(u) u.TenantProfile).WithOne(Function(t) t.User).HasForeignKey(Of TenantProfile)(Function(t) t.UserId)
                End Sub)
            b.Entity(Of UserRole)(
                Sub(e)
                    e.ToTable("user_roles")
                    e.HasKey(Function(x) New With {Key x.UserId, Key x.RoleId})
                End Sub)
            b.Entity(Of RefreshToken)().ToTable("refresh_tokens")

            b.Entity(Of [Property])(
                Sub(e)
                    e.ToTable("properties")
                    e.HasOne(Function(p) p.Owner).WithMany().HasForeignKey(Function(p) p.OwnerId)
                    e.HasOne(Function(p) p.Manager).WithMany().HasForeignKey(Function(p) p.ManagerId)
                    e.HasMany(Function(p) p.Units).WithOne(Function(u) u.Property).HasForeignKey(Function(u) u.PropertyId)
                    e.HasMany(Function(p) p.Images).WithOne().HasForeignKey(Function(i) i.PropertyId)
                    e.HasMany(Function(p) p.PropertyAmenities).WithOne(Function(a) a.Property).HasForeignKey(Function(a) a.PropertyId)
                End Sub)
            b.Entity(Of PropertyUnit)().ToTable("property_units")
            b.Entity(Of PropertyImage)().ToTable("property_images")
            b.Entity(Of UnitTourStop)(
                Sub(e)
                    e.ToTable("unit_tour_stops")
                    e.HasOne(Function(s) s.Image).WithMany().HasForeignKey(Function(s) s.ImageId)
                    e.HasIndex(Function(s) New With {Key s.UnitId, Key s.Seq}).IsUnique()
                End Sub)
            b.Entity(Of Amenity)().ToTable("amenities")
            b.Entity(Of PropertyAmenity)(
                Sub(e)
                    e.ToTable("property_amenities")
                    e.HasKey(Function(x) New With {Key x.PropertyId, Key x.AmenityId})
                End Sub)

            b.Entity(Of TenantProfile)().ToTable("tenant_profiles")
            b.Entity(Of RentalApplication)(
                Sub(e)
                    e.ToTable("rental_applications")
                    e.HasOne(Function(a) a.Unit).WithMany().HasForeignKey(Function(a) a.UnitId)
                    e.HasOne(Function(a) a.Tenant).WithMany().HasForeignKey(Function(a) a.TenantId)
                End Sub)
            b.Entity(Of TenantDocument)().ToTable("tenant_documents")

            b.Entity(Of Lease)(
                Sub(e)
                    e.ToTable("leases")
                    e.HasOne(Function(l) l.Unit).WithMany().HasForeignKey(Function(l) l.UnitId)
                    e.HasOne(Function(l) l.Tenant).WithMany().HasForeignKey(Function(l) l.TenantId)
                    e.HasMany(Function(l) l.Versions).WithOne().HasForeignKey(Function(v) v.LeaseId)
                    e.HasMany(Function(l) l.Renewals).WithOne(Function(r) r.Lease).HasForeignKey(Function(r) r.LeaseId)
                    e.HasOne(Function(l) l.Deposit).WithOne(Function(d) d.Lease).HasForeignKey(Of Deposit)(Function(d) d.LeaseId)
                End Sub)
            b.Entity(Of LeaseVersion)().ToTable("lease_versions")
            b.Entity(Of LeaseRenewal)().ToTable("lease_renewals")
            b.Entity(Of RentInvoice)(
                Sub(e)
                    e.ToTable("rent_invoices")
                    e.Ignore(Function(i) i.Balance)
                    e.HasOne(Function(i) i.Lease).WithMany().HasForeignKey(Function(i) i.LeaseId)
                    e.HasMany(Function(i) i.Payments).WithOne(Function(p) p.Invoice).HasForeignKey(Function(p) p.InvoiceId)
                End Sub)
            b.Entity(Of Payment)().ToTable("payments")
            b.Entity(Of Deposit)().ToTable("deposits")

            b.Entity(Of MaintenanceRequest)(
                Sub(e)
                    e.ToTable("maintenance_requests")
                    e.HasOne(Function(r) r.Unit).WithMany().HasForeignKey(Function(r) r.UnitId)
                    e.HasOne(Function(r) r.Tenant).WithMany().HasForeignKey(Function(r) r.TenantId)
                    e.HasMany(Function(r) r.Images).WithOne().HasForeignKey(Function(i) i.RequestId)
                    e.HasMany(Function(r) r.Assignments).WithOne(Function(a) a.Request).HasForeignKey(Function(a) a.RequestId)
                    e.HasMany(Function(r) r.Logs).WithOne().HasForeignKey(Function(l) l.RequestId)
                End Sub)
            b.Entity(Of MaintenanceImage)().ToTable("maintenance_images")
            b.Entity(Of MaintenanceAssignment)(
                Sub(e)
                    e.ToTable("maintenance_assignments")
                    e.HasOne(Function(a) a.Staff).WithMany().HasForeignKey(Function(a) a.StaffId)
                End Sub)
            b.Entity(Of MaintenanceLog)(
                Sub(e)
                    e.ToTable("maintenance_logs")
                    e.HasOne(Function(l) l.Author).WithMany().HasForeignKey(Function(l) l.AuthorId)
                End Sub)
            b.Entity(Of Expense)(
                Sub(e)
                    e.ToTable("expenses")
                    e.HasOne(Function(x) x.Property).WithMany().HasForeignKey(Function(x) x.PropertyId)
                End Sub)
            b.Entity(Of Notification)().ToTable("notifications")
            b.Entity(Of AuditLog)(
                Sub(e)
                    e.ToTable("audit_logs")
                    e.Property(Function(a) a.Details).HasColumnType("json")
                    e.HasOne(Function(a) a.User).WithMany().HasForeignKey(Function(a) a.UserId)
                End Sub)

            ' reporting views (see database/02_views.sql)
            b.Entity(Of PropertyOccupancyRow)().HasNoKey().ToView("v_property_occupancy")
            b.Entity(Of MonthlyBillingRow)().HasNoKey().ToView("v_monthly_billing")
            b.Entity(Of OverdueInvoiceRow)().HasNoKey().ToView("v_overdue_invoices")

            ' all DATETIME columns hold UTC: surface them with Kind=Utc so JSON carries a 'Z'
            Dim utc As New ValueConverter(Of DateTime, DateTime)(
                Function(v) v,
                Function(v) DateTime.SpecifyKind(v, DateTimeKind.Utc))
            Dim utcNullable As New ValueConverter(Of DateTime?, DateTime?)(
                Function(v) v,
                Function(v) If(v.HasValue, CType(DateTime.SpecifyKind(v.Value, DateTimeKind.Utc), DateTime?), v))
            Dim dateTimeType = GetType(DateTime)
            Dim nullableDateTimeType = GetType(DateTime?)
            For Each prop In b.Model.GetEntityTypes().SelectMany(Function(t) t.GetProperties()).ToList()
                If prop.ClrType Is dateTimeType Then
                    prop.SetValueConverter(utc)
                ElseIf prop.ClrType Is nullableDateTimeType Then
                    prop.SetValueConverter(utcNullable)
                End If
            Next
        End Sub

        Public Overrides Async Function SaveChangesAsync(Optional cancellationToken As CancellationToken = Nothing) As Task(Of Integer) Implements IAppDbContext.SaveChangesAsync
            Dim now = DateTime.UtcNow
            For Each tracked In ChangeTracker.Entries().Where(Function(x) x.State = EntityState.Modified).ToList()
                Dim updated = tracked.Properties.FirstOrDefault(Function(p) p.Metadata.Name = "UpdatedAt")
                If updated IsNot Nothing AndAlso updated.Metadata.ClrType Is GetType(DateTime) AndAlso Not updated.IsModified Then
                    updated.CurrentValue = now
                End If
            Next

            Try
                Return Await MyBase.SaveChangesAsync(cancellationToken)
            Catch ex As DbUpdateException When FindMySql(ex) IsNot Nothing
                Dim translated = MySqlErrors.Translate(FindMySql(ex))
                If translated IsNot Nothing Then Throw translated
                Throw
            End Try
        End Function

        Private Shared Function FindMySql(ex As Exception) As MySqlException
            Dim cursor = ex
            Do While cursor IsNot Nothing
                Dim mysql = TryCast(cursor, MySqlException)
                If mysql IsNot Nothing Then Return mysql
                cursor = cursor.InnerException
            Loop
            Return Nothing
        End Function
    End Class

    Public NotInheritable Class MySqlErrors
        Private Sub New()
        End Sub

        ''' <summary>Maps MySQL errors raised by triggers/procedures/constraints to application exceptions.</summary>
        Public Shared Function Translate(ex As MySqlException) As AppException
            Select Case ex.Number
                Case 1644
                    Return New BusinessRuleException(ex.Message)                                                   ' SIGNAL SQLSTATE '45000' from our triggers / procedures
                Case 1062
                    Return New ConflictException("That record already exists.")                                    ' duplicate key
                Case 1451
                    Return New BusinessRuleException("This record is referenced by other data and cannot be removed.")
                Case 1452
                    Return New BusinessRuleException("A related record does not exist.")
                Case 3819
                    Return New BusinessRuleException("A value violates a data rule (check constraint).")           ' CHECK constraint
                Case Else
                    Return Nothing
            End Select
        End Function
    End Class

End Namespace
