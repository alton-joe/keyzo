Imports System.IdentityModel.Tokens.Jwt
Imports System.Security.Claims
Imports System.Security.Cryptography
Imports System.Text
Imports Keyzo.Application
Imports Keyzo.Domain.Entities
Imports Microsoft.Extensions.Options
Imports Microsoft.IdentityModel.Tokens

Namespace Security

    Public Class JwtOptions
        Public Property Issuer As String = "keyzo-api"
        Public Property Audience As String = "keyzo-web"
        Public Property Secret As String = ""
        Public Property AccessMinutes As Integer = 30
        Public Property RefreshDays As Integer = 14
    End Class

    Public NotInheritable Class BcryptPasswordHasher
        Implements IPasswordHasher

        Public Function Hash(password As String) As String Implements IPasswordHasher.Hash
            Return BCrypt.Net.BCrypt.HashPassword(password, 11)
        End Function

        Public Function Verify(password As String, hash As String) As Boolean Implements IPasswordHasher.Verify
            Try
                Return BCrypt.Net.BCrypt.Verify(password, hash)
            Catch ex As BCrypt.Net.SaltParseException
                Return False
            End Try
        End Function
    End Class

    Public NotInheritable Class JwtTokenService
        Implements ITokenService

        Private ReadOnly o As JwtOptions

        Public Sub New(options As IOptions(Of JwtOptions))
            o = options.Value
        End Sub

        Public Function Create(user As User, roles As IEnumerable(Of String)) As TokenPair Implements ITokenService.Create
            Dim now = DateTime.UtcNow
            Dim accessExpires = now.AddMinutes(o.AccessMinutes)
            Dim claims As New List(Of Claim) From {
                New Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                New Claim(JwtRegisteredClaimNames.Email, user.Email),
                New Claim(JwtRegisteredClaimNames.Name, user.FullName)
            }
            claims.AddRange(roles.Select(Function(r) New Claim(ClaimTypes.Role, r)))

            Dim key As New SymmetricSecurityKey(Encoding.UTF8.GetBytes(o.Secret))
            Dim token As New JwtSecurityToken(o.Issuer, o.Audience, claims, now, accessExpires,
                                              New SigningCredentials(key, SecurityAlgorithms.HmacSha256))

            Dim refresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)).Replace("+"c, "-"c).Replace("/"c, "_"c).TrimEnd("="c)
            Return New TokenPair(New JwtSecurityTokenHandler().WriteToken(token), accessExpires, refresh, now.AddDays(o.RefreshDays))
        End Function

        Public Function HashRefreshToken(token As String) As String Implements ITokenService.HashRefreshToken
            Return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant()
        End Function
    End Class

End Namespace
