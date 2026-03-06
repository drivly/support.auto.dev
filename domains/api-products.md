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
| ProviderName | string | enum: Edmunds, Chrome, Carvana, CarMax, NHTSA, PALMoves, PCMI, KBB, AutoList, CarBuzz |
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
| APIProduct 'specs' sources data from DataProvider 'Edmunds' |
| APIProduct 'build' sources data from DataProvider 'Chrome' |
| APIProduct 'recalls' sources data from DataProvider 'NHTSA' |
| APIProduct 'openRecalls' sources data from DataProvider 'NHTSA' |
| APIProduct 'tco' sources data from DataProvider 'Edmunds' |
| APIProduct 'payments' sources data from DataProvider 'Edmunds' |
| APIProduct 'apr' sources data from DataProvider 'Edmunds' |
| APIProduct 'transport' sources data from DataProvider 'PALMoves' |
| DataProvider 'Edmunds' covers VehicleType 'Consumer' |
| DataProvider 'Chrome' covers VehicleType 'Consumer' |
| DataProvider 'Chrome' covers VehicleType 'Commercial' |
| DataProvider 'NHTSA' covers VehicleType 'Consumer' |
| DataProvider 'NHTSA' covers VehicleType 'Commercial' |
| APIProduct 'photos' requires APIProduct 'listings' |
| Plan 'Free' includes APIProduct 'vinDecode' as PlanProduct with PricePerCall 0 |
| Plan 'Free' includes APIProduct 'listings' as PlanProduct with PricePerCall 0 |
| Plan 'Free' includes APIProduct 'photos' as PlanProduct with PricePerCall 0 |
| Plan 'Starter' includes APIProduct 'vinDecode' as PlanProduct with PricePerCall 0.004 |
| Plan 'Starter' includes APIProduct 'listings' as PlanProduct with PricePerCall 0.002 |
| Plan 'Starter' includes APIProduct 'photos' as PlanProduct with PricePerCall 0.001 |
| Plan 'Growth' includes APIProduct 'vinDecode' as PlanProduct with PricePerCall 0.0025 |
| Plan 'Growth' includes APIProduct 'listings' as PlanProduct with PricePerCall 0.0015 |
| Plan 'Growth' includes APIProduct 'photos' as PlanProduct with PricePerCall 0.0009 |
| Plan 'Growth' includes APIProduct 'specs' as PlanProduct with PricePerCall 0.0015 |
| Plan 'Growth' includes APIProduct 'recalls' as PlanProduct with PricePerCall 0.01 |
| Plan 'Growth' includes APIProduct 'tco' as PlanProduct with PricePerCall 0.06 |
| Plan 'Growth' includes APIProduct 'payments' as PlanProduct with PricePerCall 0.005 |
| Plan 'Growth' includes APIProduct 'apr' as PlanProduct with PricePerCall 0.005 |
| Plan 'Growth' includes APIProduct 'build' as PlanProduct with PricePerCall 0.10 |
| Plan 'Scale' includes APIProduct 'vinDecode' as PlanProduct with PricePerCall 0.0015 |
| Plan 'Scale' includes APIProduct 'listings' as PlanProduct with PricePerCall 0.001 |
| Plan 'Scale' includes APIProduct 'photos' as PlanProduct with PricePerCall 0.0007 |
| Plan 'Scale' includes APIProduct 'specs' as PlanProduct with PricePerCall 0.001 |
| Plan 'Scale' includes APIProduct 'recalls' as PlanProduct with PricePerCall 0.007 |
| Plan 'Scale' includes APIProduct 'tco' as PlanProduct with PricePerCall 0.04 |
| Plan 'Scale' includes APIProduct 'payments' as PlanProduct with PricePerCall 0.004 |
| Plan 'Scale' includes APIProduct 'apr' as PlanProduct with PricePerCall 0.004 |
| Plan 'Scale' includes APIProduct 'build' as PlanProduct with PricePerCall 0.08 |
| Plan 'Scale' includes APIProduct 'openRecalls' as PlanProduct with PricePerCall 0.06 |
| Plan 'Scale' includes APIProduct 'plateToVin' as PlanProduct with PricePerCall 0.55 |
| Plan 'Scale' includes APIProduct 'taxes' as PlanProduct with PricePerCall 0.005 |
| APIProduct 'build' returns factory-installed options beyond standard equipment for the trim |
| APIProduct 'build' returns aggregate optionsMsrp, not per-option pricing |
| APIProduct 'specs' returns standard equipment at the trim level, not VIN-specific options |
| APIProduct 'specs' complements APIProduct 'build' for full vehicle equipment detail |

## Fact Types with Deontic Mandatory Constraints

| Constraint |
|-----------|
| SupportResponse must not claim availability of UnavailableFeature |

## Deontic Mandatory Constraint Instance Facts

| Constraint | Instance |
|-----------|----------|
| SupportResponse must not claim availability of UnavailableFeature | per-endpoint pricing outside plan tiers |
| SupportResponse must not claim availability of UnavailableFeature | warranty data in specs |
| SupportResponse must not claim availability of UnavailableFeature | specs for commercial vehicles |
