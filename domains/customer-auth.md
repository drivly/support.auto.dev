# Customer & Auth

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Customer | EmailAddress | Mapped from User in auth.vin |
| Account | Customer + OAuthProvider | OAuth provider credentials |
| APIKey | KeyValue | Format: sk_ad_... |
| TwoFactorToken | Customer + Token | OTP verification token |
| TwoFactorConfirmation | Customer | Confirms 2FA is validated for session |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| EmailAddress | string | format: email |
| Name | string | |
| UserRole | string | enum: USER, ADMIN |
| KeyValue | string | pattern: sk_ad_.+ |
| OAuthProvider | string | enum: github, google, okta, resend |
| Avatar | string | format: uri |
| Token | string | |
| PasswordHash | string | |
| TwoFactorEnabled | boolean | |
| AccessToken | string | |
| RefreshToken | string | |
| ExpiresAt | string | format: date-time |
| ProviderAccountId | string | |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 1 | Customer has Name | \*:1 |
| 2 | Customer has EmailAddress | 1:1 |
| 3 | Customer has UserRole | \*:1 |
| 4 | Customer has APIKey | 1:1 |
| 5 | Customer has Subscription | 1:1 |
| 6 | Customer authenticates via Account | 1:\* |
| 92 | Customer has Avatar | 1:1 |
| 93 | Customer has PasswordHash | 1:1 |
| 94 | Customer has TwoFactorEnabled | 1:1 |
| 95 | Account has OAuthProvider | \*:1 |
| 96 | Account has ProviderAccountId | 1:1 |
| 97 | Account has AccessToken | 1:1 |
| 98 | Account has RefreshToken | 1:1 |
| 99 | Account has ExpiresAt | 1:1 |
| 100 | Customer has TwoFactorToken | 1:1 |
| 101 | Customer has TwoFactorConfirmation | 1:1 |
