Imports System.ComponentModel.DataAnnotations
Imports Keyzo.Application.Security
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class DocumentDto
        Public Property Id As Long
        Public Property DocType As String
        Public Property OriginalName As String
        Public Property IsVerified As Boolean
        Public Property UploadedAt As DateTime
        Public Property ApplicationId As Long?
    End Class

    Public Class TenantProfileDto
        Public Property Id As Long
        Public Property UserId As Long
        Public Property FullName As String
        Public Property Email As String
        Public Property Phone As String
        Public Property DateOfBirth As DateOnly?
        Public Property Occupation As String
        Public Property Employer As String
        Public Property MonthlyIncome As Decimal?
        Public Property EmergencyContactName As String
        Public Property EmergencyContactPhone As String
        Public Property PermanentAddress As String
        Public Property IdProofType As String
        Public Property IdProofNumber As String
        Public Property Documents As IReadOnlyList(Of DocumentDto)
    End Class

    Public Class TenantListItem
        Public Property Id As Long
        Public Property FullName As String
        Public Property Email As String
        Public Property Phone As String
        Public Property Occupation As String
        Public Property CurrentUnit As String
        Public Property CurrentProperty As String
        Public Property Outstanding As Decimal
        Public Property LeaseCount As Integer
    End Class

    Public Class UpdateTenantProfileRequest
        Public Property DateOfBirth As DateOnly?
        <MaxLength(100)> Public Property Occupation As String
        <MaxLength(120)> Public Property Employer As String
        <Range(0, 1000000000)> Public Property MonthlyIncome As Decimal?
        <MaxLength(120)> Public Property EmergencyContactName As String
        <MaxLength(20)> Public Property EmergencyContactPhone As String
        <MaxLength(300)> Public Property PermanentAddress As String
        Public Property IdProofType As String
        <MaxLength(40)> Public Property IdProofNumber As String
    End Class

    Public Interface ITenantService
        Function GetMineAsync(Optional ct As CancellationToken = Nothing) As Task(Of TenantProfileDto)
        Function UpdateMineAsync(request As UpdateTenantProfileRequest, Optional ct As CancellationToken = Nothing) As Task(Of TenantProfileDto)
        Function GetAsync(tenantId As Long, Optional ct As CancellationToken = Nothing) As Task(Of TenantProfileDto)
        Function ListAsync(search As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of TenantListItem))
        Function UploadDocumentAsync(docType As String, applicationId As Long?, content As Stream, fileName As String, Optional ct As CancellationToken = Nothing) As Task(Of DocumentDto)
        Function DeleteDocumentAsync(documentId As Long, Optional ct As CancellationToken = Nothing) As Task
        Function VerifyDocumentAsync(documentId As Long, verified As Boolean, Optional ct As CancellationToken = Nothing) As Task
        Function DownloadDocumentAsync(documentId As Long, Optional ct As CancellationToken = Nothing) As Task(Of PrivateFile)
    End Interface

    Public NotInheritable Class TenantService
        Implements ITenantService

        Private Shared ReadOnly DocTypes As String() = {"id_proof", "address_proof", "income_proof", "employment_letter", "other"}
        Private Shared ReadOnly IdTypes As String() = {"aadhaar", "passport", "driving_license", "voter_id", "pan"}

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

        Public Async Function GetMineAsync(Optional ct As CancellationToken = Nothing) As Task(Of TenantProfileDto) Implements ITenantService.GetMineAsync
            Dim id = Await scope.RequireTenantProfileIdAsync(ct)
            Return Await LoadAsync(id, ct)
        End Function

        Public Async Function UpdateMineAsync(request As UpdateTenantProfileRequest, Optional ct As CancellationToken = Nothing) As Task(Of TenantProfileDto) Implements ITenantService.UpdateMineAsync
            Dim id = Await scope.RequireTenantProfileIdAsync(ct)
            If request.IdProofType IsNot Nothing AndAlso Not IdTypes.Contains(request.IdProofType) Then Throw New BusinessRuleException("Unsupported ID proof type.")
            If request.DateOfBirth.HasValue AndAlso request.DateOfBirth.Value > DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-18)) Then
                Throw New BusinessRuleException("Tenants must be at least 18 years old.")
            End If

            Dim profile = Await db.TenantProfiles.FirstAsync(Function(x) x.Id = id, ct)
            profile.DateOfBirth = request.DateOfBirth
            profile.Occupation = request.Occupation?.Trim()
            profile.Employer = request.Employer?.Trim()
            profile.MonthlyIncome = request.MonthlyIncome
            profile.EmergencyContactName = request.EmergencyContactName?.Trim()
            profile.EmergencyContactPhone = request.EmergencyContactPhone?.Trim()
            profile.PermanentAddress = request.PermanentAddress?.Trim()
            profile.IdProofType = If(String.IsNullOrWhiteSpace(request.IdProofType), Nothing, request.IdProofType)
            profile.IdProofNumber = request.IdProofNumber?.Trim()
            profile.UpdatedAt = DateTime.UtcNow
            Await db.SaveChangesAsync(ct)
            Return Await LoadAsync(id, ct)
        End Function

        Public Async Function GetAsync(tenantId As Long, Optional ct As CancellationToken = Nothing) As Task(Of TenantProfileDto) Implements ITenantService.GetAsync
            If Not Await scope.Tenants().AnyAsync(Function(t) t.Id = tenantId, ct) Then Throw New NotFoundException("Tenant not found.")
            Return Await LoadAsync(tenantId, ct)
        End Function

        Public Async Function ListAsync(search As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of TenantListItem)) Implements ITenantService.ListAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim today = DateOnly.FromDateTime(DateTime.UtcNow)
            Dim q = scope.Tenants().AsNoTracking()
            If Not String.IsNullOrWhiteSpace(search) Then
                q = q.Where(Function(t) t.User.FullName.Contains(search) OrElse t.User.Email.Contains(search))
            End If

            Return Await q.OrderBy(Function(t) t.User.FullName).
                Select(Function(t) New TenantListItem With {
                    .Id = t.Id,
                    .FullName = t.User.FullName,
                    .Email = t.User.Email,
                    .Phone = t.User.Phone,
                    .Occupation = t.Occupation,
                    .CurrentUnit = db.Leases.Where(Function(l) l.TenantId = t.Id AndAlso l.Status = LeaseStatus.Active AndAlso l.StartDate <= today AndAlso l.EndDate >= today).
                        Select(Function(l) l.Unit.UnitNumber).FirstOrDefault(),
                    .CurrentProperty = db.Leases.Where(Function(l) l.TenantId = t.Id AndAlso l.Status = LeaseStatus.Active AndAlso l.StartDate <= today AndAlso l.EndDate >= today).
                        Select(Function(l) l.Unit.Property.Name).FirstOrDefault(),
                    .Outstanding = If(db.Invoices.Where(Function(i) i.Lease.TenantId = t.Id AndAlso i.Status <> InvoiceStatus.Cancelled).
                        Sum(Function(i) CType(i.Amount + i.LateFee - i.AmountPaid, Decimal?)), 0D),
                    .LeaseCount = db.Leases.Count(Function(l) l.TenantId = t.Id)
                }).ToPagedAsync(page, ct)
        End Function

        Public Async Function UploadDocumentAsync(docType As String, applicationId As Long?, content As Stream, fileName As String, Optional ct As CancellationToken = Nothing) As Task(Of DocumentDto) Implements ITenantService.UploadDocumentAsync
            Dim tenantId = Await scope.RequireTenantProfileIdAsync(ct)
            If Not DocTypes.Contains(docType) Then Throw New BusinessRuleException("Unsupported document type.")
            If applicationId.HasValue Then
                Dim appId = applicationId.Value
                If Not Await db.Applications.AnyAsync(Function(a) a.Id = appId AndAlso a.TenantId = tenantId, ct) Then
                    Throw New NotFoundException("Application not found.")
                End If
            End If

            Dim saved = Await storage.SaveAsync(content, fileName, "documents", ct)
            Dim doc As New TenantDocument With {
                .TenantId = tenantId,
                .ApplicationId = applicationId,
                .DocType = docType,
                .FilePath = saved.RelativePath,
                .OriginalName = saved.OriginalName
            }
            db.TenantDocuments.Add(doc)
            Await db.SaveChangesAsync(ct)
            Return New DocumentDto With {
                .Id = doc.Id,
                .DocType = doc.DocType,
                .OriginalName = doc.OriginalName,
                .IsVerified = doc.IsVerified,
                .UploadedAt = doc.UploadedAt,
                .ApplicationId = doc.ApplicationId
            }
        End Function

        Public Async Function DeleteDocumentAsync(documentId As Long, Optional ct As CancellationToken = Nothing) As Task Implements ITenantService.DeleteDocumentAsync
            Dim tenantId = Await scope.RequireTenantProfileIdAsync(ct)
            Dim doc = Await db.TenantDocuments.FirstOrDefaultAsync(Function(d) d.Id = documentId AndAlso d.TenantId = tenantId, ct)
            If doc Is Nothing Then Throw New NotFoundException()
            If doc.IsVerified Then Throw New BusinessRuleException("Verified documents cannot be deleted.")
            db.TenantDocuments.Remove(doc)
            Await db.SaveChangesAsync(ct)
            Await storage.DeleteAsync(doc.FilePath, ct)
        End Function

        Public Async Function VerifyDocumentAsync(documentId As Long, verified As Boolean, Optional ct As CancellationToken = Nothing) As Task Implements ITenantService.VerifyDocumentAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim doc = Await db.TenantDocuments.FirstOrDefaultAsync(Function(d) d.Id = documentId, ct)
            If doc Is Nothing Then Throw New NotFoundException()
            Dim docTenantId = doc.TenantId
            If Not Await scope.Tenants().AnyAsync(Function(t) t.Id = docTenantId, ct) Then Throw New ForbiddenException()
            doc.IsVerified = verified
            doc.VerifiedBy = If(verified, current.RequiredId(), CType(Nothing, Long?))
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync(If(verified, "verify", "unverify"), "tenant_document", documentId, ct:=ct)
        End Function

        Public Async Function DownloadDocumentAsync(documentId As Long, Optional ct As CancellationToken = Nothing) As Task(Of PrivateFile) Implements ITenantService.DownloadDocumentAsync
            Dim doc = Await db.TenantDocuments.AsNoTracking().FirstOrDefaultAsync(Function(d) d.Id = documentId, ct)
            If doc Is Nothing Then Throw New NotFoundException()
            Dim docTenantId = doc.TenantId
            If Not Await scope.Tenants().AnyAsync(Function(t) t.Id = docTenantId, ct) Then Throw New ForbiddenException()
            Return storage.OpenPrivate(doc.FilePath, doc.OriginalName)
        End Function

        Private Async Function LoadAsync(id As Long, ct As CancellationToken) As Task(Of TenantProfileDto)
            Dim profile = Await db.TenantProfiles.AsNoTracking().Include(Function(x) x.User).FirstOrDefaultAsync(Function(x) x.Id = id, ct)
            If profile Is Nothing Then Throw New NotFoundException()
            Dim docs = Await db.TenantDocuments.AsNoTracking().Where(Function(d) d.TenantId = id).OrderByDescending(Function(d) d.UploadedAt).
                Select(Function(d) New DocumentDto With {
                    .Id = d.Id,
                    .DocType = d.DocType,
                    .OriginalName = d.OriginalName,
                    .IsVerified = d.IsVerified,
                    .UploadedAt = d.UploadedAt,
                    .ApplicationId = d.ApplicationId
                }).ToListAsync(ct)
            Return New TenantProfileDto With {
                .Id = profile.Id,
                .UserId = profile.UserId,
                .FullName = profile.User.FullName,
                .Email = profile.User.Email,
                .Phone = profile.User.Phone,
                .DateOfBirth = profile.DateOfBirth,
                .Occupation = profile.Occupation,
                .Employer = profile.Employer,
                .MonthlyIncome = profile.MonthlyIncome,
                .EmergencyContactName = profile.EmergencyContactName,
                .EmergencyContactPhone = profile.EmergencyContactPhone,
                .PermanentAddress = profile.PermanentAddress,
                .IdProofType = profile.IdProofType,
                .IdProofNumber = profile.IdProofNumber,
                .Documents = docs
            }
        End Function

    End Class

End Namespace
