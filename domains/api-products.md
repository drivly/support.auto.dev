# API Products

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| APIProduct | EndpointSlug | The 12+ APIs sold to customers |
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
| VehicleType | string | enum: Consumer, Commercial |
| IdempotencyKey | string | |
| UsageCount | integer | minimum: 0 |
| ReportedAt | string | format: date-time |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| APIProduct has EndpointPath | 1:1 |
| APIProduct has Description | \*:1 |
| APIProduct belongs to ProductCategory | \*:1 |
| Plan includes APIProduct as PlanProduct | \*:\* |
| PlanProduct has PricePerCall | \*:1 |
| APIProduct sources data from DataProvider | \*:\* |
| APIProduct requires APIProduct | \*:\* |
| DataProvider covers CoverageRegion | \*:\* |
| DataProvider covers VehicleType | \*:\* |
| MeterEvent has UsageCount | \*:1 |
| MeterEvent has ReportedAt | \*:1 |
| MeterEvent is for Customer | \*:1 |
| MeterEvent is for APIProduct | \*:1 |
| MeterEvent is for Subscription | \*:1 |

## Instance Facts

| Fact |
|------|
| APIProduct covers CoverageRegion 'US' |
| APIProduct covers CoverageRegion 'Canada' |
| APIProduct 'vinDecode' covers CoverageRegion 'International' |
| DataProvider 'Edmunds' covers VehicleType 'Consumer' |
| APIProduct 'photos' requires APIProduct 'listings' |
