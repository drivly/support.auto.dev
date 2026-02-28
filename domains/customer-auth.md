# Customer & Auth

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Customer | EmailAddress | Mapped from User in auth.vin |
| Account | Customer + OAuthProvider | OAuth provider credentials |
| APIKey | KeyValue | Format: sk_ad_... |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| EmailAddress | string | format: email |
| Name | string | |
| UserRole | string | enum: USER, ADMIN |
| KeyValue | string | pattern: sk_ad_.+ |
| OAuthProvider | string | enum: github, google, okta, resend |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 1 | Customer has Name | \*:1 |
| 2 | Customer has EmailAddress | 1:1 |
| 3 | Customer has UserRole | \*:1 |
| 4 | Customer has APIKey | 1:1 |
| 5 | Customer has Subscription | 1:1 |
| 6 | Customer authenticates via Account | 1:\* |
