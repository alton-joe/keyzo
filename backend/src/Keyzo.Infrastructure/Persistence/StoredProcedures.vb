Imports System.Data
Imports Keyzo.Application
Imports Microsoft.EntityFrameworkCore
Imports MySqlConnector

Namespace Persistence

    ''' <summary>Calls the MySQL stored procedures from database/03_routines.sql. Each procedure runs its own transaction in the database.</summary>
    Public NotInheritable Class StoredProcedures
        Implements IStoredProcedures

        Private ReadOnly db As KeyzoDbContext

        Public Sub New(db As KeyzoDbContext)
            Me.db = db
        End Sub

        Public Async Function DecideApplicationAsync(applicationId As Long, approve As Boolean, note As String, userId As Long, Optional ct As CancellationToken = Nothing) As Task Implements IStoredProcedures.DecideApplicationAsync
            Await RunAsync("sp_decide_application", ct,
                P("p_application_id", MySqlDbType.UInt64, applicationId),
                P("p_approve", MySqlDbType.Byte, If(approve, 1, 0)),
                P("p_note", MySqlDbType.VarChar, note),
                P("p_user_id", MySqlDbType.UInt64, userId))
        End Function

        Public Async Function CreateLeaseAsync(cmd As CreateLeaseCommand, Optional ct As CancellationToken = Nothing) As Task(Of Long) Implements IStoredProcedures.CreateLeaseAsync
            Dim id = Out("p_lease_id", MySqlDbType.UInt64)
            Await RunAsync("sp_create_lease", ct,
                P("p_application_id", MySqlDbType.UInt64, cmd.ApplicationId),
                P("p_start_date", MySqlDbType.Date, cmd.StartDate.ToDateTime(TimeOnly.MinValue)),
                P("p_end_date", MySqlDbType.Date, cmd.EndDate.ToDateTime(TimeOnly.MinValue)),
                P("p_monthly_rent", MySqlDbType.NewDecimal, cmd.MonthlyRent),
                P("p_deposit", MySqlDbType.NewDecimal, cmd.SecurityDeposit),
                P("p_due_day", MySqlDbType.UByte, CByte(cmd.RentDueDay)),
                P("p_late_fee", MySqlDbType.NewDecimal, cmd.LateFee),
                P("p_terms", MySqlDbType.Text, cmd.Terms),
                P("p_user_id", MySqlDbType.UInt64, cmd.UserId),
                id)
            Return Convert.ToInt64(id.Value)
        End Function

        Public Async Function TerminateLeaseAsync(leaseId As Long, userId As Long, Optional ct As CancellationToken = Nothing) As Task Implements IStoredProcedures.TerminateLeaseAsync
            Await RunAsync("sp_terminate_lease", ct, P("p_lease_id", MySqlDbType.UInt64, leaseId), P("p_user_id", MySqlDbType.UInt64, userId))
        End Function

        Public Async Function GenerateInvoicesAsync(month As DateOnly, Optional ct As CancellationToken = Nothing) As Task(Of Integer) Implements IStoredProcedures.GenerateInvoicesAsync
            Dim created = Out("p_created", MySqlDbType.Int32)
            Await RunAsync("sp_generate_monthly_invoices", ct, P("p_month", MySqlDbType.Date, month.ToDateTime(TimeOnly.MinValue)), created)
            Return Convert.ToInt32(created.Value)
        End Function

        Public Async Function RecordPaymentAsync(invoiceId As Long, amount As Decimal, method As String, reference As String, note As String, userId As Long, Optional ct As CancellationToken = Nothing) As Task(Of Long) Implements IStoredProcedures.RecordPaymentAsync
            Dim id = Out("p_payment_id", MySqlDbType.UInt64)
            Await RunAsync("sp_record_payment", ct,
                P("p_invoice_id", MySqlDbType.UInt64, invoiceId),
                P("p_amount", MySqlDbType.NewDecimal, amount),
                P("p_method", MySqlDbType.VarChar, method),
                P("p_reference", MySqlDbType.VarChar, reference),
                P("p_note", MySqlDbType.VarChar, note),
                P("p_user_id", MySqlDbType.UInt64, userId),
                id)
            Return Convert.ToInt64(id.Value)
        End Function

        Public Async Function RunDailyJobsAsync([date] As DateOnly, Optional ct As CancellationToken = Nothing) As Task Implements IStoredProcedures.RunDailyJobsAsync
            Await RunAsync("sp_daily_jobs", ct, P("p_date", MySqlDbType.Date, [date].ToDateTime(TimeOnly.MinValue)))
        End Function

        ' ------------------------------------------------------------------ plumbing
        Private Shared Function P(name As String, type As MySqlDbType, value As Object) As MySqlParameter
            Return New MySqlParameter(name, type) With {.Value = If(value, DBNull.Value)}
        End Function

        Private Shared Function Out(name As String, type As MySqlDbType) As MySqlParameter
            Return New MySqlParameter(name, type) With {.Direction = ParameterDirection.Output}
        End Function

        Private Async Function RunAsync(procedure As String, ct As CancellationToken, ParamArray parameters As MySqlParameter()) As Task
            ' a dedicated connection keeps the procedure's own START TRANSACTION isolated from EF's tracked work
            Dim cs = db.Database.GetConnectionString()
            Using conn As New MySqlConnection(cs)
                Await conn.OpenAsync(ct)
                Using cmd As New MySqlCommand(procedure, conn) With {.CommandType = CommandType.StoredProcedure, .CommandTimeout = 120}
                    cmd.Parameters.AddRange(parameters)
                    Try
                        Await cmd.ExecuteNonQueryAsync(ct)
                    Catch ex As MySqlException When MySqlErrors.Translate(ex) IsNot Nothing
                        Throw MySqlErrors.Translate(ex)
                    End Try
                End Using
            End Using
        End Function
    End Class

End Namespace
