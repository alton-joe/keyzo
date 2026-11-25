Namespace Entities

    ' Table/column names are derived from these classes by the snake_case naming convention
    ' (e.g. PropertyUnit.FloorNo -> property_units.floor_no). The schema itself lives in /database.

    Public Class Role
        Public Property Id As Byte
        Public Property Name As String = ""
        Public Property Description As String
    End Class

    Public Class User
        Public Property Id As Long
        Public Property Email As String = ""
        Public Property PasswordHash As String = ""
        Public Property FullName As String = ""
        Public Property Phone As String
        Public Property AvatarUrl As String
        Public Property IsActive As Boolean = True
        Public Property CreatedBy As Long?
        Public Property CreatedAt As DateTime = DateTime.UtcNow
        Public Property UpdatedAt As DateTime = DateTime.UtcNow
        Public Property LastLoginAt As DateTime?

        Public Property UserRoles As List(Of UserRole) = New List(Of UserRole)()
        Public Property TenantProfile As TenantProfile
    End Class

    Public Class UserRole
        Public Property UserId As Long
        Public Property RoleId As Byte
        Public Property User As User
        Public Property Role As Role
    End Class

    Public Class RefreshToken
        Public Property Id As Long
        Public Property UserId As Long
        Public Property TokenHash As String = ""
        Public Property ExpiresAt As DateTime
        Public Property RevokedAt As DateTime?
        Public Property CreatedAt As DateTime = DateTime.UtcNow
        Public Property User As User
    End Class

    Public Class [Property]
        Public Property Id As Long
        Public Property OwnerId As Long
        Public Property ManagerId As Long?
        Public Property Name As String = ""
        Public Property Description As String
        Public Property PropertyType As String = "apartment"
        Public Property AddressLine As String = ""
        Public Property City As String = ""
        Public Property State As String = ""
        Public Property PostalCode As String = ""
        Public Property Country As String = "India"
        Public Property IsActive As Boolean = True
        Public Property CreatedAt As DateTime = DateTime.UtcNow
        Public Property UpdatedAt As DateTime = DateTime.UtcNow

        Public Property Owner As User
        Public Property Manager As User
        Public Property Units As List(Of PropertyUnit) = New List(Of PropertyUnit)()
        Public Property Images As List(Of PropertyImage) = New List(Of PropertyImage)()
        Public Property PropertyAmenities As List(Of PropertyAmenity) = New List(Of PropertyAmenity)()
    End Class

    Public Class PropertyUnit
        Public Property Id As Long
        Public Property PropertyId As Long
        Public Property UnitNumber As String = ""
        Public Property FloorNo As Short
        Public Property Bedrooms As Byte = 1
        Public Property Bathrooms As Byte = 1
        Public Property AreaSqft As Decimal
        Public Property MonthlyRent As Decimal
        Public Property DepositAmount As Decimal
        Public Property Status As String = UnitStatus.Available
        Public Property Description As String
        Public Property CreatedAt As DateTime = DateTime.UtcNow
        Public Property UpdatedAt As DateTime = DateTime.UtcNow

        Public Property [Property] As [Property]
    End Class

    Public Class PropertyImage
        Public Property Id As Long
        Public Property PropertyId As Long
        Public Property UnitId As Long?
        Public Property FilePath As String = ""
        Public Property IsCover As Boolean
        Public Property SortOrder As Short
        Public Property CreatedAt As DateTime = DateTime.UtcNow
    End Class

    ''' <summary>One room in a unit's scroll-driven house tour (see 07_unit_tours.sql).</summary>
    Public Class UnitTourStop
        Public Property Id As Long
        Public Property UnitId As Long
        Public Property Seq As Short
        Public Property RoomType As String = "hall"
        Public Property ImageId As Long
        Public Property Title As String = ""
        Public Property Caption As String
        Public Property FocalX As Decimal = 50D
        Public Property FocalY As Decimal = 50D
        Public Property CreatedAt As DateTime = DateTime.UtcNow

        Public Property Image As PropertyImage
    End Class

    Public Class Amenity
        Public Property Id As Integer
        Public Property Name As String = ""
        Public Property Icon As String
    End Class

    Public Class PropertyAmenity
        Public Property PropertyId As Long
        Public Property AmenityId As Integer
        Public Property [Property] As [Property]
        Public Property Amenity As Amenity
    End Class

    Public Class TenantProfile
        Public Property Id As Long
        Public Property UserId As Long
        Public Property DateOfBirth As DateOnly?
        Public Property Occupation As String
        Public Property Employer As String
        Public Property MonthlyIncome As Decimal?
        Public Property EmergencyContactName As String
        Public Property EmergencyContactPhone As String
        Public Property PermanentAddress As String
        Public Property IdProofType As String
        Public Property IdProofNumber As String
        Public Property CreatedAt As DateTime = DateTime.UtcNow
        Public Property UpdatedAt As DateTime = DateTime.UtcNow

        Public Property User As User
    End Class

    Public Class RentalApplication
        Public Property Id As Long
        Public Property UnitId As Long
        Public Property TenantId As Long
        Public Property DesiredMoveIn As DateOnly
        Public Property LeaseMonths As Byte = 11
        Public Property Occupants As Byte = 1
        Public Property Message As String
        Public Property Status As String = ApplicationStatus.Pending
        Public Property ReviewedBy As Long?
        Public Property ReviewedAt As DateTime?
        Public Property ReviewNote As String
        Public Property CreatedAt As DateTime = DateTime.UtcNow

        Public Property Unit As PropertyUnit
        Public Property Tenant As TenantProfile
    End Class

    Public Class TenantDocument
        Public Property Id As Long
        Public Property TenantId As Long
        Public Property ApplicationId As Long?
        Public Property DocType As String = "other"
        Public Property FilePath As String = ""
        Public Property OriginalName As String = ""
        Public Property IsVerified As Boolean
        Public Property VerifiedBy As Long?
        Public Property UploadedAt As DateTime = DateTime.UtcNow
    End Class

    Public Class Lease
        Public Property Id As Long
        Public Property ApplicationId As Long?
        Public Property UnitId As Long
        Public Property TenantId As Long
        Public Property StartDate As DateOnly
        Public Property EndDate As DateOnly
        Public Property MonthlyRent As Decimal
        Public Property SecurityDeposit As Decimal
        Public Property RentDueDay As Byte = 5
        Public Property LateFee As Decimal
        Public Property Status As String = LeaseStatus.Active
        Public Property Terms As String
        Public Property TerminatedAt As DateTime?
        Public Property CreatedBy As Long?
        Public Property CreatedAt As DateTime = DateTime.UtcNow
        Public Property UpdatedAt As DateTime = DateTime.UtcNow

        Public Property Unit As PropertyUnit
        Public Property Tenant As TenantProfile
        Public Property Versions As List(Of LeaseVersion) = New List(Of LeaseVersion)()
        Public Property Renewals As List(Of LeaseRenewal) = New List(Of LeaseRenewal)()
        Public Property Deposit As Deposit

        ''' <summary>upcoming / active / expired / terminated - derived from dates and stored status.</summary>
        Public Function EffectiveStatus(today As DateOnly) As String
            If Status = LeaseStatus.Terminated Then Return "terminated"
            If today < StartDate Then Return "upcoming"
            If today > EndDate Then Return "expired"
            Return "active"
        End Function
    End Class

    Public Class LeaseVersion
        Public Property Id As Long
        Public Property LeaseId As Long
        Public Property VersionNo As Integer
        Public Property StartDate As DateOnly
        Public Property EndDate As DateOnly
        Public Property MonthlyRent As Decimal
        Public Property SecurityDeposit As Decimal
        Public Property ChangeReason As String
        Public Property CreatedAt As DateTime = DateTime.UtcNow
    End Class

    Public Class LeaseRenewal
        Public Property Id As Long
        Public Property LeaseId As Long
        Public Property RequestedBy As Long
        Public Property RequestedEndDate As DateOnly
        Public Property ProposedRent As Decimal?
        Public Property Note As String
        Public Property Status As String = RenewalStatus.Pending
        Public Property DecidedBy As Long?
        Public Property DecidedAt As DateTime?
        Public Property CreatedAt As DateTime = DateTime.UtcNow
        Public Property Lease As Lease
    End Class

    Public Class RentInvoice
        Public Property Id As Long
        Public Property LeaseId As Long
        Public Property InvoiceNumber As String = ""
        Public Property PeriodMonth As DateOnly
        Public Property IssueDate As DateOnly
        Public Property DueDate As DateOnly
        Public Property Amount As Decimal
        Public Property LateFee As Decimal
        Public Property AmountPaid As Decimal
        Public Property Status As String = InvoiceStatus.Pending
        Public Property CreatedAt As DateTime = DateTime.UtcNow

        Public Property Lease As Lease
        Public Property Payments As List(Of Payment) = New List(Of Payment)()

        Public ReadOnly Property Balance As Decimal
            Get
                Return Amount + LateFee - AmountPaid
            End Get
        End Property
    End Class

    Public Class Payment
        Public Property Id As Long
        Public Property InvoiceId As Long
        Public Property ReceiptNumber As String = ""
        Public Property Amount As Decimal
        Public Property PaidAt As DateTime = DateTime.UtcNow
        Public Property Method As String = "cash"
        Public Property ReferenceNo As String
        Public Property Note As String
        Public Property RecordedBy As Long?

        Public Property Invoice As RentInvoice
    End Class

    Public Class Deposit
        Public Property Id As Long
        Public Property LeaseId As Long
        Public Property Amount As Decimal
        Public Property ReceivedOn As DateOnly
        Public Property Status As String = DepositStatus.Held
        Public Property RefundedAmount As Decimal
        Public Property RefundedOn As DateOnly?
        Public Property DeductionReason As String
        Public Property Lease As Lease
    End Class

    Public Class MaintenanceRequest
        Public Property Id As Long
        Public Property UnitId As Long
        Public Property TenantId As Long
        Public Property Title As String = ""
        Public Property Description As String = ""
        Public Property Category As String = "other"
        Public Property Priority As String = "medium"
        Public Property Status As String = MaintenanceStatus.Open
        Public Property CreatedAt As DateTime = DateTime.UtcNow
        Public Property CompletedAt As DateTime?

        Public Property Unit As PropertyUnit
        Public Property Tenant As TenantProfile
        Public Property Images As List(Of MaintenanceImage) = New List(Of MaintenanceImage)()
        Public Property Assignments As List(Of MaintenanceAssignment) = New List(Of MaintenanceAssignment)()
        Public Property Logs As List(Of MaintenanceLog) = New List(Of MaintenanceLog)()
    End Class

    Public Class MaintenanceImage
        Public Property Id As Long
        Public Property RequestId As Long
        Public Property FilePath As String = ""
    End Class

    Public Class MaintenanceAssignment
        Public Property Id As Long
        Public Property RequestId As Long
        Public Property StaffId As Long
        Public Property AssignedBy As Long?
        Public Property ScheduledFor As DateOnly?
        Public Property IsCurrent As Boolean = True
        Public Property AssignedAt As DateTime = DateTime.UtcNow

        Public Property Staff As User
        Public Property Request As MaintenanceRequest
    End Class

    Public Class MaintenanceLog
        Public Property Id As Long
        Public Property RequestId As Long
        Public Property AuthorId As Long?
        Public Property Status As String = MaintenanceStatus.Open
        Public Property Note As String
        Public Property Cost As Decimal
        Public Property CreatedAt As DateTime = DateTime.UtcNow

        Public Property Author As User
    End Class

    Public Class Expense
        Public Property Id As Long
        Public Property PropertyId As Long
        Public Property UnitId As Long?
        Public Property RequestId As Long?
        Public Property Category As String = "maintenance"
        Public Property Description As String = ""
        Public Property Amount As Decimal
        Public Property ExpenseDate As DateOnly
        Public Property RecordedBy As Long?
        Public Property CreatedAt As DateTime = DateTime.UtcNow

        Public Property [Property] As [Property]
    End Class

    Public Class Notification
        Public Property Id As Long
        Public Property UserId As Long
        Public Property Type As String = ""
        Public Property Title As String = ""
        Public Property Message As String = ""
        Public Property Link As String
        Public Property IsRead As Boolean
        Public Property CreatedAt As DateTime = DateTime.UtcNow
    End Class

    Public Class AuditLog
        Public Property Id As Long
        Public Property UserId As Long?
        Public Property Action As String = ""
        Public Property Entity As String = ""
        Public Property EntityId As Long?
        Public Property Details As String
        Public Property CreatedAt As DateTime = DateTime.UtcNow
        Public Property User As User
    End Class

    ' ---- keyless entities mapped to the reporting views (see database/02_views.sql) ----
    Public Class PropertyOccupancyRow
        Public Property PropertyId As Long
        Public Property PropertyName As String = ""
        Public Property OwnerId As Long
        Public Property ManagerId As Long?
        Public Property TotalUnits As Long
        Public Property OccupiedUnits As Decimal
        Public Property AvailableUnits As Decimal
        Public Property OccupancyPct As Decimal?
    End Class

    Public Class MonthlyBillingRow
        Public Property PropertyId As Long
        Public Property OwnerId As Long
        Public Property ManagerId As Long?
        Public Property PeriodMonth As DateOnly
        Public Property Invoices As Long
        Public Property Billed As Decimal
        Public Property Collected As Decimal
        Public Property Outstanding As Decimal
    End Class

    Public Class OverdueInvoiceRow
        Public Property InvoiceId As Long
        Public Property InvoiceNumber As String = ""
        Public Property LeaseId As Long
        Public Property DueDate As DateOnly
        Public Property Balance As Decimal
        Public Property DaysOverdue As Integer
        Public Property UnitId As Long
        Public Property UnitNumber As String = ""
        Public Property PropertyId As Long
        Public Property PropertyName As String = ""
        Public Property OwnerId As Long
        Public Property ManagerId As Long?
        Public Property TenantId As Long
        Public Property TenantName As String = ""
    End Class

End Namespace
