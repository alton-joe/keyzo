Imports Microsoft.Extensions.Configuration
Imports MySqlConnector

' Keyzo.DbTool - runs the SQL scripts in /database (the mysql CLI is not required).
'   dotnet run --project tools/Keyzo.DbTool -- setup     create schema, views, routines, triggers, reference + demo data
'   dotnet run --project tools/Keyzo.DbTool -- schema    same but without demo data
'   dotnet run --project tools/Keyzo.DbTool -- migrate   apply only the additive scripts (07_unit_tours.sql) to an existing database
'   dotnet run --project tools/Keyzo.DbTool -- hash <pw> print a bcrypt hash
' DB password: `dotnet user-secrets set "Database:Password" "<pw>" --project tools/Keyzo.DbTool`
'              (or the KEYZO_DB_PASSWORD environment variable).

Public Class Program

    Private Const DemoPassword As String = "Keyzo@123"

    Public Shared Function Main(args As String()) As Integer
        Return RunAsync(args).GetAwaiter().GetResult()
    End Function

    Private Shared Async Function RunAsync(args As String()) As Task(Of Integer)
        Dim config = New ConfigurationBuilder().
            AddUserSecrets(GetType(Program).Assembly).
            AddEnvironmentVariables("KEYZO_").
            Build()

        Dim command = If(args.Length > 0, args(0).ToLowerInvariant(), "setup")

        If command = "hash" Then
            Console.WriteLine(BCrypt.Net.BCrypt.HashPassword(If(args.Length > 1, args(1), DemoPassword), 11))
            Return 0
        End If

        Dim host = If(config("Database:Host"), "localhost")
        Dim port = UInteger.Parse(If(config("Database:Port"), "3306"))
        Dim user = If(config("Database:User"), "root")
        Dim password = If(config("Database:Password"), config("DB_PASSWORD"))
        If String.IsNullOrEmpty(password) Then
            Console.Error.WriteLine("No database password configured. Run:")
            Console.Error.WriteLine("  dotnet user-secrets set ""Database:Password"" ""<your-mysql-password>"" --project tools/Keyzo.DbTool")
            Return 2
        End If

        Dim dbDir = FindDatabaseDir()
        Dim scripts As List(Of String)
        If command = "migrate" Then
            scripts = New List(Of String) From {"07_unit_tours.sql"}
        Else
            scripts = New List(Of String) From {"01_schema.sql", "02_views.sql", "03_routines.sql", "04_triggers.sql", "05_seed_reference.sql", "07_unit_tours.sql"}
        End If
        If command = "setup" Then scripts.Add("06_seed_demo.sql")

        Dim csb As New MySqlConnectionStringBuilder With {
            .Server = host, .Port = port, .UserID = user, .Password = password,
            .AllowUserVariables = True, .ConnectionTimeout = 15
        }

        Try
            Using conn As New MySqlConnection(csb.ConnectionString)
                Await conn.OpenAsync()
                Console.WriteLine($"Connected to MySQL {conn.ServerVersion} at {host}:{port} as {user}")

                Dim hash = BCrypt.Net.BCrypt.HashPassword(DemoPassword, 11)
                For Each file In scripts
                    Dim sql = Await System.IO.File.ReadAllTextAsync(Path.Combine(dbDir, file))
                    sql = sql.Replace("{{PWD}}", hash)
                    Console.Write($"  running {file} ... ")
                    Dim statements = SqlSplitter.Split(sql)
                    For index = 0 To statements.Count - 1
                        Dim text = statements(index)
                        Try
                            Using cmd As New MySqlCommand(text, conn) With {.CommandTimeout = 120}
                                Await cmd.ExecuteNonQueryAsync()
                            End Using
                        Catch ex As MySqlException
                            Console.WriteLine($"FAILED at statement #{index + 1}:{vbLf}{text.Substring(0, Math.Min(text.Length, 400))}{vbLf}")
                            Throw
                        End Try
                    Next
                    Console.WriteLine($"ok ({statements.Count} statements)")
                Next

                Console.WriteLine("Done. Database 'keyzo' is ready." & If(command = "setup", $"  Demo password for all accounts: {DemoPassword}", ""))
                Return 0
            End Using
        Catch ex As MySqlException
            Console.Error.WriteLine($"MySQL error {ex.ErrorCode} ({ex.Number}): {ex.Message}")
            Return 1
        End Try
    End Function

    Private Shared Function FindDatabaseDir() As String
        Dim dir As New DirectoryInfo(AppContext.BaseDirectory)
        Do While dir IsNot Nothing
            Dim candidate = Path.Combine(dir.FullName, "database")
            If System.IO.File.Exists(Path.Combine(candidate, "01_schema.sql")) Then Return candidate
            dir = dir.Parent
        Loop
        Throw New DirectoryNotFoundException("Could not find the 'database' folder (01_schema.sql).")
    End Function

End Class
