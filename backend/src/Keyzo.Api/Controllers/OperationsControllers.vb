Imports Keyzo.Api.Infrastructure
Imports Keyzo.Application
Imports Keyzo.Application.Services
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Mvc

Namespace Controllers

    <Route("api/v1/applications")>
    Public Class ApplicationsController
        Inherits ApiControllerBase

        Private ReadOnly svc As IApplicationService

        Public Sub New(svc As IApplicationService)
            Me.svc = svc
        End Sub

        <HttpGet>
        Public Async Function List(<FromQuery> filter As ApplicationFilter, ct As CancellationToken) As Task(Of PagedResult(Of ApplicationDto))
            Return Await svc.ListAsync(filter, ct)
        End Function

        <HttpGet("{id:long}")>
        Public Async Function [Get](id As Long, ct As CancellationToken) As Task(Of ApplicationDto)
            Return Await svc.GetAsync(id, ct)
        End Function

        <HttpPost>
        Public Async Function Submit(r As SubmitApplicationRequest, ct As CancellationToken) As Task(Of ApplicationDto)
            Return Await svc.SubmitAsync(r, ct)
        End Function

        <HttpPost("{id:long}/decision")>
        Public Async Function Decide(id As Long, r As DecideApplicationRequest, ct As CancellationToken) As Task(Of ApplicationDto)
            Return Await svc.DecideAsync(id, r, ct)
        End Function

        <HttpPost("{id:long}/withdraw")>
        Public Async Function Withdraw(id As Long, ct As CancellationToken) As Task(Of IActionResult)
            Await svc.WithdrawAsync(id, ct)
            Return NoContent()
        End Function
    End Class

    <Route("api/v1/leases")>
    Public Class LeasesController
        Inherits ApiControllerBase

        Private ReadOnly svc As ILeaseService

        Public Sub New(svc As ILeaseService)
            Me.svc = svc
        End Sub

        <HttpGet>
        Public Async Function List(<FromQuery> filter As LeaseFilter, ct As CancellationToken) As Task(Of PagedResult(Of LeaseListItem))
            Return Await svc.ListAsync(filter, ct)
        End Function

        <HttpGet("{id:long}")>
        Public Async Function [Get](id As Long, ct As CancellationToken) As Task(Of LeaseDetail)
            Return Await svc.GetAsync(id, ct)
        End Function

        <HttpPost>
        Public Async Function Create(r As CreateLeaseRequest, ct As CancellationToken) As Task(Of LeaseDetail)
            Return Await svc.CreateAsync(r, ct)
        End Function

        <HttpPut("{id:long}")>
        Public Async Function Update(id As Long, r As UpdateLeaseRequest, ct As CancellationToken) As Task(Of LeaseDetail)
            Return Await svc.UpdateAsync(id, r, ct)
        End Function

        <HttpPost("{id:long}/terminate")>
        Public Async Function Terminate(id As Long, ct As CancellationToken) As Task(Of IActionResult)
            Await svc.TerminateAsync(id, ct)
            Return NoContent()
        End Function

        <HttpPost("{id:long}/renewals")>
        Public Async Function RequestRenewal(id As Long, r As RenewalRequest, ct As CancellationToken) As Task(Of RenewalDto)
            Return Await svc.RequestRenewalAsync(id, r, ct)
        End Function

        <HttpGet("renewals")>
        Public Async Function Renewals(<FromQuery> status As String, <FromQuery> Optional page As Integer = 1,
                                       <FromQuery> Optional pageSize As Integer = 20, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of RenewalDto))
            Return Await svc.ListRenewalsAsync(status, New PageQuery(page, pageSize), ct)
        End Function

        <HttpPost("renewals/{renewalId:long}/decision")>
        Public Async Function DecideRenewal(renewalId As Long, r As DecideRenewalRequest, ct As CancellationToken) As Task(Of LeaseDetail)
            Return Await svc.DecideRenewalAsync(renewalId, r, ct)
        End Function
    End Class

    <Route("api/v1")>
    Public Class BillingController
        Inherits ApiControllerBase

        Private ReadOnly svc As IBillingService

        Public Sub New(svc As IBillingService)
            Me.svc = svc
        End Sub

        <HttpGet("invoices")>
        Public Async Function Invoices(<FromQuery> filter As InvoiceFilter, ct As CancellationToken) As Task(Of PagedResult(Of InvoiceDto))
            Return Await svc.ListInvoicesAsync(filter, ct)
        End Function

        <HttpGet("invoices/{id:long}")>
        Public Async Function Invoice(id As Long, ct As CancellationToken) As Task(Of InvoiceDetail)
            Return Await svc.GetInvoiceAsync(id, ct)
        End Function

        <HttpPost("invoices/generate")>
        Public Async Function Generate(r As GenerateInvoicesRequest, ct As CancellationToken) As Task(Of GenerateInvoicesResult)
            Return Await svc.GenerateInvoicesAsync(r, ct)
        End Function

        <HttpPost("jobs/run")>
        Public Async Function RunJobs(ct As CancellationToken) As Task(Of IActionResult)
            Await svc.RunDailyJobsAsync(ct)
            Return NoContent()
        End Function

        <HttpPost("payments")>
        Public Async Function Pay(r As RecordPaymentRequest, ct As CancellationToken) As Task(Of PaymentDto)
            Return Await svc.RecordPaymentAsync(r, ct)
        End Function

        <HttpGet("payments")>
        Public Async Function Payments(<FromQuery> filter As PaymentFilter, ct As CancellationToken) As Task(Of PagedResult(Of PaymentDto))
            Return Await svc.ListPaymentsAsync(filter, ct)
        End Function

        <HttpGet("invoices/{id:long}/pdf")>
        Public Async Function InvoicePdf(id As Long, ct As CancellationToken) As Task(Of IActionResult)
            Dim pdf = Await svc.InvoicePdfAsync(id, ct)
            Return Me.File(pdf, "application/pdf", $"keyzo-invoice-{id}.pdf")
        End Function

        <HttpGet("payments/{id:long}/receipt")>
        Public Async Function Receipt(id As Long, ct As CancellationToken) As Task(Of IActionResult)
            Dim pdf = Await svc.ReceiptPdfAsync(id, ct)
            Return Me.File(pdf, "application/pdf", $"keyzo-receipt-{id}.pdf")
        End Function

        <HttpGet("deposits")>
        Public Async Function Deposits(<FromQuery> status As String, <FromQuery> Optional page As Integer = 1,
                                       <FromQuery> Optional pageSize As Integer = 20, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of DepositDto))
            Return Await svc.ListDepositsAsync(status, New PageQuery(page, pageSize), ct)
        End Function

        <HttpPost("deposits/{id:long}/refund")>
        Public Async Function Refund(id As Long, r As RefundDepositRequest, ct As CancellationToken) As Task(Of DepositDto)
            Return Await svc.RefundDepositAsync(id, r, ct)
        End Function
    End Class

    <Route("api/v1/maintenance")>
    Public Class MaintenanceController
        Inherits ApiControllerBase

        Private ReadOnly svc As IMaintenanceService

        Public Sub New(svc As IMaintenanceService)
            Me.svc = svc
        End Sub

        <HttpGet>
        Public Async Function List(<FromQuery> filter As MaintenanceFilter, ct As CancellationToken) As Task(Of PagedResult(Of MaintenanceListItem))
            Return Await svc.ListAsync(filter, ct)
        End Function

        <HttpGet("{id:long}")>
        Public Async Function [Get](id As Long, ct As CancellationToken) As Task(Of MaintenanceDetail)
            Return Await svc.GetAsync(id, ct)
        End Function

        Public Class CreateForm
            Public Property UnitId As Long
            Public Property Title As String = ""
            Public Property Description As String = ""
            Public Property Category As String = "other"
            Public Property Priority As String = "medium"
            Public Property Files As List(Of IFormFile)
        End Class

        <HttpPost>
        <RequestSizeLimit(40 * 1024 * 1024)>
        Public Async Function Create(<FromForm> form As CreateForm, ct As CancellationToken) As Task(Of MaintenanceDetail)
            If String.IsNullOrWhiteSpace(form.Title) OrElse String.IsNullOrWhiteSpace(form.Description) Then
                Throw New BusinessRuleException("Please give the request a title and a description.")
            End If
            Dim streams As New List(Of (Content As Stream, FileName As String))()
            Try
                If form.Files IsNot Nothing Then
                    For Each f In form.Files
                        streams.Add((f.OpenReadStream(), f.FileName))
                    Next
                End If
                Return Await svc.CreateAsync(New CreateMaintenanceRequest With {
                    .UnitId = form.UnitId,
                    .Title = form.Title,
                    .Description = form.Description,
                    .Category = form.Category,
                    .Priority = form.Priority
                }, streams, ct)
            Finally
                For Each s In streams
                    s.Content.Dispose()
                Next
            End Try
        End Function

        <HttpPost("{id:long}/assign")>
        Public Async Function Assign(id As Long, r As AssignRequest, ct As CancellationToken) As Task(Of MaintenanceDetail)
            Return Await svc.AssignAsync(id, r, ct)
        End Function

        <HttpPost("{id:long}/logs")>
        Public Async Function AddLog(id As Long, r As AddLogRequest, ct As CancellationToken) As Task(Of MaintenanceDetail)
            Return Await svc.AddLogAsync(id, r, ct)
        End Function

        <HttpPost("{id:long}/cancel")>
        Public Async Function Cancel(id As Long, ct As CancellationToken) As Task(Of MaintenanceDetail)
            Return Await svc.CancelAsync(id, ct)
        End Function

        <HttpGet("images/{imageId:long}")>
        Public Async Function Image(imageId As Long, ct As CancellationToken) As Task(Of IActionResult)
            Dim f = Await svc.DownloadImageAsync(imageId, ct)
            Return Me.File(f.Content, f.ContentType)
        End Function
    End Class

    <Route("api/v1/expenses")>
    Public Class ExpensesController
        Inherits ApiControllerBase

        Private ReadOnly svc As IMaintenanceService

        Public Sub New(svc As IMaintenanceService)
            Me.svc = svc
        End Sub

        <HttpGet>
        Public Async Function List(<FromQuery> filter As ExpenseFilter, ct As CancellationToken) As Task(Of PagedResult(Of ExpenseDto))
            Return Await svc.ListExpensesAsync(filter, ct)
        End Function

        <HttpPost>
        Public Async Function Create(r As CreateExpenseRequest, ct As CancellationToken) As Task(Of ExpenseDto)
            Return Await svc.CreateExpenseAsync(r, ct)
        End Function

        <HttpDelete("{id:long}")>
        Public Async Function Delete(id As Long, ct As CancellationToken) As Task(Of IActionResult)
            Await svc.DeleteExpenseAsync(id, ct)
            Return NoContent()
        End Function
    End Class

    <Route("api/v1/reports")>
    Public Class ReportsController
        Inherits ApiControllerBase

        Private ReadOnly svc As IReportService

        Public Sub New(svc As IReportService)
            Me.svc = svc
        End Sub

        <HttpGet("dashboard")>
        Public Async Function Dashboard(ct As CancellationToken) As Task(Of DashboardDto)
            Return Await svc.DashboardAsync(ct)
        End Function

        <HttpGet("income")>
        Public Async Function Income(<FromQuery(Name:="from")> fromDate As DateOnly?, <FromQuery(Name:="to")> toDate As DateOnly?,
                                     <FromQuery> propertyId As Long?, ct As CancellationToken) As Task(Of IncomeReport)
            Return Await svc.IncomeAsync(fromDate, toDate, propertyId, ct)
        End Function

        <HttpGet("occupancy")>
        Public Async Function Occupancy(ct As CancellationToken) As Task(Of IReadOnlyList(Of OccupancyPoint))
            Return Await svc.OccupancyAsync(ct)
        End Function

        <HttpGet("outstanding")>
        Public Async Function Outstanding(<FromQuery> propertyId As Long?, ct As CancellationToken) As Task(Of IReadOnlyList(Of OutstandingRow))
            Return Await svc.OutstandingAsync(propertyId, ct)
        End Function

        <HttpGet("expenses")>
        Public Async Function Expenses(<FromQuery(Name:="from")> fromDate As DateOnly?, <FromQuery(Name:="to")> toDate As DateOnly?,
                                       <FromQuery> propertyId As Long?, ct As CancellationToken) As Task(Of ExpenseReport)
            Return Await svc.ExpensesAsync(fromDate, toDate, propertyId, ct)
        End Function

        <HttpGet("tenants/{id:long}")>
        Public Async Function Tenant(id As Long, ct As CancellationToken) As Task(Of TenantReport)
            Return Await svc.TenantAsync(id, ct)
        End Function

        <HttpGet("properties/{id:long}")>
        Public Async Function [Property](id As Long, ct As CancellationToken) As Task(Of PropertyReport)
            Return Await svc.PropertyAsync(id, ct)
        End Function
    End Class

End Namespace
