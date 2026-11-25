Imports System.Text

''' <summary>Splits a SQL script into statements, honouring DELIMITER directives, quotes and comments.</summary>
Public NotInheritable Class SqlSplitter
    Private Sub New()
    End Sub

    Public Shared Function Split(script As String) As List(Of String)
        Dim result As New List(Of String)()
        Dim delimiter = ";"
        Dim buf As New StringBuilder()
        Dim i = 0
        Dim n = script.Length

        Do While i < n
            ' DELIMITER directive: only at the start of a line while no statement is in progress
            If buf.ToString().Trim().Length = 0 AndAlso StartsWithAt(script, i, "DELIMITER ", ignoreCase:=True) Then
                Dim eol = script.IndexOfAny({ControlChars.Cr, ControlChars.Lf}, i)
                If eol < 0 Then eol = n
                delimiter = script.Substring(i + 10, eol - (i + 10)).Trim()
                buf.Clear()
                i = eol
                Continue Do
            End If

            Dim c = script(i)

            ' line comment
            If (c = "-"c AndAlso i + 1 < n AndAlso script(i + 1) = "-"c) OrElse c = "#"c Then
                Dim eol = script.IndexOf(ControlChars.Lf, i)
                If eol < 0 Then eol = n
                i = eol   ' drop the comment, keep the newline
                Continue Do
            End If

            ' block comment
            If c = "/"c AndAlso i + 1 < n AndAlso script(i + 1) = "*"c Then
                Dim endAt = script.IndexOf("*/", i + 2, StringComparison.Ordinal)
                i = If(endAt < 0, n, endAt + 2)
                Continue Do
            End If

            ' quoted strings / identifiers
            If c = "'"c OrElse c = """"c OrElse c = "`"c Then
                Dim q = c
                buf.Append(c)
                i += 1
                Do While i < n
                    buf.Append(script(i))
                    If script(i) = "\"c AndAlso q <> "`"c AndAlso i + 1 < n Then
                        buf.Append(script(i + 1))
                        i += 2
                        Continue Do
                    End If
                    If script(i) = q Then
                        If i + 1 < n AndAlso script(i + 1) = q Then   ' doubled quote
                            buf.Append(script(i + 1))
                            i += 2
                            Continue Do
                        End If
                        i += 1
                        Exit Do
                    End If
                    i += 1
                Loop
                Continue Do
            End If

            If StartsWithAt(script, i, delimiter, ignoreCase:=False) Then
                Dim stmt = buf.ToString().Trim()
                If stmt.Length > 0 Then result.Add(stmt)
                buf.Clear()
                i += delimiter.Length
                Continue Do
            End If

            buf.Append(c)
            i += 1
        Loop

        Dim tail = buf.ToString().Trim()
        If tail.Length > 0 Then result.Add(tail)
        Return result
    End Function

    Private Shared Function StartsWithAt(s As String, index As Integer, value As String, ignoreCase As Boolean) As Boolean
        Return String.Compare(s, index, value, 0, value.Length,
            If(ignoreCase, StringComparison.OrdinalIgnoreCase, StringComparison.Ordinal)) = 0
    End Function
End Class
