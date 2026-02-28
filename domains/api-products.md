# API Products

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| APIProduct | EndpointSlug | The 12+ APIs sold to customers |
| ProductCategory | CategoryName | Core, Marketplace, Financial, Safety |
| DataProvider | ProviderName | External data sources backing the APIs |

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

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 13 | APIProduct has EndpointSlug | 1:1 |
| 14 | APIProduct has EndpointPath | 1:1 |
| 15 | APIProduct has Description | 1:1 |
| 16 | APIProduct belongs to ProductCategory | \*:1 |
| 17 | Plan includes APIProduct | \*:\* |
| 18 | Plan charges PricePerCall for APIProduct | ternary |
| 33 | APIProduct sources data from DataProvider | \*:\* |
| 34 | DataProvider covers CoverageRegion | \*:\* |
| 35 | DataProvider has ProviderName | 1:1 |
