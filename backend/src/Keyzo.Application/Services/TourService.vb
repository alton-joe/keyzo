Imports System.ComponentModel.DataAnnotations
Imports Keyzo.Application.Security
Imports Keyzo.Domain
Imports Keyzo.Domain.Entities
Imports Microsoft.EntityFrameworkCore

Namespace Services

    Public Class TourStopDto
        Public Property Id As Long
        Public Property Seq As Short
        Public Property RoomType As String
        Public Property ImageId As Long
        Public Property ImageUrl As String
        Public Property Title As String
        Public Property Caption As String
        Public Property FocalX As Decimal
        Public Property FocalY As Decimal
    End Class

    ''' <summary>The custom tour of a unit. An empty <see cref="Stops"/> list means the owner has not set one up yet
    ''' and the client builds a tour from its built-in photo library instead.</summary>
    Public Class UnitTourDto
        Public Property UnitId As Long
        Public Property Stops As IReadOnlyList(Of TourStopDto)
    End Class

    Public Class SaveTourStop
        <Required> Public Property RoomType As String = ""
        Public Property ImageId As Long
        <Required, MaxLength(80)> Public Property Title As String = ""
        <MaxLength(200)> Public Property Caption As String
        <Range(0, 100)> Public Property FocalX As Decimal = 50D
        <Range(0, 100)> Public Property FocalY As Decimal = 50D
    End Class

    Public Class SaveTourRequest
        <Required> Public Property Stops As List(Of SaveTourStop)
    End Class

    Public Interface ITourService
        Function GetPublicTourAsync(unitId As Long, Optional ct As CancellationToken = Nothing) As Task(Of UnitTourDto)
        Function GetTourAsync(unitId As Long, Optional ct As CancellationToken = Nothing) As Task(Of UnitTourDto)
        Function SaveTourAsync(unitId As Long, request As SaveTourRequest, Optional ct As CancellationToken = Nothing) As Task(Of UnitTourDto)
    End Interface

    Public NotInheritable Class TourService
        Implements ITourService

        Public Shared ReadOnly RoomTypes As String() = {"exterior", "door", "hall", "bedroom", "kitchen", "bathroom", "balcony", "other"}
        Private Const MaxStops As Integer = 30

        Private ReadOnly db As IAppDbContext
        Private ReadOnly scope As IAccessScope
        Private ReadOnly storage As IFileStorage
        Private ReadOnly audit As IAuditService

        Public Sub New(db As IAppDbContext, scope As IAccessScope, storage As IFileStorage, audit As IAuditService)
            Me.db = db
            Me.scope = scope
            Me.storage = storage
            Me.audit = audit
        End Sub

        Public Async Function GetPublicTourAsync(unitId As Long, Optional ct As CancellationToken = Nothing) As Task(Of UnitTourDto) Implements ITourService.GetPublicTourAsync
            Dim listed = Await db.Units.AsNoTracking().
                AnyAsync(Function(u) u.Id = unitId AndAlso u.Property.IsActive AndAlso u.Status <> UnitStatus.Inactive, ct)
            If Not listed Then Throw New NotFoundException("This unit is no longer listed.")
            Return New UnitTourDto With {.UnitId = unitId, .Stops = Await StopsAsync(unitId, ct)}
        End Function

        Public Async Function GetTourAsync(unitId As Long, Optional ct As CancellationToken = Nothing) As Task(Of UnitTourDto) Implements ITourService.GetTourAsync
            Dim unit = Await scope.Units().AsNoTracking().FirstOrDefaultAsync(Function(u) u.Id = unitId, ct)
            If unit Is Nothing Then Throw New NotFoundException("Unit not found.")
            Return New UnitTourDto With {.UnitId = unit.Id, .Stops = Await StopsAsync(unit.Id, ct)}
        End Function

        Public Async Function SaveTourAsync(unitId As Long, request As SaveTourRequest, Optional ct As CancellationToken = Nothing) As Task(Of UnitTourDto) Implements ITourService.SaveTourAsync
            Dim unit = Await scope.Units().AsNoTracking().FirstOrDefaultAsync(Function(u) u.Id = unitId, ct)
            If unit Is Nothing Then Throw New NotFoundException("Unit not found.")
            Await scope.EnsureCanManagePropertyAsync(unit.PropertyId, ct)

            If request.Stops.Count > MaxStops Then Throw New BusinessRuleException($"A tour can have at most {MaxStops} stops.")
            Dim bad = request.Stops.FirstOrDefault(Function(s) Not RoomTypes.Contains(s.RoomType))
            If bad IsNot Nothing Then Throw New BusinessRuleException($"Unknown room type '{bad.RoomType}'.")

            ' Every photo must belong to this unit's property - prevents pointing a tour at another owner's images.
            Dim imageIds = request.Stops.Select(Function(s) s.ImageId).Distinct().ToList()
            Dim tourPropertyId = unit.PropertyId
            Dim owned = Await db.PropertyImages.CountAsync(Function(i) imageIds.Contains(i.Id) AndAlso i.PropertyId = tourPropertyId, ct)
            If owned <> imageIds.Count Then Throw New BusinessRuleException("Tour photos must be images of this property.")

            ' Replace the whole tour in one SaveChanges (one transaction). The unique (unit_id, seq) index is modelled
            ' in the DbContext, so EF orders the deletes before the inserts.
            Dim existing = Await db.UnitTourStops.Where(Function(s) s.UnitId = unitId).ToListAsync(ct)
            db.UnitTourStops.RemoveRange(existing)
            db.UnitTourStops.AddRange(request.Stops.Select(Function(s, index) New UnitTourStop With {
                .UnitId = unitId,
                .Seq = CShort(index),
                .RoomType = s.RoomType,
                .ImageId = s.ImageId,
                .Title = s.Title.Trim(),
                .Caption = If(String.IsNullOrWhiteSpace(s.Caption), Nothing, s.Caption.Trim()),
                .FocalX = s.FocalX,
                .FocalY = s.FocalY
            }).ToList())
            Await db.SaveChangesAsync(ct)
            Await audit.LogAsync("update", "unit_tour", unitId, New With {.stops = request.Stops.Count}, ct:=ct)
            Return New UnitTourDto With {.UnitId = unitId, .Stops = Await StopsAsync(unitId, ct)}
        End Function

        Private Async Function StopsAsync(unitId As Long, ct As CancellationToken) As Task(Of IReadOnlyList(Of TourStopDto))
            Dim rows = Await db.UnitTourStops.AsNoTracking().Where(Function(s) s.UnitId = unitId).OrderBy(Function(s) s.Seq).
                Select(Function(s) New With {
                    Key .Id = s.Id,
                    Key .Seq = s.Seq,
                    Key .RoomType = s.RoomType,
                    Key .ImageId = s.ImageId,
                    Key .FilePath = s.Image.FilePath,
                    Key .Title = s.Title,
                    Key .Caption = s.Caption,
                    Key .FocalX = s.FocalX,
                    Key .FocalY = s.FocalY
                }).ToListAsync(ct)
            Return rows.Select(Function(r) New TourStopDto With {
                .Id = r.Id,
                .Seq = r.Seq,
                .RoomType = r.RoomType,
                .ImageId = r.ImageId,
                .ImageUrl = storage.PublicUrl(r.FilePath),
                .Title = r.Title,
                .Caption = r.Caption,
                .FocalX = r.FocalX,
                .FocalY = r.FocalY
            }).ToList()
        End Function
    End Class

End Namespace
