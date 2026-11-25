Imports System.Runtime.CompilerServices
Imports Keyzo.Application.Security
Imports Keyzo.Application.Services
Imports Microsoft.Extensions.DependencyInjection

Public Module DependencyInjection
    <Extension>
    Public Function AddKeyzoApplication(services As IServiceCollection) As IServiceCollection
        services.AddScoped(Of IAccessScope, AccessScope)()
        services.AddScoped(Of IAuditService, AuditService)()
        services.AddScoped(Of INotificationService, NotificationService)()
        services.AddScoped(Of IAuthService, AuthService)()
        services.AddScoped(Of IUserService, UserService)()
        services.AddScoped(Of IPropertyService, PropertyService)()
        services.AddScoped(Of IPublicService, PublicService)()
        services.AddScoped(Of ITourService, TourService)()
        services.AddScoped(Of ITenantService, TenantService)()
        services.AddScoped(Of IApplicationService, ApplicationService)()
        services.AddScoped(Of ILeaseService, LeaseService)()
        services.AddScoped(Of IBillingService, BillingService)()
        services.AddScoped(Of IMaintenanceService, MaintenanceService)()
        services.AddScoped(Of IReportService, ReportService)()
        services.AddSingleton(Of IReceiptPdf, ReceiptPdf)()
        Return services
    End Function
End Module
