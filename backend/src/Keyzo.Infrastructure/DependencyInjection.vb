Imports System.Runtime.CompilerServices
Imports Keyzo.Application
Imports Keyzo.Infrastructure.Jobs
Imports Keyzo.Infrastructure.Persistence
Imports Keyzo.Infrastructure.Security
Imports Keyzo.Infrastructure.Storage
Imports Microsoft.EntityFrameworkCore
Imports Microsoft.Extensions.Configuration
Imports Microsoft.Extensions.DependencyInjection
Imports Microsoft.Extensions.Options
Imports MySqlConnector

Public Module DependencyInjection

    Public Function BuildConnectionString(config As IConfiguration) As String
        Dim direct = config.GetConnectionString("Default")
        If Not String.IsNullOrWhiteSpace(direct) Then Return direct

        Dim csb As New MySqlConnectionStringBuilder With {
            .Server = If(config("Database:Host"), "localhost"),
            .Port = UInteger.Parse(If(config("Database:Port"), "3306")),
            .Database = If(config("Database:Name"), "keyzo"),
            .UserID = If(config("Database:User"), "root"),
            .Password = If(config("Database:Password"), ""),
            .ConnectionTimeout = 15,
            .AllowUserVariables = True
        }
        Return csb.ConnectionString
    End Function

    <Extension>
    Public Function AddKeyzoInfrastructure(services As IServiceCollection, config As IConfiguration, contentRoot As String) As IServiceCollection
        Dim connectionString = BuildConnectionString(config)
        services.AddDbContext(Of KeyzoDbContext)(
            Sub(o) o.UseMySql(connectionString, New MySqlServerVersion(New Version(8, 0, 36))).UseSnakeCaseNamingConvention())
        services.AddScoped(Of IAppDbContext)(Function(sp) sp.GetRequiredService(Of KeyzoDbContext)())
        services.AddScoped(Of IStoredProcedures, StoredProcedures)()

        services.Configure(Of JwtOptions)(config.GetSection("Jwt"))
        services.AddSingleton(Of IPasswordHasher, BcryptPasswordHasher)()
        services.AddSingleton(Of ITokenService, JwtTokenService)()

        services.Configure(Of StorageOptions)(config.GetSection("Storage"))
        services.AddSingleton(Of LocalFileStorage)(Function(sp) New LocalFileStorage(sp.GetRequiredService(Of IOptions(Of StorageOptions))(), contentRoot))
        services.AddSingleton(Of IFileStorage)(Function(sp) sp.GetRequiredService(Of LocalFileStorage)())

        If config.GetValue(Of Boolean)("Jobs:Enabled", True) Then services.AddHostedService(Of DailyJobService)()
        Return services
    End Function

End Module
