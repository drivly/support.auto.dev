# Vehicle Data

The vehicle taxonomy and provider mapping domain. Derived from the Vindex NORMA model.

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Make | MakeName | Manufacturer (Honda, Toyota) |
| MakeModel | Make + ModelName | Objectifies "Make manufactured Model" |
| YearMakeModel | MakeModel + Year | Objectifies "MakeModel was manufactured for Year" |
| YearMakeModelTrim | YearMakeModel + TrimName | Objectifies "YearMakeModel has Trim" |
| Specs | SpecsId | Normalized vehicle spec combining all providers |
| Color | ColorId | Vehicle color palette |
| Option | OptionId | Vehicle option (engine, transmission, drivetrain) |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| MakeName | string | |
| ModelName | string | |
| TrimName | string | |
| Year | integer | minimum: 1886 |
| SpecsId | string | |
| SquishVIN | string | pattern: [A-Z0-9]{10} |
| ChromeId | string | |
| EdmundsId | string | |
| KBBId | string | |
| ColorId | string | |
| HexCode | string | pattern: #[0-9A-Fa-f]{6} |
| ColorName | string | |
| GenericColorName | string | |
| OptionId | string | |
| OptionType | string | enum: engine, transmission, drivetrain |
| BodyStyle | string | enum: Sedan, SUV, Truck, Coupe, Hatchback, Convertible, Van, Wagon |
| DoorCount | integer | minimum: 1, maximum: 8 |
| SeatCount | integer | minimum: 1, maximum: 12 |
| Drivetrain | string | enum: AWD, FWD, RWD |
| FuelType | string | enum: Gasoline, Diesel, Electric, Hybrid |

## Readings — Taxonomy Hierarchy

| # | Reading | Multiplicity |
|---|---------|-------------|
| 37 | Make manufactured Model as MakeModel | \*:\* |
| 38 | MakeModel was manufactured for Year as YearMakeModel | \*:\* |
| 39 | YearMakeModel has Trim as YearMakeModelTrim | 1:\* |

## Readings — Specs

| # | Reading | Multiplicity |
|---|---------|-------------|
| 40 | YearMakeModelTrim has Specs | 1:\* |
| 41 | Specs has SquishVIN | \*:1 |
| 42 | Specs has BodyStyle | \*:1 |
| 43 | Specs has DoorCount | \*:1 |
| 44 | Specs has SeatCount | \*:1 |
| 45 | Specs has engine Option | \*:1 |
| 46 | Specs has transmission Option | \*:1 |
| 47 | Specs has drivetrain Option | \*:1 |

## Readings — Provider ID Mapping

Provider IDs exist at multiple levels of the taxonomy. This is not a simple
one-to-one mapping — each provider joins at different points.

Chrome ↔ Edmunds: Direct mapping via CHROME_ID in Edmunds partner data.
KBB ↔ others: Only connects through SquishVIN — no direct ID mapping.

| # | Reading | Multiplicity |
|---|---------|-------------|
| 48 | Make has EdmundsId | 1:1 |
| 49 | Make has KBBId | 1:1 |
| 50 | MakeModel has EdmundsId | 1:1 |
| 51 | MakeModel has KBBId | 1:1 |
| 52 | YearMakeModel has EdmundsId | 1:1 |
| 53 | YearMakeModelTrim has EdmundsId | 1:1 |
| 54 | YearMakeModelTrim has KBBId | 1:1 |
| 55 | Specs has ChromeId | 1:1 |
| 56 | Specs has EdmundsId | 1:1 |
| 57 | Specs has KBBId | 1:1 |

## Readings — Colors & Options

| # | Reading | Multiplicity |
|---|---------|-------------|
| 58 | Color has ColorName | 1:1 |
| 59 | Color has GenericColorName | \*:1 |
| 60 | Color has HexCode | 1:1 |
| 61 | Specs has Color | \*:\* |
| 62 | Option has OptionType | \*:1 |
| 63 | Option belongs to Specs | \*:1 |
| 64 | Option has EdmundsId | 1:1 |
| 65 | Option has KBBId | 1:1 |
