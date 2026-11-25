Imports System.Runtime.CompilerServices
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore
Imports Microsoft.EntityFrameworkCore.Infrastructure

' ---------------------------------------------------------------- errors
Public MustInherit Class AppException
    Inherits Exception

    Protected Sub New(message As String)
        MyBase.New(message)
    End Sub
End Class

Public NotInheritable Class NotFoundException
    Inherits AppException

    Public Sub New(Optional message As String = "The requested resource was not found.")
        MyBase.New(message)
    End Sub
End Class

Public NotInheritable Class ForbiddenException
    Inherits AppException

    Public Sub New(Optional message As String = "You do not have permission to perform this action.")
        MyBase.New(message)
    End Sub
End Class

''' <summary>A business rule was violated (400). Also raised for MySQL SIGNAL 45000 errors from triggers/procedures.</summary>
Public NotInheritable Class BusinessRuleException
    Inherits AppException

    Public Sub New(message As String)
        MyBase.New(message)
    End Sub
End Class

Public NotInheritable Class ConflictException
    Inherits AppException

    Public Sub New(message As String)
        MyBase.New(message)
    End Sub
End Class

Public NotInheritable Class UnauthorizedAppException
    Inherits AppException

    Public Sub New(Optional message As String = "Invalid credentials.")
        MyBase.New(message)
    End Sub
End Class

' ---------------------------------------------------------------- paging
Public Class PagedResult(Of T)
    Public Sub New(items As IReadOnlyList(Of T), total As Integer, page As Integer, pageSize As Integer)
        Me.Items = items
        Me.Total = total
        Me.Page = page
        Me.PageSize = pageSize
    End Sub

    Public Property Items As IReadOnlyList(Of T)
    Public Property Total As Integer
    Public Property Page As Integer
    Public Property PageSize As Integer
End Class

Public Class PageQuery
    Public Sub New(Optional page As Integer = 1, Optional pageSize As Integer = 20)
        Me.Page = page
        Me.PageSize = pageSize
    End Sub

    Public Property Page As Integer
    Public Property PageSize As Integer

    Public ReadOnly Property SafePage As Integer
        Get
            Return Math.Max(1, Page)
        End Get
    End Property

    Public ReadOnly Property SafeSize As Integer
        Get
            Return Math.Clamp(PageSize, 1, 100)
        End Get
    End Property

    Public ReadOnly Property Skip As Integer
        Get
            Return (SafePage - 1) * SafeSize
        End Get
    End Property
End Class

Public Module QueryableExtensions
    <Extension>
    Public Async Function ToPagedAsync(Of T)(query As IQueryable(Of T), page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of T))
        Dim total = Await query.CountAsync(ct)
        Dim items = Await query.Skip(page.Skip).Take(page.SafeSize).ToListAsync(ct)
        Return New PagedResult(Of T)(items, total, page.SafePage, page.SafeSize)
    End Function
End Module

' ---------------------------------------------------------------- infrastructure ports
Public Interface IAppDbContext
    ReadOnly Property Roles As DbSet(Of Role)
    ReadOnly Property Users As DbSet(Of User)
    ReadOnly Property UserRoles As DbSet(Of UserRole)
    ReadOnly Property RefreshTokens As DbSet(Of RefreshToken)
    ReadOnly Property Properties As DbSet(Of [Property])
    ReadOnly Property Units As DbSet(Of PropertyUnit)
    ReadOnly Property PropertyImages As DbSet(Of PropertyImage)
    ReadOnly Property UnitTourStops As DbSet(Of UnitTourStop)
    ReadOnly Property Amenities As DbSet(Of Amenity)
    ReadOnly Property PropertyAmenities As DbSet(Of PropertyAmenity)
    ReadOnly Property TenantProfiles As DbSet(Of TenantProfile)
    ReadOnly Property Applications As DbSet(Of RentalApplication)
    ReadOnly Property TenantDocuments As DbSet(Of TenantDocument)
    ReadOnly Property Leases As DbSet(Of Lease)
    ReadOnly Property LeaseVersions As DbSet(Of LeaseVersion)
    ReadOnly Property LeaseRenewals As DbSet(Of LeaseRenewal)
    ReadOnly Property Invoices As DbSet(Of RentInvoice)
    ReadOnly Property Payments As DbSet(Of Payment)
    ReadOnly Property Deposits As DbSet(Of Deposit)
    ReadOnly Property MaintenanceRequests As DbSet(Of MaintenanceRequest)
    ReadOnly Property MaintenanceImages As DbSet(Of MaintenanceImage)
    ReadOnly Property MaintenanceAssignments As DbSet(Of MaintenanceAssignment)
    ReadOnly Property MaintenanceLogs As DbSet(Of MaintenanceLog)
    ReadOnly Property Expenses As DbSet(Of Expense)
    ReadOnly Property Notifications As DbSet(Of Notification)
    ReadOnly Property AuditLogs As DbSet(Of AuditLog)
    ReadOnly Property PropertyOccupancy As DbSet(Of PropertyOccupancyRow)
    ReadOnly Property MonthlyBilling As DbSet(Of MonthlyBillingRow)
    ReadOnly Property OverdueInvoices As DbSet(Of OverdueInvoiceRow)
    ReadOnly Property Database As DatabaseFacade
    Function SaveChangesAsync(Optional cancellationToken As CancellationToken = Nothing) As Task(Of Integer)
End Interface

Public Class CreateLeaseCommand
    Public Property ApplicationId As Long
    Public Property StartDate As DateOnly
    Public Property EndDate As DateOnly
    Public Property MonthlyRent As Decimal
    Public Property SecurityDeposit As Decimal
    Public Property RentDueDay As Integer
    Public Property LateFee As Decimal
    Public Property Terms As String
    Public Property UserId As Long
End Class

''' <summary>Typed wrapper over the MySQL stored procedures (transactions live in the database).</summary>
Public Interface IStoredProcedures
    Function DecideApplicationAsync(applicationId As Long, approve As Boolean, note As String, userId As Long, Optional ct As CancellationToken = Nothing) As Task
    Function CreateLeaseAsync(cmd As CreateLeaseCommand, Optional ct As CancellationToken = Nothing) As Task(Of Long)
    Function TerminateLeaseAsync(leaseId As Long, userId As Long, Optional ct As CancellationToken = Nothing) As Task
    Function GenerateInvoicesAsync(month As DateOnly, Optional ct As CancellationToken = Nothing) As Task(Of Integer)
    Function RecordPaymentAsync(invoiceId As Long, amount As Decimal, method As String, reference As String, note As String, userId As Long, Optional ct As CancellationToken = Nothing) As Task(Of Long)
    Function RunDailyJobsAsync([date] As DateOnly, Optional ct As CancellationToken = Nothing) As Task
End Interface

Public Interface ICurrentUser
    ReadOnly Property Id As Long?
    ReadOnly Property Email As String
    ReadOnly Property IsAuthenticated As Boolean
    Function InRole(role As String) As Boolean
End Interface

Public Module CurrentUserExtensions
    <Extension>
    Public Function RequiredId(u As ICurrentUser) As Long
        If Not u.Id.HasValue Then Throw New UnauthorizedAppException("Please sign in.")
        Return u.Id.Value
    End Function

    <Extension>
    Public Function IsAdmin(u As ICurrentUser) As Boolean
        Return u.InRole(Keyzo.Domain.Roles.SuperAdmin)
    End Function

    <Extension>
    Public Function IsOwner(u As ICurrentUser) As Boolean
        Return u.InRole(Keyzo.Domain.Roles.Owner)
    End Function

    <Extension>
    Public Function IsManager(u As ICurrentUser) As Boolean
        Return u.InRole(Keyzo.Domain.Roles.Manager)
    End Function

    <Extension>
    Public Function IsTenant(u As ICurrentUser) As Boolean
        Return u.InRole(Keyzo.Domain.Roles.Tenant)
    End Function

    <Extension>
    Public Function IsStaff(u As ICurrentUser) As Boolean
        Return u.InRole(Keyzo.Domain.Roles.MaintenanceStaff)
    End Function

    ''' <summary>Admin, Owner or Manager.</summary>
    <Extension>
    Public Function IsOperator(u As ICurrentUser) As Boolean
        Return u.IsAdmin() OrElse u.IsOwner() OrElse u.IsManager()
    End Function
End Module

Public Class StoredFile
    Public Sub New(relativePath As String, originalName As String, size As Long)
        Me.RelativePath = relativePath
        Me.OriginalName = originalName
        Me.Size = size
    End Sub

    Public ReadOnly Property RelativePath As String
    Public ReadOnly Property OriginalName As String
    Public ReadOnly Property Size As Long
End Class

Public Class PrivateFile
    Public Sub New(content As Stream, contentType As String, fileName As String)
        Me.Content = content
        Me.ContentType = contentType
        Me.FileName = fileName
    End Sub

    Public ReadOnly Property Content As Stream
    Public ReadOnly Property ContentType As String
    Public ReadOnly Property FileName As String
End Class

Public Interface IFileStorage
    ''' <summary>
    ''' Saves a file. Folder "properties" is public (served at /uploads); every other folder
    ''' ("documents", "maintenance") is private and only reachable through <see cref="OpenPrivate"/>.
    ''' Swap this implementation for S3/Azure Blob without touching the services.
    ''' </summary>
    Function SaveAsync(content As Stream, originalName As String, folder As String, Optional ct As CancellationToken = Nothing) As Task(Of StoredFile)
    Function DeleteAsync(relativePath As String, Optional ct As CancellationToken = Nothing) As Task
    ''' <summary>URL for a PUBLIC file.</summary>
    Function PublicUrl(relativePath As String) As String
    Function OpenPrivate(relativePath As String, downloadName As String) As PrivateFile
End Interface

Public Interface IPasswordHasher
    Function Hash(password As String) As String
    Function Verify(password As String, hash As String) As Boolean
End Interface

Public Class TokenPair
    Public Sub New(accessToken As String, accessExpiresAt As DateTime, refreshToken As String, refreshExpiresAt As DateTime)
        Me.AccessToken = accessToken
        Me.AccessExpiresAt = accessExpiresAt
        Me.RefreshToken = refreshToken
        Me.RefreshExpiresAt = refreshExpiresAt
    End Sub

    Public ReadOnly Property AccessToken As String
    Public ReadOnly Property AccessExpiresAt As DateTime
    Public ReadOnly Property RefreshToken As String
    Public ReadOnly Property RefreshExpiresAt As DateTime
End Class

Public Interface ITokenService
    Function Create(user As User, roles As IEnumerable(Of String)) As TokenPair
    Function HashRefreshToken(token As String) As String
End Interface
