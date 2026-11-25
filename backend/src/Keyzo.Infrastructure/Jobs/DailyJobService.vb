Imports Keyzo.Application
Imports Microsoft.Extensions.DependencyInjection
Imports Microsoft.Extensions.Hosting
Imports Microsoft.Extensions.Logging

Namespace Jobs

    ''' <summary>
    ''' Runs sp_daily_jobs (expire leases, sync unit status, generate invoices, late fees, reminders) at start-up
    ''' and then every 6 hours. The procedure is idempotent, so repeated runs are safe on multiple instances.
    ''' </summary>
    Public NotInheritable Class DailyJobService
        Inherits BackgroundService

        Private ReadOnly scopes As IServiceScopeFactory
        Private ReadOnly log As ILogger(Of DailyJobService)

        Public Sub New(scopes As IServiceScopeFactory, log As ILogger(Of DailyJobService))
            Me.scopes = scopes
            Me.log = log
        End Sub

        Protected Overrides Async Function ExecuteAsync(stoppingToken As CancellationToken) As Task
            Await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken)
            Using timer As New PeriodicTimer(TimeSpan.FromHours(6))
                Do
                    Try
                        Using scope = scopes.CreateScope()
                            Dim procs = scope.ServiceProvider.GetRequiredService(Of IStoredProcedures)()
                            Await procs.RunDailyJobsAsync(DateOnly.FromDateTime(DateTime.UtcNow), stoppingToken)
                            log.LogInformation("Daily jobs completed")
                        End Using
                    Catch ex As OperationCanceledException
                        ' shutting down
                    Catch ex As Exception
                        log.LogError(ex, "Daily jobs failed")
                    End Try
                Loop While Await timer.WaitForNextTickAsync(stoppingToken)
            End Using
        End Function
    End Class

End Namespace
