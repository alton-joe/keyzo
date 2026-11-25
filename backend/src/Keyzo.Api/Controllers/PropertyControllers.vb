Imports Keyzo.Api.Infrastructure
Imports Keyzo.Application
Imports Keyzo.Application.Services
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Mvc

Namespace Controllers

    <Route("api/v1/properties")>
    Public Class PropertiesController
        Inherits ApiControllerBase

        Private ReadOnly props As IPropertyService
        Private ReadOnly tours As ITourService

        Public Sub New(props As IPropertyService, tours As ITourService)
            Me.props = props
            Me.tours = tours
        End Sub

        <HttpGet>
        Public Async Function List(<FromQuery> filter As PropertyFilter, ct As CancellationToken) As Task(Of PagedResult(Of PropertyListItem))
            Return Await props.ListAsync(filter, ct)
        End Function

        <HttpGet("{id:long}")>
        Public Async Function [Get](id As Long, ct As CancellationToken) As Task(Of PropertyDetail)
            Return Await props.GetAsync(id, ct)
        End Function

        <HttpPost>
        Public Async Function Create(r As SavePropertyRequest, ct As CancellationToken) As Task(Of PropertyDetail)
            Return Await props.CreateAsync(r, ct)
        End Function

        <HttpPut("{id:long}")>
        Public Async Function Update(id As Long, r As SavePropertyRequest, ct As CancellationToken) As Task(Of PropertyDetail)
            Return Await props.UpdateAsync(id, r, ct)
        End Function

        Public Class ActiveBody
            Public Property Active As Boolean
        End Class

        <HttpPatch("{id:long}/active")>
        Public Async Function SetActive(id As Long, body As ActiveBody, ct As CancellationToken) As Task(Of IActionResult)
            Await props.SetActiveAsync(id, body.Active, ct)
            Return NoContent()
        End Function

        ' ---- units
        <HttpPost("{id:long}/units")>
        Public Async Function AddUnit(id As Long, r As SaveUnitRequest, ct As CancellationToken) As Task(Of UnitDto)
            Return Await props.AddUnitAsync(id, r, ct)
        End Function

        <HttpPut("units/{unitId:long}")>
        Public Async Function UpdateUnit(unitId As Long, r As SaveUnitRequest, ct As CancellationToken) As Task(Of UnitDto)
            Return Await props.UpdateUnitAsync(unitId, r, ct)
        End Function

        <HttpDelete("units/{unitId:long}")>
        Public Async Function DeleteUnit(unitId As Long, ct As CancellationToken) As Task(Of IActionResult)
            Await props.DeleteUnitAsync(unitId, ct)
            Return NoContent()
        End Function

        ' ---- house tour (ordered room stops built from this property's photos)
        <HttpGet("units/{unitId:long}/tour")>
        Public Async Function GetTour(unitId As Long, ct As CancellationToken) As Task(Of UnitTourDto)
            Return Await tours.GetTourAsync(unitId, ct)
        End Function

        <HttpPut("units/{unitId:long}/tour")>
        Public Async Function SaveTour(unitId As Long, r As SaveTourRequest, ct As CancellationToken) As Task(Of UnitTourDto)
            Return Await tours.SaveTourAsync(unitId, r, ct)
        End Function

        ' ---- images
        <HttpPost("{id:long}/images")>
        <RequestSizeLimit(40 * 1024 * 1024)>
        Public Async Function UploadImages(id As Long, <FromForm> files As List(Of IFormFile), ct As CancellationToken) As Task(Of IReadOnlyList(Of ImageDto))
            If files Is Nothing OrElse files.Count = 0 OrElse files.Count > 10 Then
                Throw New BusinessRuleException("Upload between 1 and 10 images at a time.")
            End If
            Dim result As New List(Of ImageDto)()
            For Each f In files
                Using s = f.OpenReadStream()
                    result.Add(Await props.AddImageAsync(id, s, f.FileName, ct))
                End Using
            Next
            Return result
        End Function

        <HttpDelete("images/{imageId:long}")>
        Public Async Function DeleteImage(imageId As Long, ct As CancellationToken) As Task(Of IActionResult)
            Await props.DeleteImageAsync(imageId, ct)
            Return NoContent()
        End Function

        <HttpPatch("images/{imageId:long}/cover")>
        Public Async Function SetCover(imageId As Long, ct As CancellationToken) As Task(Of IActionResult)
            Await props.SetCoverImageAsync(imageId, ct)
            Return NoContent()
        End Function
    End Class

    <Route("api/v1/tenants")>
    Public Class TenantsController
        Inherits ApiControllerBase

        Private ReadOnly tenants As ITenantService

        Public Sub New(tenants As ITenantService)
            Me.tenants = tenants
        End Sub

        <HttpGet("me")>
        Public Async Function Mine(ct As CancellationToken) As Task(Of TenantProfileDto)
            Return Await tenants.GetMineAsync(ct)
        End Function

        <HttpPut("me")>
        Public Async Function UpdateMine(r As UpdateTenantProfileRequest, ct As CancellationToken) As Task(Of TenantProfileDto)
            Return Await tenants.UpdateMineAsync(r, ct)
        End Function

        <HttpGet>
        Public Async Function List(<FromQuery> search As String, <FromQuery> Optional page As Integer = 1,
                                   <FromQuery> Optional pageSize As Integer = 20, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of TenantListItem))
            Return Await tenants.ListAsync(search, New PageQuery(page, pageSize), ct)
        End Function

        <HttpGet("{id:long}")>
        Public Async Function [Get](id As Long, ct As CancellationToken) As Task(Of TenantProfileDto)
            Return Await tenants.GetAsync(id, ct)
        End Function

        Public Class UploadDocumentForm
            Public Property DocType As String = "other"
            Public Property ApplicationId As Long?
            Public Property File As IFormFile
        End Class

        <HttpPost("documents")>
        <RequestSizeLimit(12 * 1024 * 1024)>
        Public Async Function Upload(<FromForm> form As UploadDocumentForm, ct As CancellationToken) As Task(Of DocumentDto)
            If form.File Is Nothing Then Throw New BusinessRuleException("Please choose a file to upload.")
            Using s = form.File.OpenReadStream()
                Return Await tenants.UploadDocumentAsync(form.DocType, form.ApplicationId, s, form.File.FileName, ct)
            End Using
        End Function

        <HttpDelete("documents/{id:long}")>
        Public Async Function Delete(id As Long, ct As CancellationToken) As Task(Of IActionResult)
            Await tenants.DeleteDocumentAsync(id, ct)
            Return NoContent()
        End Function

        Public Class VerifyBody
            Public Property Verified As Boolean
        End Class

        <HttpPatch("documents/{id:long}/verify")>
        Public Async Function Verify(id As Long, body As VerifyBody, ct As CancellationToken) As Task(Of IActionResult)
            Await tenants.VerifyDocumentAsync(id, body.Verified, ct)
            Return NoContent()
        End Function

        <HttpGet("documents/{id:long}/file")>
        Public Async Function Download(id As Long, ct As CancellationToken) As Task(Of IActionResult)
            Dim f = Await tenants.DownloadDocumentAsync(id, ct)
            Return Me.File(f.Content, f.ContentType, f.FileName)
        End Function
    End Class

End Namespace
