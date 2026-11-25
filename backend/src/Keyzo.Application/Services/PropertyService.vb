Imports System.ComponentModel.DataAnnotations
Imports Keyzo.Application.Security
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class AmenityDto
        Public Property Id As Integer
        Public Property Name As String
        Public Property Icon As String
    End Class

    Public Class ImageDto
        Public Property Id As Long
        Public Property Url As String
        Public Property IsCover As Boolean
    End Class

    Public Class PropertyListItem
        Public Property Id As Long
        Public Property Name As String
        Public Property PropertyType As String
        Public Property AddressLine As String
        Public Property City As String
        Public Property State As String
        Public Property IsActive As Boolean
        Public Property OwnerName As String
        Public Property ManagerName As String
        Public Property TotalUnits As Integer
        Public Property OccupiedUnits As Integer
        Public Property MinRent As Decimal?
        Public Property MaxRent As Decimal?
        Public Property CoverImage As String
    End Class

    Public Class UnitDto
        Public Property Id As Long
        Public Property PropertyId As Long
        Public Property UnitNumber As String
        Public Property FloorNo As Short
        Public Property Bedrooms As Byte
        Public Property Bathrooms As Byte
        Public Property AreaSqft As Decimal
        Public Property MonthlyRent As Decimal
        Public Property DepositAmount As Decimal
        Public Property Status As String
        Public Property Description As String
        Public Property CurrentTenant As String
    End Class

    Public Class PropertyDetail
        Public Property Id As Long
        Public Property Name As String
        Public Property Description As String
        Public Property PropertyType As String
        Public Property AddressLine As String
        Public Property City As String
        Public Property State As String
        Public Property PostalCode As String
        Public Property Country As String
        Public Property IsActive As Boolean
        Public Property OwnerId As Long
        Public Property OwnerName As String
        Public Property ManagerId As Long?
        Public Property ManagerName As String
        Public Property Amenities As IReadOnlyList(Of AmenityDto)
        Public Property Images As IReadOnlyList(Of ImageDto)
        Public Property Units As IReadOnlyList(Of UnitDto)
    End Class

    Public Class SavePropertyRequest
        <Required, MaxLength(150)> Public Property Name As String = ""
        <MaxLength(4000)> Public Property Description As String
        <Required> Public Property PropertyType As String = ""
        <Required, MaxLength(250)> Public Property AddressLine As String = ""
        <Required, MaxLength(80)> Public Property City As String = ""
        <Required, MaxLength(80)> Public Property State As String = ""
        <Required, MaxLength(12)> Public Property PostalCode As String = ""
        <MaxLength(60)> Public Property Country As String
        Public Property OwnerId As Long?
        Public Property ManagerId As Long?
        Public Property AmenityIds As List(Of Integer)
    End Class

    Public Class SaveUnitRequest
        <Required, MaxLength(20)> Public Property UnitNumber As String = ""
        Public Property FloorNo As Short
        <Range(0, 20)> Public Property Bedrooms As Byte
        <Range(0, 20)> Public Property Bathrooms As Byte
        <Range(1, 100000)> Public Property AreaSqft As Decimal
        <Range(1, 100000000)> Public Property MonthlyRent As Decimal
        <Range(0, 100000000)> Public Property DepositAmount As Decimal
        Public Property Status As String
        <MaxLength(500)> Public Property Description As String
    End Class

    Public Class PropertyFilter
        Public Property Search As String
        Public Property City As String
        Public Property Type As String
        Public Property Active As Boolean?
        Public Property Page As Integer = 1
        Public Property PageSize As Integer = 12
    End Class

    Public Interface IPropertyService
        Function ListAsync(filter As PropertyFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of PropertyListItem))
        Function GetAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of PropertyDetail)
        Function CreateAsync(request As SavePropertyRequest, Optional ct As CancellationToken = Nothing) As Task(Of PropertyDetail)
        Function UpdateAsync(id As Long, request As SavePropertyRequest, Optional ct As CancellationToken = Nothing) As Task(Of PropertyDetail)
        Function SetActiveAsync(id As Long, active As Boolean, Optional ct As CancellationToken = Nothing) As Task
        Function AddUnitAsync(propertyId As Long, request As SaveUnitRequest, Optional ct As CancellationToken = Nothing) As Task(Of UnitDto)
        Function UpdateUnitAsync(unitId As Long, request As SaveUnitRequest, Optional ct As CancellationToken = Nothing) As Task(Of UnitDto)
        Function DeleteUnitAsync(unitId As Long, Optional ct As CancellationToken = Nothing) As Task
        Function AddImageAsync(propertyId As Long, content As Stream, fileName As String, Optional ct As CancellationToken = Nothing) As Task(Of ImageDto)
        Function DeleteImageAsync(imageId As Long, Optional ct As CancellationToken = Nothing) As Task
        Function SetCoverImageAsync(imageId As Long, Optional ct As CancellationToken = Nothing) As Task
        Function AmenitiesAsync(Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of AmenityDto))
    End Interface

    Public NotInheritable Class PropertyService
        Implements IPropertyService

        Private Shared ReadOnly PropertyTypes As String() = {"apartment", "house", "villa", "studio", "hostel"}
        Private Shared ReadOnly EditableUnitStatuses As String() = {UnitStatus.Available, UnitStatus.Maintenance, UnitStatus.Inactive}

        Private ReadOnly db As IAppDbContext
        Private ReadOnly scope As IAccessScope
        Private ReadOnly current As ICurrentUser
        Private ReadOnly storage As IFileStorage
        Private ReadOnly audit As IAuditService

        Public Sub New(db As IAppDbContext, scope As IAccessScope, current As ICurrentUser, storage As IFileStorage, audit As IAuditService)
            Me.db = db
            Me.scope = scope
            Me.current = current
            Me.storage = storage
            Me.audit = audit
        End Sub

        Public Async Function ListAsync(filter As PropertyFilter, Optional ct As CancellationToken = Nothing) As Task(Of PagedResult(Of PropertyListItem)) Implements IPropertyService.ListAsync
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim q = scope.Properties().AsNoTracking()
            If Not String.IsNullOrWhiteSpace(filter.Search) Then
                Dim search = filter.Search
                q = q.Where(Function(p) p.Name.Contains(search) OrElse p.City.Contains(search) OrElse p.AddressLine.Contains(search))
            End If
            If Not String.IsNullOrWhiteSpace(filter.City) Then
                Dim city = filter.City
                q = q.Where(Function(p) p.City = city)
            End If
            If Not String.IsNullOrWhiteSpace(filter.Type) Then
                Dim propertyType = filter.Type
                q = q.Where(Function(p) p.PropertyType = propertyType)
            End If
            If filter.Active.HasValue Then
                Dim active = filter.Active.Value
                q = q.Where(Function(p) p.IsActive = active)
            End If

            Dim result = Await q.OrderBy(Function(p) p.Name).
                Select(Function(p) New PropertyListItem With {
                    .Id = p.Id,
                    .Name = p.Name,
                    .PropertyType = p.PropertyType,
                    .AddressLine = p.AddressLine,
                    .City = p.City,
                    .State = p.State,
                    .IsActive = p.IsActive,
                    .OwnerName = p.Owner.FullName,
                    .ManagerName = If(p.Manager IsNot Nothing, p.Manager.FullName, Nothing),
                    .TotalUnits = Enumerable.Count(p.Units, Function(u) u.Status <> UnitStatus.Inactive),
                    .OccupiedUnits = Enumerable.Count(p.Units, Function(u) u.Status = UnitStatus.Occupied),
                    .MinRent = p.Units.Min(Function(u) CType(u.MonthlyRent, Decimal?)),
                    .MaxRent = p.Units.Max(Function(u) CType(u.MonthlyRent, Decimal?)),
                    .CoverImage = p.Images.OrderByDescending(Function(i) i.IsCover).ThenBy(Function(i) i.SortOrder).Select(Function(i) i.FilePath).FirstOrDefault()
                }).ToPagedAsync(New PageQuery(filter.Page, filter.PageSize), ct)

            For Each item In result.Items
                If item.CoverImage IsNot Nothing Then item.CoverImage = storage.PublicUrl(item.CoverImage)
            Next
            Return result
        End Function

        Public Async Function GetAsync(id As Long, Optional ct As CancellationToken = Nothing) As Task(Of PropertyDetail) Implements IPropertyService.GetAsync
            Dim p = Await scope.Properties().AsNoTracking().
                Include(Function(x) x.Owner).Include(Function(x) x.Manager).
                Include(Function(x) x.Images).Include("PropertyAmenities.Amenity").
                FirstOrDefaultAsync(Function(x) x.Id = id, ct)
            If p Is Nothing Then Throw New NotFoundException("Property not found.")

            Dim today = DateOnly.FromDateTime(DateTime.UtcNow)
            Dim units = Await db.Units.AsNoTracking().Where(Function(u) u.PropertyId = id).OrderBy(Function(u) u.UnitNumber).
                Select(Function(u) New UnitDto With {
                    .Id = u.Id,
                    .PropertyId = u.PropertyId,
                    .UnitNumber = u.UnitNumber,
                    .FloorNo = u.FloorNo,
                    .Bedrooms = u.Bedrooms,
                    .Bathrooms = u.Bathrooms,
                    .AreaSqft = u.AreaSqft,
                    .MonthlyRent = u.MonthlyRent,
                    .DepositAmount = u.DepositAmount,
                    .Status = u.Status,
                    .Description = u.Description,
                    .CurrentTenant = db.Leases.Where(Function(l) l.UnitId = u.Id AndAlso l.Status = LeaseStatus.Active AndAlso l.StartDate <= today AndAlso l.EndDate >= today).
                        Select(Function(l) l.Tenant.User.FullName).FirstOrDefault()
                }).ToListAsync(ct)

            Return New PropertyDetail With {
                .Id = p.Id,
                .Name = p.Name,
                .Description = p.Description,
                .PropertyType = p.PropertyType,
                .AddressLine = p.AddressLine,
                .City = p.City,
                .State = p.State,
                .PostalCode = p.PostalCode,
                .Country = p.Country,
                .IsActive = p.IsActive,
                .OwnerId = p.OwnerId,
                .OwnerName = p.Owner.FullName,
                .ManagerId = p.ManagerId,
                .ManagerName = p.Manager?.FullName,
                .Amenities = p.PropertyAmenities.Select(Function(a) New AmenityDto With {.Id = a.Amenity.Id, .Name = a.Amenity.Name, .Icon = a.Amenity.Icon}).OrderBy(Function(a) a.Name).ToList(),
                .Images = p.Images.OrderByDescending(Function(i) i.IsCover).ThenBy(Function(i) i.SortOrder).
                    Select(Function(i) New ImageDto With {.Id = i.Id, .Url = storage.PublicUrl(i.FilePath), .IsCover = i.IsCover}).ToList(),
                .Units = units
            }
        End Function

        Public Async Function CreateAsync(request As SavePropertyRequest, Optional ct As CancellationToken = Nothing) As Task(Of PropertyDetail) Implements IPropertyService.CreateAsync
            If Not (current.IsAdmin() OrElse current.IsOwner()) Then Throw New ForbiddenException("Only owners and admins can register properties.")
            Validate(request)

            Dim ownerId As Long
            If current.IsAdmin() Then
                If Not request.OwnerId.HasValue Then Throw New BusinessRuleException("Please choose the property owner.")
                ownerId = request.OwnerId.Value
                Dim ownerRoleId = Roles.IdOf(Roles.Owner)
                Dim chosenOwner = ownerId
                If Not Await db.UserRoles.AnyAsync(Function(x) x.UserId = chosenOwner AndAlso x.RoleId = ownerRoleId, ct) Then
                    Throw New BusinessRuleException("The selected user is not an owner.")
                End If
            Else
                ownerId = current.RequiredId()
            End If

            Await EnsureManagerAsync(request.ManagerId, ct)
            Dim p As New [Property] With {
                .OwnerId = ownerId,
                .ManagerId = request.ManagerId,
                .Name = request.Name.Trim(),
                .Description = request.Description?.Trim(),
                .PropertyType = request.PropertyType,
                .AddressLine = request.AddressLine.Trim(),
                .City = request.City.Trim(),
                .State = request.State.Trim(),
                .PostalCode = request.PostalCode.Trim(),
                .Country = If(String.IsNullOrWhiteSpace(request.Country), "India", request.Country.Trim())
            }
            db.Properties.Add(p)
            Await db.SaveChangesAsync(ct)
            Await SyncAmenitiesAsync(p.Id, request.AmenityIds, ct)
            Await audit.LogAsync("create", "property", p.Id, New With {.Name = p.Name}, ct:=ct)
            Return Await GetAsync(p.Id, ct)
        End Function

        Public Async Function UpdateAsync(id As Long, request As SavePropertyRequest, Optional ct As CancellationToken = Nothing) As Task(Of PropertyDetail) Implements IPropertyService.UpdateAsync
            Validate(request)
            Dim p = Await ManageablePropertyAsync(id, ct)
            ' only owner/admin may reassign the manager
            If (current.IsAdmin() OrElse current.IsOwner()) AndAlso Not Nullable.Equals(p.ManagerId, request.ManagerId) Then
                Await EnsureManagerAsync(request.ManagerId, ct)
                p.ManagerId = request.ManagerId
            End If
            p.Name = request.Name.Trim()
            p.Description = request.Description?.Trim()
            p.PropertyType = request.PropertyType
            p.AddressLine = request.AddressLine.Trim()
            p.City = request.City.Trim()
            p.State = request.State.Trim()
            p.PostalCode = request.PostalCode.Trim()
            If Not String.IsNullOrWhiteSpace(request.Country) Then p.Country = request.Country.Trim()
            p.UpdatedAt = DateTime.UtcNow
            Await db.SaveChangesAsync(ct)
            If request.AmenityIds IsNot Nothing Then Await SyncAmenitiesAsync(id, request.AmenityIds, ct)
            Await audit.LogAsync("update", "property", id, ct:=ct)
            Return Await GetAsync(id, ct)
        End Function

        Public Async Function SetActiveAsync(id As Long, active As Boolean, Optional ct As CancellationToken = Nothing) As Task Implements IPropertyService.SetActiveAsync
            If Not (current.IsAdmin() OrElse current.IsOwner()) Then Throw New ForbiddenException()
            Dim p = Await ManageablePropertyAsync(id, ct)
            Dim today = DateOnly.FromDateTime(DateTime.UtcNow)
            If Not active AndAlso Await db.Leases.AnyAsync(Function(l) l.Unit.PropertyId = id AndAlso l.Status = LeaseStatus.Active AndAlso l.EndDate >= today, ct) Then
                Throw New BusinessRuleException("This property has active leases. Terminate them before deactivating it.")
            End If
            p.IsActive = active
            p.UpdatedAt = DateTime.UtcNow
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync(If(active, "activate", "deactivate"), "property", id, ct:=ct)
        End Function

        ' ------------------------------------------------------------ units
        Public Async Function AddUnitAsync(propertyId As Long, request As SaveUnitRequest, Optional ct As CancellationToken = Nothing) As Task(Of UnitDto) Implements IPropertyService.AddUnitAsync
            Await scope.EnsureCanManagePropertyAsync(propertyId, ct)
            Dim number = request.UnitNumber.Trim()
            If Await db.Units.AnyAsync(Function(u) u.PropertyId = propertyId AndAlso u.UnitNumber = number, ct) Then
                Throw New ConflictException($"Unit '{request.UnitNumber}' already exists in this property.")
            End If
            Dim unit As New PropertyUnit With {.PropertyId = propertyId}
            Apply(unit, request, creating:=True)
            db.Units.Add(unit)
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("create", "unit", unit.Id, New With {.UnitNumber = unit.UnitNumber}, ct:=ct)
            Return ToDto(unit, Nothing)
        End Function

        Public Async Function UpdateUnitAsync(unitId As Long, request As SaveUnitRequest, Optional ct As CancellationToken = Nothing) As Task(Of UnitDto) Implements IPropertyService.UpdateUnitAsync
            Dim unit = Await scope.Units().FirstOrDefaultAsync(Function(u) u.Id = unitId, ct)
            If unit Is Nothing Then Throw New NotFoundException("Unit not found.")
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim number = request.UnitNumber.Trim()
            Dim unitPropertyId = unit.PropertyId
            If Await db.Units.AnyAsync(Function(u) u.PropertyId = unitPropertyId AndAlso u.UnitNumber = number AndAlso u.Id <> unitId, ct) Then
                Throw New ConflictException($"Unit '{request.UnitNumber}' already exists in this property.")
            End If
            Apply(unit, request, creating:=False)
            unit.UpdatedAt = DateTime.UtcNow
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("update", "unit", unit.Id, ct:=ct)
            Return ToDto(unit, Nothing)
        End Function

        Public Async Function DeleteUnitAsync(unitId As Long, Optional ct As CancellationToken = Nothing) As Task Implements IPropertyService.DeleteUnitAsync
            Dim unit = Await scope.Units().FirstOrDefaultAsync(Function(u) u.Id = unitId, ct)
            If unit Is Nothing Then Throw New NotFoundException("Unit not found.")
            If Not (current.IsAdmin() OrElse current.IsOwner()) Then Throw New ForbiddenException()
            If Await db.Leases.AnyAsync(Function(l) l.UnitId = unitId, ct) Then
                Throw New BusinessRuleException("This unit has lease history and cannot be deleted. Mark it inactive instead.")
            End If
            db.Units.Remove(unit)
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("delete", "unit", unitId, ct:=ct)
        End Function

        ' ------------------------------------------------------------ images
        Public Async Function AddImageAsync(propertyId As Long, content As Stream, fileName As String, Optional ct As CancellationToken = Nothing) As Task(Of ImageDto) Implements IPropertyService.AddImageAsync
            Await scope.EnsureCanManagePropertyAsync(propertyId, ct)
            Dim saved = Await storage.SaveAsync(content, fileName, "properties", ct)
            Dim hasCover = Await db.PropertyImages.AnyAsync(Function(i) i.PropertyId = propertyId AndAlso i.IsCover, ct)
            Dim imageCount = Await db.PropertyImages.CountAsync(Function(i) i.PropertyId = propertyId, ct)
            Dim img As New PropertyImage With {
                .PropertyId = propertyId,
                .FilePath = saved.RelativePath,
                .IsCover = Not hasCover,
                .SortOrder = CShort(imageCount)
            }
            db.PropertyImages.Add(img)
            Await db.SaveChangesAsync(ct)
            Return New ImageDto With {.Id = img.Id, .Url = storage.PublicUrl(img.FilePath), .IsCover = img.IsCover}
        End Function

        Public Async Function DeleteImageAsync(imageId As Long, Optional ct As CancellationToken = Nothing) As Task Implements IPropertyService.DeleteImageAsync
            Dim img = Await db.PropertyImages.FirstOrDefaultAsync(Function(i) i.Id = imageId, ct)
            If img Is Nothing Then Throw New NotFoundException()
            Await scope.EnsureCanManagePropertyAsync(img.PropertyId, ct)
            db.PropertyImages.Remove(img)
            Await db.SaveChangesAsync(ct)
            Await storage.DeleteAsync(img.FilePath, ct)
        End Function

        Public Async Function SetCoverImageAsync(imageId As Long, Optional ct As CancellationToken = Nothing) As Task Implements IPropertyService.SetCoverImageAsync
            Dim img = Await db.PropertyImages.FirstOrDefaultAsync(Function(i) i.Id = imageId, ct)
            If img Is Nothing Then Throw New NotFoundException()
            Await scope.EnsureCanManagePropertyAsync(img.PropertyId, ct)
            Dim imgPropertyId = img.PropertyId
            Dim siblings = Await db.PropertyImages.Where(Function(i) i.PropertyId = imgPropertyId).ToListAsync(ct)
            For Each sibling In siblings
                sibling.IsCover = (sibling.Id = imageId)
            Next
            Await db.SaveChangesAsync(ct)
        End Function

        Public Async Function AmenitiesAsync(Optional ct As CancellationToken = Nothing) As Task(Of IReadOnlyList(Of AmenityDto)) Implements IPropertyService.AmenitiesAsync
            Return Await db.Amenities.AsNoTracking().OrderBy(Function(a) a.Name).
                Select(Function(a) New AmenityDto With {.Id = a.Id, .Name = a.Name, .Icon = a.Icon}).ToListAsync(ct)
        End Function

        ' ------------------------------------------------------------ helpers
        Private Async Function ManageablePropertyAsync(id As Long, ct As CancellationToken) As Task(Of [Property])
            If Not current.IsOperator() Then Throw New ForbiddenException()
            Dim p = Await scope.Properties().FirstOrDefaultAsync(Function(x) x.Id = id, ct)
            If p Is Nothing Then Throw New NotFoundException("Property not found.")
            Return p
        End Function

        Private Async Function EnsureManagerAsync(managerId As Long?, ct As CancellationToken) As Task
            If Not managerId.HasValue Then Return
            Dim wantedManager = managerId.Value
            Dim managerRoleId = Roles.IdOf(Roles.Manager)
            If Not Await db.UserRoles.AnyAsync(Function(x) x.UserId = wantedManager AndAlso x.RoleId = managerRoleId, ct) Then
                Throw New BusinessRuleException("The selected user is not a manager.")
            End If
        End Function

        Private Async Function SyncAmenitiesAsync(propertyId As Long, ids As List(Of Integer), ct As CancellationToken) As Task
            If ids Is Nothing Then Return
            Dim existing = Await db.PropertyAmenities.Where(Function(a) a.PropertyId = propertyId).ToListAsync(ct)
            db.PropertyAmenities.RemoveRange(existing.Where(Function(e) Not ids.Contains(e.AmenityId)).ToList())
            Dim valid = Await db.Amenities.Where(Function(a) ids.Contains(a.Id)).Select(Function(a) a.Id).ToListAsync(ct)
            For Each amenityId In valid
                Dim wanted = amenityId
                If existing.All(Function(e) e.AmenityId <> wanted) Then
                    db.PropertyAmenities.Add(New PropertyAmenity With {.PropertyId = propertyId, .AmenityId = amenityId})
                End If
            Next
            Await db.SaveChangesAsync(ct)
        End Function

        Private Shared Sub Validate(r As SavePropertyRequest)
            If Not PropertyTypes.Contains(r.PropertyType) Then
                Throw New BusinessRuleException($"Property type must be one of: {String.Join(", ", PropertyTypes)}.")
            End If
        End Sub

        Private Shared Sub Apply(u As PropertyUnit, r As SaveUnitRequest, creating As Boolean)
            u.UnitNumber = r.UnitNumber.Trim()
            u.FloorNo = r.FloorNo
            u.Bedrooms = r.Bedrooms
            u.Bathrooms = r.Bathrooms
            u.AreaSqft = r.AreaSqft
            u.MonthlyRent = r.MonthlyRent
            u.DepositAmount = r.DepositAmount
            u.Description = r.Description?.Trim()
            If Not String.IsNullOrWhiteSpace(r.Status) Then
                If Not EditableUnitStatuses.Contains(r.Status) Then
                    ' 'occupied' is controlled by leases, not by hand
                    If Not (r.Status = UnitStatus.Occupied AndAlso u.Status = UnitStatus.Occupied) Then
                        Throw New BusinessRuleException("Unit status can be set to available, maintenance or inactive. Occupancy follows the lease.")
                    End If
                ElseIf u.Status = UnitStatus.Occupied AndAlso r.Status <> UnitStatus.Occupied Then
                    Throw New BusinessRuleException("An occupied unit cannot be changed by hand. Terminate its lease first.")
                Else
                    u.Status = r.Status
                End If
            ElseIf creating Then
                u.Status = UnitStatus.Available
            End If
        End Sub

        Private Shared Function ToDto(u As PropertyUnit, tenant As String) As UnitDto
            Return New UnitDto With {
                .Id = u.Id,
                .PropertyId = u.PropertyId,
                .UnitNumber = u.UnitNumber,
                .FloorNo = u.FloorNo,
                .Bedrooms = u.Bedrooms,
                .Bathrooms = u.Bathrooms,
                .AreaSqft = u.AreaSqft,
                .MonthlyRent = u.MonthlyRent,
                .DepositAmount = u.DepositAmount,
                .Status = u.Status,
                .Description = u.Description,
                .CurrentTenant = tenant
            }
        End Function

    End Class

End Namespace
