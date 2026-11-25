Imports Keyzo.Application
Imports Microsoft.Extensions.Options

Namespace Storage

    Public Class StorageOptions
        ''' <summary>Absolute or content-root-relative folder; contains /public (served at /uploads) and /private.</summary>
        Public Property Root As String = "uploads"
        Public Property MaxBytes As Long = 8L * 1024 * 1024
    End Class

    ''' <summary>Local-disk IFileStorage. Replace with an S3 / Azure Blob implementation for cloud deployments.</summary>
    Public NotInheritable Class LocalFileStorage
        Implements IFileStorage

        Private Shared ReadOnly PublicFolders As New HashSet(Of String) From {"properties"}
        Private Shared ReadOnly ContentTypes As New Dictionary(Of String, String) From {
            {".jpg", "image/jpeg"}, {".jpeg", "image/jpeg"}, {".png", "image/png"}, {".webp", "image/webp"},
            {".gif", "image/gif"}, {".pdf", "application/pdf"}
        }

        Private ReadOnly o As StorageOptions
        Private ReadOnly root As String

        Public Sub New(options As IOptions(Of StorageOptions), contentRoot As String)
            o = options.Value
            root = If(Path.IsPathRooted(o.Root), o.Root, Path.Combine(contentRoot, o.Root))
            Directory.CreateDirectory(PublicRoot)
            Directory.CreateDirectory(PrivateRoot)
        End Sub

        Public ReadOnly Property PublicRoot As String
            Get
                Return Path.Combine(root, "public")
            End Get
        End Property

        Private ReadOnly Property PrivateRoot As String
            Get
                Return Path.Combine(root, "private")
            End Get
        End Property

        Public Async Function SaveAsync(content As Stream, originalName As String, folder As String, Optional ct As CancellationToken = Nothing) As Task(Of StoredFile) Implements IFileStorage.SaveAsync
            Dim ext = Path.GetExtension(originalName).ToLowerInvariant()
            Dim allowPdf = (folder = "documents")
            If Not ContentTypes.ContainsKey(ext) OrElse (ext = ".pdf" AndAlso Not allowPdf) Then
                Throw New BusinessRuleException(If(allowPdf, "Allowed file types: JPG, PNG, WEBP, GIF or PDF.", "Allowed file types: JPG, PNG, WEBP or GIF."))
            End If

            Using ms As New MemoryStream()
                Await content.CopyToAsync(ms, ct)
                If ms.Length = 0 Then Throw New BusinessRuleException("The file is empty.")
                If ms.Length > o.MaxBytes Then Throw New BusinessRuleException($"The file is larger than {o.MaxBytes \ 1024 \ 1024} MB.")
                Dim data = ms.ToArray()
                If Not SignatureMatches(data.Take(16).ToArray(), ext) Then
                    Throw New BusinessRuleException("The file content does not match its extension.")
                End If

                Dim isPublic = PublicFolders.Contains(folder)
                Dim relative = $"{folder}/{Guid.NewGuid().ToString("N")}{ext}"
                Dim full = Resolve(relative, isPublic)
                Directory.CreateDirectory(Path.GetDirectoryName(full))
                Await File.WriteAllBytesAsync(full, data, ct)
                Return New StoredFile(relative, Path.GetFileName(originalName), data.LongLength)
            End Using
        End Function

        Public Function DeleteAsync(relativePath As String, Optional ct As CancellationToken = Nothing) As Task Implements IFileStorage.DeleteAsync
            Dim folder = relativePath.Split("/"c)(0)
            Dim full = Resolve(relativePath, PublicFolders.Contains(folder))
            If File.Exists(full) Then File.Delete(full)
            Return Task.CompletedTask
        End Function

        Public Function PublicUrl(relativePath As String) As String Implements IFileStorage.PublicUrl
            Return "/uploads/" & relativePath
        End Function

        Public Function OpenPrivate(relativePath As String, downloadName As String) As PrivateFile Implements IFileStorage.OpenPrivate
            Dim full = Resolve(relativePath, isPublic:=False)
            If Not File.Exists(full) Then Throw New NotFoundException("The file is no longer available.")
            Dim ext = Path.GetExtension(full).ToLowerInvariant()
            Dim contentType As String = Nothing
            If Not ContentTypes.TryGetValue(ext, contentType) Then contentType = "application/octet-stream"
            Return New PrivateFile(File.OpenRead(full), contentType, downloadName)
        End Function

        ' guards against path traversal
        Private Function Resolve(relative As String, isPublic As Boolean) As String
            Dim baseDir = Path.GetFullPath(If(isPublic, PublicRoot, PrivateRoot))
            Dim full = Path.GetFullPath(Path.Combine(baseDir, relative))
            If Not full.StartsWith(baseDir, StringComparison.OrdinalIgnoreCase) Then Throw New BusinessRuleException("Invalid file path.")
            Return full
        End Function

        Private Shared Function SignatureMatches(h As Byte(), ext As String) As Boolean
            Select Case ext
                Case ".jpg", ".jpeg"
                    Return h.Length > 3 AndAlso h(0) = &HFF AndAlso h(1) = &HD8 AndAlso h(2) = &HFF
                Case ".png"
                    Return h.Length > 4 AndAlso h(0) = &H89 AndAlso h(1) = &H50 AndAlso h(2) = &H4E AndAlso h(3) = &H47
                Case ".gif"
                    Return h.Length > 3 AndAlso h(0) = &H47 AndAlso h(1) = &H49 AndAlso h(2) = &H46             ' GIF
                Case ".webp"
                    Return h.Length > 12 AndAlso h(0) = &H52 AndAlso h(1) = &H49 AndAlso h(2) = &H46 AndAlso h(3) = &H46 AndAlso
                           h(8) = &H57 AndAlso h(9) = &H45 AndAlso h(10) = &H42 AndAlso h(11) = &H50            ' RIFF....WEBP
                Case ".pdf"
                    Return h.Length > 4 AndAlso h(0) = &H25 AndAlso h(1) = &H50 AndAlso h(2) = &H44 AndAlso h(3) = &H46   ' %PDF
                Case Else
                    Return False
            End Select
        End Function
    End Class

End Namespace
