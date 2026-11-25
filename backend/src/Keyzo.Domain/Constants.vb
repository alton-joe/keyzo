''' <summary>Role names (match the rows in the roles table and the JWT role claims).</summary>
Public NotInheritable Class Roles
    Private Sub New()
    End Sub

    Public Const SuperAdmin As String = "SuperAdmin"
    Public Const Owner As String = "Owner"
    Public Const Manager As String = "Manager"
    Public Const Tenant As String = "Tenant"
    Public Const MaintenanceStaff As String = "MaintenanceStaff"

    ''' <summary>Roles that run the rental operation (not tenants / maintenance staff).</summary>
    Public Const Operators As String = SuperAdmin & "," & Owner & "," & Manager

    Public Shared ReadOnly All As String() = {SuperAdmin, Owner, Manager, Tenant, MaintenanceStaff}

    ''' <summary>
    ''' The ONLY accounts that are ever SuperAdmin. Fixed in code on purpose: there is no screen or API that can add,
    ''' remove or change this list, and a SuperAdmin role row in the database for any other email is ignored.
    ''' </summary>
    Public Shared ReadOnly AdminEmails As String() = {
        "alton.joe@bcah.christuniversity.in",
        "lakshay.maloo@bcah.christuniversity.in",
        "sandra.siby@bcah.christuniversity.in"
    }

    Public Shared Function IsAdminEmail(email As String) As Boolean
        If String.IsNullOrWhiteSpace(email) Then Return False
        Return AdminEmails.Contains(email.Trim().ToLowerInvariant())
    End Function

    ''' <summary>Roles a user really has: SuperAdmin if (and only if) the email is on the fixed admin list.</summary>
    Public Shared Function EffectiveRoles(email As String, storedRoles As IEnumerable(Of String)) As List(Of String)
        Dim result = storedRoles.Where(Function(r) r <> SuperAdmin).ToList()
        If IsAdminEmail(email) Then result.Add(SuperAdmin)
        Return result
    End Function
    Public Shared ReadOnly IdOf_SuperAdmin As Byte = 1

    Public Shared Function IdOf(role As String) As Byte
        Select Case role
            Case SuperAdmin : Return 1
            Case Owner : Return 2
            Case Manager : Return 3
            Case Tenant : Return 4
            Case MaintenanceStaff : Return 5
            Case Else : Throw New ArgumentException($"Unknown role '{role}'")
        End Select
    End Function
End Class

' MySQL ENUM columns are mapped to strings; these constants keep the values in one place.
Public NotInheritable Class UnitStatus
    Private Sub New()
    End Sub
    Public Const Available As String = "available"
    Public Const Occupied As String = "occupied"
    Public Const Maintenance As String = "maintenance"
    Public Const Inactive As String = "inactive"
End Class

Public NotInheritable Class ApplicationStatus
    Private Sub New()
    End Sub
    Public Const Pending As String = "pending"
    Public Const Approved As String = "approved"
    Public Const Rejected As String = "rejected"
    Public Const Withdrawn As String = "withdrawn"
End Class

Public NotInheritable Class LeaseStatus
    Private Sub New()
    End Sub
    Public Const Active As String = "active"
    Public Const Expired As String = "expired"
    Public Const Terminated As String = "terminated"
End Class

Public NotInheritable Class RenewalStatus
    Private Sub New()
    End Sub
    Public Const Pending As String = "pending"
    Public Const Approved As String = "approved"
    Public Const Rejected As String = "rejected"
End Class

Public NotInheritable Class InvoiceStatus
    Private Sub New()
    End Sub
    Public Const Pending As String = "pending"
    Public Const [Partial] As String = "partial"
    Public Const Paid As String = "paid"
    Public Const Overdue As String = "overdue"
    Public Const Cancelled As String = "cancelled"
End Class

Public NotInheritable Class DepositStatus
    Private Sub New()
    End Sub
    Public Const Held As String = "held"
    Public Const Refunded As String = "refunded"
    Public Const PartiallyRefunded As String = "partially_refunded"
    Public Const Forfeited As String = "forfeited"
End Class

Public NotInheritable Class MaintenanceStatus
    Private Sub New()
    End Sub
    Public Const Open As String = "open"
    Public Const Assigned As String = "assigned"
    Public Const InProgress As String = "in_progress"
    Public Const Completed As String = "completed"
    Public Const Cancelled As String = "cancelled"
    Public Shared ReadOnly All As String() = {Open, Assigned, InProgress, Completed, Cancelled}
End Class

Public NotInheritable Class PaymentMethod
    Private Sub New()
    End Sub
    Public Shared ReadOnly All As String() = {"cash", "upi", "card", "bank_transfer", "cheque"}
End Class
