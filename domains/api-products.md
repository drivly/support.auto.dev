# API Products

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| APIProduct | EndpointSlug | The 12+ APIs sold to customers |
| ProductCategory | CategoryName | Core, Marketplace, Financial, Safety |
| DataProvider | ProviderName | External data sources backing the APIs |
| MeterEvent | IdempotencyKey | A billable usage event reported to Stripe |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| EndpointSlug | string | e.g. vinDecode, listings |
| EndpointPath | string | e.g. /vin/:vin, /listings/:vin? |
| Description | string | |
| PricePerCall | number | minimum: 0 |
| CategoryName | string | enum: Core, Marketplace, Financial, Safety |
| ProviderName | string | enum: Edmunds, Carvana, CarMax, NHTSA, Palmoves, PCMI, KBB, AutoList, CarBuzz |
| CoverageRegion | string | enum: US, Canada, EU, International |
| IdempotencyKey | string | |
| UsageCount | integer | minimum: 0 |
| ReportedAt | string | format: date-time |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 14 | APIProduct has EndpointPath | 1:1 |
| 15 | APIProduct has Description | \*:1 |
| 16 | APIProduct belongs to ProductCategory | \*:1 |
| 17 | Plan includes APIProduct | \*:\* |
| 18 | Plan charges PricePerCall for APIProduct | ternary |
| 33 | APIProduct sources data from DataProvider | \*:\* |
| 34 | DataProvider covers CoverageRegion | \*:\* |
| 120 | MeterEvent has UsageCount | \*:1 |
| 121 | MeterEvent has ReportedAt | \*:1 |
| 122 | MeterEvent is for Customer | \*:1 |
| 123 | MeterEvent is for APIProduct | \*:1 |
| 124 | MeterEvent is for Subscription | \*:1 |
