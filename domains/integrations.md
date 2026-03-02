# Integrations

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Integration | IntegrationSlug | External services customers connect to |
| ConnectedAccount | Customer + Integration | A customer's link to an integration |
| ConnectSession | SessionToken | OAuth flow orchestration for third-party integrations |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| IntegrationSlug | string | |
| IntegrationName | string | |
| IntegrationType | string | enum: auction-buying-and-selling, credit-reports, credit-applications, dealer-management-system, pricing-valuations, vehicle-history-reports |
| IntegrationStatus | string | enum: Active, Coming Soon |
| IntegrationUrl | string | format: uri |
| SessionToken | string | |
| SessionStatus | string | enum: PENDING, SUCCESS, ERROR, CANCELLED |
| RedirectUri | string | format: uri |
| ConnectUrl | string | format: uri |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 20 | Integration has IntegrationType | \*:1 |
| 21 | Customer connects to Integration via ConnectedAccount | \*:\* |
| 108 | Integration has IntegrationName | 1:1 |
| 109 | Integration has IntegrationStatus | \*:1 |
| 110 | Integration has IntegrationUrl | 1:1 |
| 111 | ConnectedAccount has EmailAddress | 1:1 |
| 112 | ConnectedAccount has APIKey | 1:1 |
| 114 | ConnectSession has SessionStatus | \*:1 |
| 115 | ConnectSession has RedirectUri | \*:1 |
| 116 | ConnectSession has ConnectUrl | \*:1 |
| 117 | ConnectSession is for Customer | \*:1 |
| 118 | ConnectSession is for Integration | \*:1 |
