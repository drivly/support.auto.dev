# Integrations

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Integration | IntegrationSlug | External services customers connect to |
| ConnectedAccount | Customer + Integration | A customer's link to an integration |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| IntegrationSlug | string | |
| IntegrationType | string | enum: auction-buying-and-selling, credit-reports, credit-applications, dealer-management-system, pricing-valuations, vehicle-history-reports |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 19 | Integration has IntegrationSlug | 1:1 |
| 20 | Integration has IntegrationType | \*:1 |
| 21 | Customer connects to Integration via ConnectedAccount | \*:\* |
