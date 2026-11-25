Imports System.ComponentModel.DataAnnotations
Imports System.Globalization
Imports Keyzo.Application.Security
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore
Imports QuestPDF.Fluent   ' extension methods (Page, Row, Column, Text ...)
Imports QuestPDF.Helpers
Imports QuestPDF.Infrastructure

Namespace Services

    Public Class InvoiceDto
        Public Property Id As Long
        Public Property InvoiceNumber As String
        Public Property LeaseId As Long
        Public Property UnitId As Long
        Public Property UnitNumber As String
        Public Property PropertyName As String
        Public Property TenantName As String
        Public Property PeriodMonth As DateOnly
        Public Property IssueDate As DateOnly
        Public Property DueDate As DateOnly
        Public Property Amount As Decimal
        Public Property LateFee As Decimal
        Public Property AmountPaid As Decimal
        Public Property Balance As Decimal
        Public Property Status As String
    End Class

    Public Class PaymentDto
        Public Property Id As Long
        Public Property InvoiceId As Long
        Public Property InvoiceNumber As String
        Public Property ReceiptNumber As String
        Public Property Amount As Decimal
        Public Property PaidAt As DateTime
        Public Property Method As String
        Public Property ReferenceNo As String
        Public Property Note As String
        Public Property TenantName As String
        Public Property UnitNumber As String
        Public Property PropertyName As String
        Public Property RecordedBy As String
    End Class

    Public Class InvoiceDetail
        Public Property Invoice As InvoiceDto
        Public Property Payments As IReadOnlyList(Of PaymentDto)
    End Class

    Public Class RecordPaymentRequest
        Public Property InvoiceId As Long
        <Range(0.01, 100000000)> Public Property Amount As Decimal
        <Required> Public Property Method As String = ""
        <MaxLength(60)> Public Property ReferenceNo As String
        <MaxLength(300)> Public Property Note As String
    End Class

    Public Class GenerateInvoicesRequest
        Public Property Month As DateOnly
    End Class

    Public Class GenerateInvoicesResult
        Public Property Month As DateOnly
        Public Property Created As Integer
    End Class

    Public Class RefundDepositRequest
        <Range(0, 100000000)> Public Property Amount As Decimal
        <MaxLength(300)> Public Property Reason As String
        Public Property Forfeit As Boolean
    End Class

    Public Class InvoiceFilter
        Public Property Status As String
        Public Property LeaseId As Long?
        Public Property PropertyId As Long?
        Public Property Month As DateOnly?
        Public Property Search As String
        Public Property Page As Integer = 1
        Public Property PageSize As Integer = 20
    End Class

    Public Class PaymentFilter
        Public Property InvoiceId As Long?
        Public Property PropertyId As Long?
        Public Property [From] As DateOnly?
        Public Property [To] As DateOnly?
        Public Property Page As Integer = 1
        Public Property PageSize As Integer = 20
    End Class

    Public Interface IBillingService
        Function ListInvoicesAsync(filter As InvoiceFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of InvoiceDto))
        Function GetInvoiceAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of InvoiceDetail)
        Function GenerateInvoicesAsync(request As GenerateInvoicesRequest, Optional ct As CancellationToken = Nothing) As Task(Of GenerateInvoicesResult)
        Function RunDailyJobsAsync(Optional ct As CancellationToken = Nothing) As Task
        Function RecordPaymentAsync(request As RecordPaymentRequest, Optional ct As CancellationToken = Nothing) As Task(Of PaymentDto)
        Function ListPaymentsAsync(filter As PaymentFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of PaymentDto))
        Function ReceiptPdfAsync(paymentId As Long, Optional ct As CancellationToken = Nothing) As Task(Of Byte())
        Function InvoicePdfAsync(invoiceId As Long, Optional ct As CancellationToken = Nothing) As Task(Of Byte())
        Function ListDepositsAsync(status As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of DepositDto))
        Function RefundDepositAsync(depositId As Long, request As RefundDepositRequest, Optional ct As CancellationToken = Nothing) As Task(Of DepositDto)
    End Interface

    Public NotInheritable Class BillingService
        Implements IBillingService

        Private ReadOnly db As IAppDbContext
        Private ReadOnly scope As IAccessScope
        Private ReadOnly current As ICurrentUser
        Private ReadOnly procs As IStoredProcedures
        Private ReadOnly pdf As IReceiptPdf
        Private ReadOnly audit As IAuditService

        Public Sub New(db As IAppDbContext, scope As IAccessScope, current As ICurrentUser, procs As IStoredProcedures, pdf As IReceiptPdf, audit As IAuditService)
            Me.db = db
            Me.scope = scope
            Me.current = current
            Me.procs = procs
            Me.pdf = pdf
            Me.audit = audit
        End Sub

        Private Shared ReadOnly Property UtcToday As DateOnly
            Get
                Return DateOnly.FromDateTime(DateTime.UtcNow)
            End Get
        End Property

        ''' <summary>Shared invoice projection (also used by the dashboard).</summary>
        Public Shared Function ProjectInvoices(q As IQueryable(Of RentInvoice)) As IQueryable(Of InvoiceDto)
            Return q.Select(Function(i) New InvoiceDto With {
                .Id = i.Id,
                .InvoiceNumber = i.InvoiceNumber,
                .LeaseId = i.LeaseId,
                .UnitId = i.Lease.UnitId,
                .UnitNumber = i.Lease.Unit.UnitNumber,
                .PropertyName = i.Lease.Unit.Property.Name,
                .TenantName = i.Lease.Tenant.User.FullName,
                .PeriodMonth = i.PeriodMonth,
                .IssueDate = i.IssueDate,
                .DueDate = i.DueDate,
                .Amount = i.Amount,
                .LateFee = i.LateFee,
                .AmountPaid = i.AmountPaid,
                .Balance = i.Amount + i.LateFee - i.AmountPaid,
                .Status = i.Status
            })
        End Function

        ''' <summary>A pending/partial invoice past its due date is "overdue" even before the nightly job stamps the late fee.</summary>
        Public Shared Function Effective(i As InvoiceDto, today As DateOnly) As InvoiceDto
            If (i.Status = InvoiceStatus.Pending OrElse i.Status = InvoiceStatus.Partial) AndAlso i.DueDate < today AndAlso i.Balance > 0 Then
                i.Status = InvoiceStatus.Overdue
            End If
            Return i
        End Function

        Public Async Function ListInvoicesAsync(filter As InvoiceFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of InvoiceDto)) Implements IBillingService.ListInvoicesAsync
            Dim today = UtcToday
            Dim q = scope.Invoices().AsNoTracking()
            If filter.LeaseId.HasValue Then
                Dim leaseId = filter.LeaseId.Value
                q = q.Where(Function(i) i.LeaseId = leaseId)
            End If
            If filter.PropertyId.HasValue Then
                Dim propertyId = filter.PropertyId.Value
                q = q.Where(Function(i) i.Lease.Unit.PropertyId = propertyId)
            End If
            If filter.Month.HasValue Then
                Dim first = New DateOnly(filter.Month.Value.Year, filter.Month.Value.Month, 1)
                q = q.Where(Function(i) i.PeriodMonth = first)
            End If
            If Not String.IsNullOrWhiteSpace(filter.Search) Then
                Dim search = filter.Search
                q = q.Where(Function(i) i.InvoiceNumber.Contains(search) OrElse i.Lease.Tenant.User.FullName.Contains(search) OrElse i.Lease.Unit.UnitNumber.Contains(search))
            End If

            Select Case filter.Status
                Case "overdue"
                    q = q.Where(Function(i) i.Status = InvoiceStatus.Overdue OrElse ((i.Status = InvoiceStatus.Pending OrElse i.Status = InvoiceStatus.Partial) AndAlso i.DueDate < today))
                Case "pending"
                    q = q.Where(Function(i) (i.Status = InvoiceStatus.Pending OrElse i.Status = InvoiceStatus.Partial) AndAlso i.DueDate >= today)
                Case "paid", "cancelled"
                    Dim wanted = filter.Status
                    q = q.Where(Function(i) i.Status = wanted)
            End Select

            Dim result = Await ProjectInvoices(q.OrderByDescending(Function(i) i.PeriodMonth).ThenByDescending(Function(i) i.Id)).
                ToPagedAsync(New PageQuery(filter.Page, filter.PageSize), ct)
            For Each item In result.Items
                Effective(item, today)
            Next
            Return result
        End Function

        Public Async Function GetInvoiceAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of InvoiceDetail) Implements IBillingService.GetInvoiceAsync
            Dim inv = Await ProjectInvoices(scope.Invoices().AsNoTracking().Where(Function(i) i.Id = id)).FirstOrDefaultAsync(ct)
            If inv Is Nothing Then Throw New NotFoundException("Invoice not found.")
            Dim payments = Await PaymentQuery(scope.Payments().AsNoTracking().Where(Function(p) p.InvoiceId = id).OrderByDescending(Function(p) p.PaidAt)).ToListAsync(ct)
            Return New InvoiceDetail With {.Invoice = Effective(inv, UtcToday), .Payments = payments}
        End Function

        Public Async Function GenerateInvoicesAsync(request As GenerateInvoicesRequest, Optional ct As CancellationToken = Nothing) As Task(Of GenerateInvoicesResult) Implements IBillingService.GenerateInvoicesAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim month = New DateOnly(request.Month.Year, request.Month.Month, 1)
            If month > New DateOnly(UtcToday.Year, UtcToday.Month, 1).AddMonths(1) Then
                Throw New BusinessRuleException("Invoices can be generated up to next month only.")
            End If
            Dim created = Await procs.GenerateInvoicesAsync(month, ct)
            Await audit.LogAsync("generate_invoices", "rent_invoice", Nothing, New With {.month = month.ToString("yyyy-MM"), .created = created}, ct:=ct)
            Return New GenerateInvoicesResult With {.Month = month, .Created = created}
        End Function

        Public Async Function RunDailyJobsAsync(Optional ct As CancellationToken = Nothing) As Task Implements IBillingService.RunDailyJobsAsync
            If Not current.IsAdmin() Then Throw New ForbiddenException("Only the super admin can trigger the nightly jobs manually.")
            Await procs.RunDailyJobsAsync(UtcToday, ct)
            Await audit.LogAsync("run_daily_jobs", "system", Nothing, ct:=ct)
        End Function

        Public Async Function RecordPaymentAsync(request As RecordPaymentRequest, Optional ct As CancellationToken = Nothing) As Task(Of PaymentDto) Implements IBillingService.RecordPaymentAsync
            If Not PaymentMethod.All.Contains(request.Method) Then
                Throw New BusinessRuleException($"Payment method must be one of: {String.Join(", ", PaymentMethod.All)}.")
            End If
            Dim invoiceId = request.InvoiceId
            If Not Await scope.Invoices().AnyAsync(Function(i) i.Id = invoiceId, ct) Then Throw New NotFoundException("Invoice not found.")
            If current.IsStaff() AndAlso Not current.IsOperator() AndAlso Not current.IsTenant() Then Throw New ForbiddenException()

            Dim paymentId = Await procs.RecordPaymentAsync(request.InvoiceId, request.Amount, request.Method, request.ReferenceNo?.Trim(), request.Note?.Trim(), current.RequiredId(), ct)
            Return Await PaymentQuery(db.Payments.AsNoTracking().Where(Function(p) p.Id = paymentId)).FirstAsync(ct)
        End Function

        Public Function ListPaymentsAsync(filter As PaymentFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of PaymentDto)) Implements IBillingService.ListPaymentsAsync
            Dim q = scope.Payments().AsNoTracking()
            If filter.InvoiceId.HasValue Then
                Dim invoiceId = filter.InvoiceId.Value
                q = q.Where(Function(p) p.InvoiceId = invoiceId)
            End If
            If filter.PropertyId.HasValue Then
                Dim propertyId = filter.PropertyId.Value
                q = q.Where(Function(p) p.Invoice.Lease.Unit.PropertyId = propertyId)
            End If
            If filter.From.HasValue Then
                Dim startAt = filter.From.Value.ToDateTime(TimeOnly.MinValue)
                q = q.Where(Function(p) p.PaidAt >= startAt)
            End If
            If filter.To.HasValue Then
                Dim endAt = filter.To.Value.AddDays(1).ToDateTime(TimeOnly.MinValue)
                q = q.Where(Function(p) p.PaidAt < endAt)
            End If
            Return PaymentQuery(q.OrderByDescending(Function(p) p.PaidAt).ThenByDescending(Function(p) p.Id)).ToPagedAsync(New PageQuery(filter.Page, filter.PageSize), ct)
        End Function

        Public Async Function ReceiptPdfAsync(paymentId As Long, Optional ct As CancellationToken = Nothing) As Task(Of Byte()) Implements IBillingService.ReceiptPdfAsync
            Dim p = Await PaymentQuery(scope.Payments().AsNoTracking().Where(Function(x) x.Id = paymentId)).FirstOrDefaultAsync(ct)
            If p Is Nothing Then Throw New NotFoundException("Receipt not found.")
            Dim paidInvoiceId = p.InvoiceId
            Dim inv = Await db.Invoices.AsNoTracking().Where(Function(i) i.Id = paidInvoiceId).
                Select(Function(i) New With {
                    Key .PeriodMonth = i.PeriodMonth,
                    Key .Amount = i.Amount,
                    Key .LateFee = i.LateFee,
                    Key .AmountPaid = i.AmountPaid,
                    Key .AddressLine = i.Lease.Unit.Property.AddressLine,
                    Key .City = i.Lease.Unit.Property.City
                }).FirstAsync(ct)
            Return pdf.Render(New ReceiptData With {
                .ReceiptNumber = p.ReceiptNumber,
                .PaidAt = p.PaidAt,
                .Tenant = p.TenantName,
                .Property = p.PropertyName,
                .Address = $"{inv.AddressLine}, {inv.City}",
                .Unit = p.UnitNumber,
                .InvoiceNumber = p.InvoiceNumber,
                .Period = inv.PeriodMonth,
                .Amount = p.Amount,
                .Method = p.Method,
                .Reference = p.ReferenceNo,
                .InvoiceTotal = inv.Amount + inv.LateFee,
                .PaidToDate = inv.AmountPaid,
                .RecordedBy = p.RecordedBy
            })
        End Function

        Public Async Function InvoicePdfAsync(invoiceId As Long, Optional ct As CancellationToken = Nothing) As Task(Of Byte()) Implements IBillingService.InvoicePdfAsync
            Dim inv = Await scope.Invoices().AsNoTracking().Where(Function(i) i.Id = invoiceId).
                Select(Function(i) New With {
                    Key .InvoiceNumber = i.InvoiceNumber,
                    Key .PeriodMonth = i.PeriodMonth,
                    Key .IssueDate = i.IssueDate,
                    Key .DueDate = i.DueDate,
                    Key .Amount = i.Amount,
                    Key .LateFee = i.LateFee,
                    Key .AmountPaid = i.AmountPaid,
                    Key .Status = i.Status,
                    Key .Tenant = i.Lease.Tenant.User.FullName,
                    Key .Email = i.Lease.Tenant.User.Email,
                    Key .Phone = i.Lease.Tenant.User.Phone,
                    Key .PropertyName = i.Lease.Unit.Property.Name,
                    Key .AddressLine = i.Lease.Unit.Property.AddressLine,
                    Key .City = i.Lease.Unit.Property.City,
                    Key .UnitNumber = i.Lease.Unit.UnitNumber,
                    Key .LeaseStart = i.Lease.StartDate,
                    Key .LeaseEnd = i.Lease.EndDate
                }).FirstOrDefaultAsync(ct)
            If inv Is Nothing Then Throw New NotFoundException("Invoice not found.")
            If inv.Status <> InvoiceStatus.Paid Then Throw New BusinessRuleException("The invoice PDF is available once the invoice is fully paid.")
            Dim pays = Await PaymentQuery(scope.Payments().AsNoTracking().Where(Function(p) p.InvoiceId = invoiceId).OrderBy(Function(p) p.PaidAt)).ToListAsync(ct)
            Return pdf.RenderInvoice(New InvoicePdfData With {
                .InvoiceNumber = inv.InvoiceNumber,
                .Period = inv.PeriodMonth,
                .IssueDate = inv.IssueDate,
                .DueDate = inv.DueDate,
                .Tenant = inv.Tenant,
                .TenantEmail = inv.Email,
                .TenantPhone = inv.Phone,
                .Property = inv.PropertyName,
                .Address = $"{inv.AddressLine}, {inv.City}",
                .Unit = inv.UnitNumber,
                .LeaseStart = inv.LeaseStart,
                .LeaseEnd = inv.LeaseEnd,
                .Rent = inv.Amount,
                .LateFee = inv.LateFee,
                .AmountPaid = inv.AmountPaid,
                .Payments = pays.Select(Function(p) New InvoicePdfPayment With {.ReceiptNumber = p.ReceiptNumber, .PaidAt = p.PaidAt, .Method = p.Method, .Reference = p.ReferenceNo, .Amount = p.Amount}).ToList()
            })
        End Function

        Private Shared Function ProjectDeposits(q As IQueryable(Of Deposit)) As IQueryable(Of DepositDto)
            Return q.Select(Function(d) New DepositDto With {
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
            })
        End Function

        Public Function ListDepositsAsync(status As String, page As PageQuery, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of DepositDto)) Implements IBillingService.ListDepositsAsync
            Dim q = scope.Deposits().AsNoTracking()
            If Not String.IsNullOrWhiteSpace(status) Then q = q.Where(Function(d) d.Status = status)
            Return ProjectDeposits(q.OrderByDescending(Function(d) d.ReceivedOn).ThenByDescending(Function(d) d.Id)).ToPagedAsync(page, ct)
        End Function

        Public Async Function RefundDepositAsync(depositId As Long, request As RefundDepositRequest, Optional ct As CancellationToken = Nothing) As Task(Of DepositDto) Implements IBillingService.RefundDepositAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim dep = Await scope.Deposits().Include(Function(x) x.Lease).FirstOrDefaultAsync(Function(x) x.Id = depositId, ct)
            If dep Is Nothing Then Throw New NotFoundException("Deposit not found.")
            If dep.Status = DepositStatus.Refunded OrElse dep.Status = DepositStatus.Forfeited Then
                Throw New BusinessRuleException("This deposit has already been settled.")
            End If
            If dep.Lease.Status = LeaseStatus.Active AndAlso dep.Lease.EndDate >= UtcToday Then
                Throw New BusinessRuleException("A deposit can only be settled after the lease has ended or been terminated.")
            End If

            If request.Forfeit Then
                dep.Status = DepositStatus.Forfeited
                dep.RefundedAmount = 0
            Else
                If request.Amount > dep.Amount - dep.RefundedAmount Then Throw New BusinessRuleException("The refund exceeds the deposit held.")
                dep.RefundedAmount += request.Amount
                dep.Status = If(dep.RefundedAmount >= dep.Amount, DepositStatus.Refunded, DepositStatus.PartiallyRefunded)
                If dep.Status = DepositStatus.PartiallyRefunded AndAlso String.IsNullOrWhiteSpace(request.Reason) Then
                    Throw New BusinessRuleException("Please give the reason for the deduction.")
                End If
            End If
            dep.RefundedOn = UtcToday
            dep.DeductionReason = request.Reason?.Trim()
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync(If(request.Forfeit, "forfeit", "refund"), "deposit", depositId, New With {.Amount = request.Amount}, ct:=ct)

            Return Await ProjectDeposits(scope.Deposits().AsNoTracking().Where(Function(x) x.Id = depositId)).FirstAsync(ct)
        End Function

        Private Function PaymentQuery(q As IQueryable(Of Payment)) As IQueryable(Of PaymentDto)
            Return q.Select(Function(p) New PaymentDto With {
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
                .RecordedBy = db.Users.Where(Function(u) p.RecordedBy.HasValue AndAlso u.Id = p.RecordedBy.Value).Select(Function(u) u.FullName).FirstOrDefault()
            })
        End Function

    End Class

    ' ------------------------------------------------------------------ receipts
    Public Class ReceiptData
        Public Property ReceiptNumber As String
        Public Property PaidAt As DateTime
        Public Property Tenant As String
        Public Property [Property] As String
        Public Property Address As String
        Public Property Unit As String
        Public Property InvoiceNumber As String
        Public Property Period As DateOnly
        Public Property Amount As Decimal
        Public Property Method As String
        Public Property Reference As String
        Public Property InvoiceTotal As Decimal
        Public Property PaidToDate As Decimal
        Public Property RecordedBy As String
    End Class

    Public Class InvoicePdfPayment
        Public Property ReceiptNumber As String
        Public Property PaidAt As DateTime
        Public Property Method As String
        Public Property Reference As String
        Public Property Amount As Decimal
    End Class

    Public Class InvoicePdfData
        Public Property InvoiceNumber As String
        Public Property Period As DateOnly
        Public Property IssueDate As DateOnly
        Public Property DueDate As DateOnly
        Public Property Tenant As String
        Public Property TenantEmail As String
        Public Property TenantPhone As String
        Public Property [Property] As String
        Public Property Address As String
        Public Property Unit As String
        Public Property LeaseStart As DateOnly
        Public Property LeaseEnd As DateOnly
        Public Property Rent As Decimal
        Public Property LateFee As Decimal
        Public Property AmountPaid As Decimal
        Public Property Payments As IReadOnlyList(Of InvoicePdfPayment)
    End Class

    Public Interface IReceiptPdf
        Function Render(data As ReceiptData) As Byte()
        Function RenderInvoice(data As InvoicePdfData) As Byte()
    End Interface

    Public NotInheritable Class ReceiptPdf
        Implements IReceiptPdf

        Private Shared ReadOnly Inr As CultureInfo = CultureInfo.GetCultureInfo("en-IN")

        Private Shared Function Money(v As Decimal) As String
            Return "INR " & v.ToString("N2", Inr)
        End Function

        Shared Sub New()
            QuestPDF.Settings.License = LicenseType.Community
        End Sub

        Public Function Render(d As ReceiptData) As Byte() Implements IReceiptPdf.Render
            Const brand As String = "#111827"
            Dim document = QuestPDF.Fluent.Document.Create(
                Sub(doc)
                    doc.Page(
                        Sub(page)
                            page.Size(PageSizes.A5)
                            page.Margin(28)
                            page.DefaultTextStyle(Function(t) t.FontSize(10).FontColor("#1f2937"))

                            page.Header().Column(
                                Sub(col)
                                    col.Item().Row(
                                        Sub(row)
                                            row.RelativeItem().Text("Keyzo").FontSize(24).Bold().FontColor(brand)
                                            row.ConstantItem(150).AlignRight().Column(
                                                Sub(c)
                                                    c.Item().Text("PAYMENT RECEIPT").Bold().FontSize(11)
                                                    c.Item().Text(d.ReceiptNumber).FontColor("#6b7280")
                                                End Sub)
                                        End Sub)
                                    col.Item().PaddingTop(6).LineHorizontal(1.5F).LineColor(brand)
                                End Sub)

                            page.Content().PaddingVertical(14).Column(
                                Sub(col)
                                    col.Spacing(8)
                                    AddRow(col, "Received from", d.Tenant)
                                    AddRow(col, "Property", $"{d.Property} - Unit {d.Unit}")
                                    AddRow(col, "Address", d.Address)
                                    AddRow(col, "Invoice", $"{d.InvoiceNumber}  ({d.Period.ToString("MMMM yyyy")})")
                                    AddRow(col, "Paid on", d.PaidAt.ToString("dd MMM yyyy, HH:mm") & " UTC")
                                    AddRow(col, "Method", d.Method.Replace("_"c, " "c).ToUpperInvariant() &
                                           If(String.IsNullOrWhiteSpace(d.Reference), "", $"  |  Ref: {d.Reference}"))

                                    col.Item().PaddingTop(10).BorderTop(1).BorderBottom(1).BorderColor("#d1d5db").PaddingVertical(10).Row(
                                        Sub(r)
                                            r.RelativeItem().Text("Amount received").Bold()
                                            r.RelativeItem().AlignRight().Text(Money(d.Amount)).Bold().FontSize(16).FontColor(brand)
                                        End Sub)
                                    AddRow(col, "Invoice total", Money(d.InvoiceTotal))
                                    AddRow(col, "Paid to date", Money(d.PaidToDate))
                                    AddRow(col, "Balance", Money(Math.Max(0D, d.InvoiceTotal - d.PaidToDate)))
                                End Sub)

                            page.Footer().AlignCenter().Text(
                                Sub(t)
                                    t.Span("Recorded by " & If(d.RecordedBy, "system") & "  |  This is a computer-generated receipt.").FontSize(8).FontColor("#6b7280")
                                End Sub)
                        End Sub)
                End Sub)
            Return document.GeneratePdf()
        End Function

        Public Function RenderInvoice(d As InvoicePdfData) As Byte() Implements IReceiptPdf.RenderInvoice
            Const ink As String = "#111827"
            Const muted As String = "#6b7280"
            Const rule As String = "#d1d5db"
            Dim total = d.Rent + d.LateFee
            Dim balance = Math.Max(0D, total - d.AmountPaid)
            Dim document = QuestPDF.Fluent.Document.Create(
                Sub(doc)
                    doc.Page(
                        Sub(page)
                            page.Size(PageSizes.A4)
                            page.Margin(40)
                            page.DefaultTextStyle(Function(t) t.FontSize(10).FontColor(ink))

                            page.Header().Column(
                                Sub(col)
                                    col.Item().Row(
                                        Sub(row)
                                            row.RelativeItem().Column(
                                                Sub(c)
                                                    c.Item().Text("Keyzo").FontSize(20).Bold()
                                                    c.Item().Text("Rental management").FontSize(9).FontColor(muted)
                                                End Sub)
                                            row.ConstantItem(200).AlignRight().Column(
                                                Sub(c)
                                                    c.Item().AlignRight().Text("INVOICE").FontSize(20).Bold()
                                                    c.Item().AlignRight().Text(d.InvoiceNumber).FontColor(muted)
                                                End Sub)
                                        End Sub)
                                    col.Item().PaddingTop(12).LineHorizontal(1).LineColor(ink)
                                End Sub)

                            page.Content().PaddingVertical(20).Column(
                                Sub(col)
                                    col.Spacing(22)

                                    ' billed to / property / invoice details
                                    col.Item().Row(
                                        Sub(row)
                                            row.Spacing(24)
                                            row.RelativeItem().Column(
                                                Sub(c)
                                                    c.Spacing(2)
                                                    c.Item().Text("Billed to").FontSize(8).FontColor(muted)
                                                    c.Item().Text(d.Tenant).Bold()
                                                    If Not String.IsNullOrWhiteSpace(d.TenantEmail) Then c.Item().Text(d.TenantEmail)
                                                    If Not String.IsNullOrWhiteSpace(d.TenantPhone) Then c.Item().Text(d.TenantPhone)
                                                End Sub)
                                            row.RelativeItem().Column(
                                                Sub(c)
                                                    c.Spacing(2)
                                                    c.Item().Text("Property").FontSize(8).FontColor(muted)
                                                    c.Item().Text($"{d.Property} - Unit {d.Unit}").Bold()
                                                    c.Item().Text(d.Address)
                                                    c.Item().Text($"Lease {d.LeaseStart:dd MMM yyyy} to {d.LeaseEnd:dd MMM yyyy}").FontColor(muted)
                                                End Sub)
                                            row.RelativeItem().Column(
                                                Sub(c)
                                                    c.Spacing(2)
                                                    Meta(c, "Billing month", d.Period.ToString("MMMM yyyy"))
                                                    Meta(c, "Issued", d.IssueDate.ToString("dd MMM yyyy"))
                                                    Meta(c, "Due", d.DueDate.ToString("dd MMM yyyy"))
                                                    Meta(c, "Status", "Paid")
                                                End Sub)
                                        End Sub)

                                    ' charges
                                    col.Item().Table(
                                        Sub(t)
                                            t.ColumnsDefinition(Sub(cd)
                                                                    cd.RelativeColumn(5.0F)
                                                                    cd.RelativeColumn(1.6F)
                                                                End Sub)
                                            t.Header(Sub(h)
                                                         HeadCell(h, "Description", False)
                                                         HeadCell(h, "Amount", True)
                                                     End Sub)
                                            BodyCell(t, $"Monthly rent - {d.Period:MMMM yyyy}", False)
                                            BodyCell(t, Money(d.Rent), True)
                                            If d.LateFee > 0 Then
                                                BodyCell(t, "Late fee", False)
                                                BodyCell(t, Money(d.LateFee), True)
                                            End If
                                        End Sub)

                                    ' totals
                                    col.Item().AlignRight().Width(230).Column(
                                        Sub(c)
                                            c.Spacing(4)
                                            TotalRow(c, "Invoice total", Money(total))
                                            TotalRow(c, "Amount paid", Money(d.AmountPaid))
                                            c.Item().PaddingTop(4).BorderTop(1).BorderColor(ink).PaddingTop(6).Row(
                                                Sub(r)
                                                    r.RelativeItem().Text("Balance due").Bold()
                                                    r.AutoItem().Text(Money(balance)).Bold().FontSize(12)
                                                End Sub)
                                        End Sub)

                                    ' payments
                                    col.Item().Column(
                                        Sub(c)
                                            c.Spacing(6)
                                            c.Item().Text("Payments received").Bold()
                                            c.Item().Table(
                                                Sub(t)
                                                    t.ColumnsDefinition(Sub(cd)
                                                                            cd.RelativeColumn(3.1F)
                                                                            cd.RelativeColumn(2.4F)
                                                                            cd.RelativeColumn(1.3F)
                                                                            cd.RelativeColumn(2.0F)
                                                                            cd.RelativeColumn(1.8F)
                                                                        End Sub)
                                                    t.Header(Sub(h)
                                                                 HeadCell(h, "Receipt", False)
                                                                 HeadCell(h, "Paid on", False)
                                                                 HeadCell(h, "Method", False)
                                                                 HeadCell(h, "Reference", False)
                                                                 HeadCell(h, "Amount", True)
                                                             End Sub)
                                                    For Each p In d.Payments
                                                        BodyCell(t, p.ReceiptNumber, False)
                                                        BodyCell(t, p.PaidAt.ToString("dd MMM yyyy, HH:mm"), False)
                                                        BodyCell(t, p.Method.Replace("_"c, " "c).ToUpperInvariant(), False)
                                                        BodyCell(t, If(String.IsNullOrWhiteSpace(p.Reference), "-", p.Reference), False)
                                                        BodyCell(t, Money(p.Amount), True)
                                                    Next
                                                End Sub)
                                        End Sub)
                                End Sub)

                            page.Footer().Column(
                                Sub(c)
                                    c.Item().LineHorizontal(0.5F).LineColor(rule)
                                    c.Item().PaddingTop(6).Row(
                                        Sub(r)
                                            r.RelativeItem().Text("Computer-generated invoice. No signature required.").FontSize(8).FontColor(muted)
                                            r.AutoItem().Text(d.InvoiceNumber).FontSize(8).FontColor(muted)
                                        End Sub)
                                End Sub)
                        End Sub)
                End Sub)
            Return document.GeneratePdf()
        End Function

        Private Shared Sub Meta(col As ColumnDescriptor, label As String, value As String)
            col.Item().Row(
                Sub(r)
                    r.ConstantItem(75).Text(label).FontColor("#6b7280")
                    r.RelativeItem().AlignRight().Text(value)
                End Sub)
        End Sub

        Private Shared Sub TotalRow(col As ColumnDescriptor, label As String, value As String)
            col.Item().Row(
                Sub(r)
                    r.RelativeItem().Text(label).FontColor("#6b7280")
                    r.AutoItem().Text(value)
                End Sub)
        End Sub

        Private Shared Sub HeadCell(h As TableCellDescriptor, text As String, right As Boolean)
            Dim cell = h.Cell().BorderBottom(1).BorderColor("#111827").PaddingVertical(6).PaddingHorizontal(4)
            If right Then cell = cell.AlignRight()
            cell.Text(text).FontSize(9).Bold()
        End Sub

        Private Shared Sub BodyCell(t As TableDescriptor, text As String, right As Boolean)
            Dim cell = t.Cell().BorderBottom(0.5F).BorderColor("#d1d5db").PaddingVertical(6).PaddingHorizontal(4)
            If right Then cell = cell.AlignRight()
            cell.Text(text)
        End Sub

        Private Shared Sub AddRow(col As ColumnDescriptor, label As String, value As String)
            col.Item().Row(
                Sub(r)
                    r.ConstantItem(95).Text(label).FontColor("#6b7280")
                    r.RelativeItem().Text(value)
                End Sub)
        End Sub
    End Class

End Namespace
