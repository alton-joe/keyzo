Imports System.Security.Claims
Imports System.Text
Imports System.Text.Json.Serialization
Imports System.Threading.RateLimiting
Imports Keyzo.Api.Infrastructure
Imports Keyzo.Application
Imports Keyzo.Infrastructure
Imports Keyzo.Infrastructure.Security
Imports Keyzo.Infrastructure.Storage
Imports Microsoft.AspNetCore.Authentication.JwtBearer
Imports Microsoft.AspNetCore.Authorization
Imports Microsoft.AspNetCore.Builder
Imports Microsoft.AspNetCore.Hosting
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.RateLimiting
Imports Microsoft.AspNetCore.StaticFiles
Imports Microsoft.Extensions.Configuration
Imports Microsoft.Extensions.DependencyInjection
Imports Microsoft.Extensions.FileProviders
Imports Microsoft.Extensions.Hosting
Imports Microsoft.IdentityModel.Tokens
Imports Microsoft.OpenApi
Imports Serilog

Public Module Program

    Public Sub Main(args As String())
        Dim builder = WebApplication.CreateBuilder(args)

        builder.Host.UseSerilog(
            Sub(ctx, lc)
                lc.ReadFrom.Configuration(ctx.Configuration).Enrich.FromLogContext().
                    WriteTo.Console(outputTemplate:="[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
            End Sub)

        ' ---------------------------------------------------------------- services
        builder.Services.AddHttpContextAccessor()
        builder.Services.AddScoped(Of ICurrentUser, HttpCurrentUser)()
        builder.Services.AddKeyzoApplication()
        builder.Services.AddKeyzoInfrastructure(builder.Configuration, builder.Environment.ContentRootPath)

        builder.Services.AddControllers().
            AddJsonOptions(Sub(o) o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never)

        ' JWT
        Dim jwt = If(builder.Configuration.GetSection("Jwt").Get(Of JwtOptions)(), New JwtOptions())
        If String.IsNullOrWhiteSpace(jwt.Secret) OrElse jwt.Secret.Length < 32 Then
            Throw New InvalidOperationException("Jwt:Secret must be configured (32+ characters). Set it with: dotnet user-secrets set ""Jwt:Secret"" ""<random string>""")
        End If

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).
            AddJwtBearer(
                Sub(o)
                    o.MapInboundClaims = False
                    o.TokenValidationParameters = New TokenValidationParameters With {
                        .ValidateIssuer = True, .ValidIssuer = jwt.Issuer,
                        .ValidateAudience = True, .ValidAudience = jwt.Audience,
                        .ValidateIssuerSigningKey = True, .IssuerSigningKey = New SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
                        .ValidateLifetime = True, .ClockSkew = TimeSpan.FromSeconds(30),
                        .RoleClaimType = ClaimTypes.Role, .NameClaimType = "name"
                    }
                End Sub)
        builder.Services.AddAuthorization(
            Sub(o)
                ' everything needs a token unless [AllowAnonymous]
                o.FallbackPolicy = New AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build()
            End Sub)

        ' CORS for the SPA
        Dim origins = If(builder.Configuration.GetSection("Cors:Origins").Get(Of String())(), New String() {"http://localhost:5173"})
        builder.Services.AddCors(Sub(o) o.AddDefaultPolicy(Sub(p) p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()))

        ' rate limiting (brute-force protection on auth endpoints)
        builder.Services.AddRateLimiter(
            Sub(o)
                o.RejectionStatusCode = StatusCodes.Status429TooManyRequests
                o.AddPolicy(Of String)("auth",
                    Function(ctx) RateLimitPartition.GetFixedWindowLimiter(Of String)(
                        If(ctx.Connection.RemoteIpAddress?.ToString(), "anon"),
                        Function(key) New FixedWindowRateLimiterOptions With {
                            .PermitLimit = 30,
                            .Window = TimeSpan.FromMinutes(1),
                            .QueueLimit = 0
                        }))
            End Sub)

        builder.Services.AddEndpointsApiExplorer()
        builder.Services.AddSwaggerGen(
            Sub(c)
                c.SwaggerDoc("v1", New OpenApiInfo With {.Title = "Keyzo API", .Version = "v1", .Description = "Rental Property Management System"})
                c.AddSecurityDefinition("Bearer", New OpenApiSecurityScheme With {.Type = SecuritySchemeType.Http, .Scheme = "bearer", .BearerFormat = "JWT"})
            End Sub)

        builder.Services.Configure(Of Microsoft.AspNetCore.Http.Features.FormOptions)(Sub(o) o.MultipartBodyLengthLimit = 40L * 1024 * 1024)

        ' ---------------------------------------------------------------- pipeline
        Dim app = builder.Build()

        app.UseSerilogRequestLogging()
        app.UseMiddleware(Of ExceptionMiddleware)()
        app.UseCors()
        app.UseRateLimiter()

        ' public property photos are served as static files; tenant documents / maintenance photos are NOT (see IFileStorage)
        Dim storage = app.Services.GetRequiredService(Of LocalFileStorage)()
        app.UseStaticFiles(New StaticFileOptions With {.FileProvider = New PhysicalFileProvider(storage.PublicRoot), .RequestPath = "/uploads"})

        app.UseAuthentication()
        app.UseAuthorization()

        app.UseSwagger()
        app.UseSwaggerUI(Sub(c) c.SwaggerEndpoint("/swagger/v1/swagger.json", "Keyzo API v1"))

        app.MapGet("/health", New Func(Of IResult)(Function() Results.Ok(New With {.status = "ok", .time = DateTime.UtcNow}))).AllowAnonymous()
        app.MapControllers()

        app.Run()
    End Sub

End Module
