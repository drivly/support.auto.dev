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
| Year | integer | minimum: 1981 |
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

## Readings -- Taxonomy Hierarchy

| Reading | Multiplicity |
|---------|-------------|
| Make manufactured Model as MakeModel | \*:\* |
| MakeModel was manufactured for Year as YearMakeModel | \*:\* |
| YearMakeModel has Trim as YearMakeModelTrim | 1:\* |

## Readings -- Specs

| Reading | Multiplicity |
|---------|-------------|
| YearMakeModelTrim has Specs | 1:\* |
| Specs has SquishVIN | \*:1 |
| Specs has BodyStyle | \*:1 |
| Specs has DoorCount | \*:1 |
| Specs has SeatCount | \*:1 |
| Specs has engine Option | \*:1 |
| Specs has transmission Option | \*:1 |
| Specs has drivetrain Option | \*:1 |

## Readings -- Provider ID Mapping

Provider IDs exist at multiple levels of the taxonomy. This is not a simple
one-to-one mapping -- each provider joins at different points.

Chrome to Edmunds: Direct mapping via CHROME_ID in Edmunds partner data.
KBB to others: Only connects through SquishVIN -- no direct ID mapping.

| Reading | Multiplicity |
|---------|-------------|
| Make has EdmundsId | 1:1 |
| Make has KBBId | 1:1 |
| MakeModel has EdmundsId | 1:1 |
| MakeModel has KBBId | 1:1 |
| YearMakeModel has EdmundsId | 1:1 |
| YearMakeModelTrim has EdmundsId | 1:1 |
| YearMakeModelTrim has KBBId | 1:1 |
| Specs has ChromeId | 1:1 |
| Specs has EdmundsId | 1:1 |
| Specs has KBBId | 1:1 |

## Readings -- Colors & Options

| Reading | Multiplicity |
|---------|-------------|
| Color has ColorName | 1:1 |
| Color has GenericColorName | \*:1 |
| Color has HexCode | 1:1 |
| Specs has Color | \*:\* |
| Option has OptionType | \*:1 |
| Option belongs to Specs | \*:1 |
| Option has EdmundsId | 1:1 |
| Option has KBBId | 1:1 |

## Instance Facts

| Fact |
|------|
| Year minimum reflects the 1981 VIN standard adoption |
