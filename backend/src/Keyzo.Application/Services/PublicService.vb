Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class UnitCard
        Public Property UnitId As Long
        Public Property PropertyId As Long
        Public Property PropertyName As String
        Public Property PropertyType As String
        Public Property City As String
        Public Property State As String
        Public Property UnitNumber As String
        Public Property Bedrooms As Byte
        Public Property Bathrooms As Byte
        Public Property AreaSqft As Decimal
        Public Property MonthlyRent As Decimal
        Public Property DepositAmount As Decimal
        Public Property CoverImage As String
        Public Property Amenities As IReadOnlyList(Of String)
    End Class

    Public Class PublicUnitDetail
        Public Property Card As UnitCard
        Public Property Description As String
        Public Property PropertyDescription As String
        Public Property AddressLine As String
        Public Property PostalCode As String
        Public Property FloorNo As Short
        Public Property Images As IReadOnlyList(Of String)
        Public Property Amenities As IReadOnlyList(Of AmenityDto)
        Public Property OtherAvailableUnits As Integer
        Public Property Reserved As Boolean
    End Class

    Public Class PublicStats
        Public Property Properties As Integer
        Public Property Units As Integer
        Public Property OccupiedUnits As Integer
        Public Property Cities As Integer
        Public Property ActiveLeases As Integer
        Public Property OccupancyPct As Decimal
    End Class

    Public Class UnitSearch
        Public Property Q As String
        Public Property City As String
        Public Property MinRent As Decimal?
        Public Property MaxRent As Decimal?
        Public Property Bedrooms As Integer?
        Public Property Type As String
        Public Property Sort As String
        Public Property Page As Integer = 1
        Public Property PageSize As Integer = 12
    End Class

    ''' <summary>Anonymous endpoints: the public marketing site and the "browse available units" page.</summary>
    Public Interface IPublicService
        Function SearchUnitsAsync(search As UnitSearch, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of UnitCard))
        Function GetUnitAsync(unitId As Long, Optional ct As CancellationToken = Nothing) As Task(Of PublicUnitDetail)
        Function CitiesAsync(Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of String))
        Function StatsAsync(Optional ct As CancellationToken = Nothing) As Task(Of PublicStats)
    End Interface

    Public NotInheritable Class PublicService
        Implements IPublicService

        Private ReadOnly db As IAppDbContext
        Private ReadOnly storage As IFileStorage

        Public Sub New(db As IAppDbContext, storage As IFileStorage)
            Me.db = db
            Me.storage = storage
        End Sub

        ''' <summary>Units open for applications: available, and not already reserved by an approved applicant or an active/upcoming lease.</summary>
        Private Function Available() As IQueryable(Of PropertyUnit)
            Dim today = DateOnly.FromDateTime(DateTime.UtcNow)
            Return db.Units.AsNoTracking().Where(Function(u) u.Status = UnitStatus.Available AndAlso u.Property.IsActive AndAlso
                Not db.Leases.Any(Function(l) l.UnitId = u.Id AndAlso l.Status = LeaseStatus.Active AndAlso l.EndDate >= today) AndAlso
                Not db.Applications.Any(Function(a) a.UnitId = u.Id AndAlso a.Status = ApplicationStatus.Approved AndAlso
                    Not db.Leases.Any(Function(l2) l2.ApplicationId.HasValue AndAlso l2.ApplicationId.Value = a.Id)))
        End Function

        Public Async Function SearchUnitsAsync(search As UnitSearch, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of UnitCard)) Implements IPublicService.SearchUnitsAsync
            Dim q = Available()
            If Not String.IsNullOrWhiteSpace(search.Q) Then
                Dim term = search.Q
                q = q.Where(Function(u) u.Property.Name.Contains(term) OrElse u.Property.City.Contains(term) OrElse u.Property.AddressLine.Contains(term))
            End If
            If Not String.IsNullOrWhiteSpace(search.City) Then
                Dim city = search.City
                q = q.Where(Function(u) u.Property.City = city)
            End If
            If Not String.IsNullOrWhiteSpace(search.Type) Then
                Dim propertyType = search.Type
                q = q.Where(Function(u) u.Property.PropertyType = propertyType)
            End If
            If search.MinRent.HasValue Then
                Dim minRent = search.MinRent.Value
                q = q.Where(Function(u) u.MonthlyRent >= minRent)
            End If
            If search.MaxRent.HasValue Then
                Dim maxRent = search.MaxRent.Value
                q = q.Where(Function(u) u.MonthlyRent <= maxRent)
            End If
            If search.Bedrooms.HasValue Then
                Dim beds = search.Bedrooms.Value
                If beds >= 4 Then
                    q = q.Where(Function(u) u.Bedrooms >= 4)
                Else
                    q = q.Where(Function(u) u.Bedrooms = beds)
                End If
            End If

            Select Case search.Sort
                Case "rent_asc"
                    q = q.OrderBy(Function(u) u.MonthlyRent)
                Case "rent_desc"
                    q = q.OrderByDescending(Function(u) u.MonthlyRent)
                Case "area_desc"
                    q = q.OrderByDescending(Function(u) u.AreaSqft)
                Case Else
                    q = q.OrderByDescending(Function(u) u.Id)
            End Select

            Dim page = Await q.Select(Function(u) New With {
                    Key .Id = u.Id,
                    Key .PropertyId = u.PropertyId,
                    Key .PropertyName = u.Property.Name,
                    Key .PropertyType = u.Property.PropertyType,
                    Key .City = u.Property.City,
                    Key .State = u.Property.State,
                    Key .UnitNumber = u.UnitNumber,
                    Key .Bedrooms = u.Bedrooms,
                    Key .Bathrooms = u.Bathrooms,
                    Key .AreaSqft = u.AreaSqft,
                    Key .MonthlyRent = u.MonthlyRent,
                    Key .DepositAmount = u.DepositAmount,
                    Key .Cover = u.Property.Images.OrderByDescending(Function(i) i.IsCover).ThenBy(Function(i) i.SortOrder).Select(Function(i) i.FilePath).FirstOrDefault(),
                    Key .Amenities = u.Property.PropertyAmenities.Select(Function(a) a.Amenity.Name).Take(4).ToList()
                }).ToPagedAsync(New PageQuery(search.Page, search.PageSize), ct)

            Dim cards = page.Items.Select(Function(x) New UnitCard With {
                .UnitId = x.Id,
                .PropertyId = x.PropertyId,
                .PropertyName = x.PropertyName,
                .PropertyType = x.PropertyType,
                .City = x.City,
                .State = x.State,
                .UnitNumber = x.UnitNumber,
                .Bedrooms = x.Bedrooms,
                .Bathrooms = x.Bathrooms,
                .AreaSqft = x.AreaSqft,
                .MonthlyRent = x.MonthlyRent,
                .DepositAmount = x.DepositAmount,
                .CoverImage = If(x.Cover Is Nothing, Nothing, storage.PublicUrl(x.Cover)),
                .Amenities = x.Amenities
            }).ToList()
            Return New PagedResult(Of UnitCard)(cards, page.Total, page.Page, page.PageSize)
        End Function

        Public Async Function GetUnitAsync(unitId As Long, Optional ct As CancellationToken = Nothing) As Task(Of PublicUnitDetail) Implements IPublicService.GetUnitAsync
            Dim u = Await db.Units.AsNoTracking().
                Include("Property.Images").
                Include("Property.PropertyAmenities.Amenity").
                FirstOrDefaultAsync(Function(x) x.Id = unitId AndAlso x.Property.IsActive AndAlso x.Status <> UnitStatus.Inactive, ct)
            If u Is Nothing Then Throw New NotFoundException("This unit is no longer listed.")

            Dim images = u.Property.Images.OrderByDescending(Function(i) i.IsCover).ThenBy(Function(i) i.SortOrder).Select(Function(i) storage.PublicUrl(i.FilePath)).ToList()
            Dim amenities = u.Property.PropertyAmenities.Select(Function(a) New AmenityDto With {.Id = a.Amenity.Id, .Name = a.Amenity.Name, .Icon = a.Amenity.Icon}).OrderBy(Function(a) a.Name).ToList()
            Dim unitPropertyId = u.PropertyId
            Dim thisUnitId = u.Id
            Dim others = Await Available().CountAsync(Function(x) x.PropertyId = unitPropertyId AndAlso x.Id <> thisUnitId, ct)
            Dim reserved = u.Status <> UnitStatus.Available
            If Not reserved Then reserved = Not Await Available().AnyAsync(Function(x) x.Id = thisUnitId, ct)

            Dim card As New UnitCard With {
                .UnitId = u.Id,
                .PropertyId = u.PropertyId,
                .PropertyName = u.Property.Name,
                .PropertyType = u.Property.PropertyType,
                .City = u.Property.City,
                .State = u.Property.State,
                .UnitNumber = u.UnitNumber,
                .Bedrooms = u.Bedrooms,
                .Bathrooms = u.Bathrooms,
                .AreaSqft = u.AreaSqft,
                .MonthlyRent = u.MonthlyRent,
                .DepositAmount = u.DepositAmount,
                .CoverImage = images.FirstOrDefault(),
                .Amenities = amenities.Select(Function(a) a.Name).Take(4).ToList()
            }
            Return New PublicUnitDetail With {
                .Card = card,
                .Description = u.Description,
                .PropertyDescription = u.Property.Description,
                .AddressLine = u.Property.AddressLine,
                .PostalCode = u.Property.PostalCode,
                .FloorNo = u.FloorNo,
                .Images = images,
                .Amenities = amenities,
                .OtherAvailableUnits = others,
                .Reserved = reserved
            }
        End Function

        Public Async Function CitiesAsync(Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of String)) Implements IPublicService.CitiesAsync
            Return Await db.Properties.AsNoTracking().Where(Function(p) p.IsActive).Select(Function(p) p.City).Distinct().OrderBy(Function(c) c).ToListAsync(ct)
        End Function

        Public Async Function StatsAsync(Optional ct As CancellationToken = Nothing) As Task(Of PublicStats) Implements IPublicService.StatsAsync
            Dim today = DateOnly.FromDateTime(DateTime.UtcNow)
            Dim props = Await db.Properties.CountAsync(Function(p) p.IsActive, ct)
            Dim units = Await db.Units.CountAsync(Function(u) u.Property.IsActive AndAlso u.Status <> UnitStatus.Inactive, ct)
            Dim occupied = Await db.Units.CountAsync(Function(u) u.Property.IsActive AndAlso u.Status = UnitStatus.Occupied, ct)
            Dim cities = Await db.Properties.Where(Function(p) p.IsActive).Select(Function(p) p.City).Distinct().CountAsync(ct)
            Dim leases = Await db.Leases.CountAsync(Function(l) l.Status = LeaseStatus.Active AndAlso l.StartDate <= today AndAlso l.EndDate >= today, ct)
            Return New PublicStats With {
                .Properties = props,
                .Units = units,
                .OccupiedUnits = occupied,
                .Cities = cities,
                .ActiveLeases = leases,
                .OccupancyPct = If(units = 0, 0D, Math.Round(100D * occupied / units, 1))
            }
        End Function
    End Class

End Namespace
