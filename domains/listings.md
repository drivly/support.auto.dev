# Listings

Dealer vehicle inventory sourced from multiple providers into ClickHouse. The /photos endpoint is a projection of listing data, not a separate data source.

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Listing | VIN | A vehicle available for sale |
| Dealer | DealerId | Franchise or independent dealer |
| Photo | PhotoURL | Vehicle photo from a listing |
| IngestionJob | JobName | A scheduled data loading task |
| IngestionPipeline | PipelineName | A stage in the data flow |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| VIN | string | pattern: [A-Z0-9]{17} |
| DealerId | string | |
| DealerName | string | |
| Price | number | minimum: 0 |
| Mileage | integer | minimum: 0 |
| ListingChannel | string | enum: Retail, Wholesale |
| Condition | string | enum: New, Used |
| VDP | string | format: uri |
| PhotoURL | string | format: uri |
| PhotoType | string | enum: Retail, Wholesale |
| City | string | |
| State | string | |
| ZipCode | string | |
| Longitude | number | |
| Latitude | number | |
| AccidentCount | integer | minimum: 0 |
| OwnerCount | integer | minimum: 0 |
| ListingSource | string | enum: Autolist, AutoNation, AutoTrader, Carfax, CarStory, Carvana, CarMax, Edmunds, Marketcheck |
| JobName | string | |
| PipelineName | string | enum: src.do, load.src.do, ClickHouse |
| CronSchedule | string | |
| JobStatus | string | enum: Running, Completed, Failed |
| PipelineOperation | string | enum: cache, proxy, load, store, normalize |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| Listing identifies Vehicle by VIN | 1:1 |
| Listing has Price via ListingChannel | UC(Listing,ListingChannel) |
| Listing has Mileage | \*:1 |
| Listing has Condition | \*:1 |
| Listing has VDP via ListingChannel | UC(Listing,ListingChannel) |
| Listing is sold by Dealer | \*:1 |
| Dealer has DealerName | \*:1 |
| Listing is located in City | \*:1 |
| Listing is located in State | \*:1 |
| Listing is located in ZipCode | \*:1 |
| Listing has Longitude | \*:1 |
| Listing has Latitude | \*:1 |
| Listing has Photo | 1:\* |
| Photo has PhotoType | \*:1 |
| Listing has AccidentCount | \*:1 |
| Listing has OwnerCount | \*:1 |
| Listing is sourced from ListingSource | \*:\* |
| IngestionJob loads from ListingSource | \*:1 |
| IngestionJob has CronSchedule | \*:1 |
| IngestionJob has JobStatus | \*:1 |
| IngestionPipeline feeds IngestionPipeline | \*:1 |
| IngestionPipeline performs PipelineOperation | \*:\* |

## Instance Facts

| Fact |
|------|
| IngestionPipeline 'src.do' feeds IngestionPipeline 'load.src.do' |
| IngestionPipeline 'load.src.do' feeds IngestionPipeline 'ClickHouse' |
| IngestionPipeline 'src.do' performs PipelineOperation 'cache' |
| IngestionPipeline 'src.do' performs PipelineOperation 'proxy' |
| IngestionPipeline 'load.src.do' performs PipelineOperation 'load' |
| IngestionPipeline 'ClickHouse' performs PipelineOperation 'store' |
| IngestionPipeline 'ClickHouse' performs PipelineOperation 'normalize' |

## Fact Types with Deontic Mandatory Constraints

| Constraint |
|-----------|
| Listing must have VDP to appear in API results |
| Listing must have at least one Photo to appear in API results |
| Photo must not be returned without an active Listing |
