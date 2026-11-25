# Keyzo API (ASP.NET Core / VB.NET). Build context = this folder (backend/).
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish src/Keyzo.Api/Keyzo.Api.vbproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_ENVIRONMENT=Production
# Railway/Render inject $PORT; the "Urls" config key overrides appsettings.json
ENTRYPOINT ["sh", "-c", "Urls=http://0.0.0.0:${PORT:-8080} exec dotnet Keyzo.Api.dll"]
