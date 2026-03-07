# Cost Attribution

Maps provider invoices to services and API products. Enables cost-per-call
derivation, month-over-month comparison, and identification of unused resources.

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Invoice | CostCenter + BillingPeriod | A monthly bill from a provider |
| InvoiceLineItem | Invoice + LineItemIndex | A single charge on an invoice |
| ProviderResource | CostCenter + ResourceName | A billable resource (Fly app, ClickHouse service, MongoDB cluster) |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| BillingPeriod | string | format: YYYY-MM |
| LineItemIndex | integer | minimum: 1 |
| ResourceName | string | |
| BillingCategory | string | enum: Compute, Storage, DataTransfer, Volumes, IPv4, Bandwidth, SSL, Backups, ObjectStorage, Plan, Snapshots, Search, Credit |
| Region | string | |
| Amount | number | |
| UnitPrice | number | minimum: 0 |
| Quantity | number | minimum: 0 |
| Unit | string | |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| Invoice has Amount | \*:1 |
| InvoiceLineItem has BillingCategory | \*:1 |
| InvoiceLineItem has Region | \*:1 |
| InvoiceLineItem has Amount | \*:1 |
| InvoiceLineItem has UnitPrice | \*:1 |
| InvoiceLineItem has Quantity | \*:1 |
| InvoiceLineItem has Unit | \*:1 |
| InvoiceLineItem belongs to ProviderResource | \*:1 |
| ProviderResource supports Service | \*:\* |
| Service provides APIProduct | \*:\* |

## Derived Facts

| Derived Fact | Derivation |
|-------------|-----------|
| ProviderResource has monthly cost | Sum of InvoiceLineItem Amount for that resource in a BillingPeriod |
| Service has monthly cost | Sum of ProviderResource monthly cost for all resources that support that Service |
| APIProduct has cost per call | Service monthly cost / MeterEvent UsageCount for that APIProduct |

## Fact Types with Deontic Mandatory Constraints

| Constraint |
|-----------|
| Service that runs on CostCenter should provide at least one APIProduct |
| ProviderResource should support at least one Service |

## Deontic Mandatory Constraint Instance Facts

| Constraint | Instance |
|-----------|----------|
| Service that runs on CostCenter should provide at least one APIProduct | warning: unused service incurs cost without revenue attribution |
| ProviderResource should support at least one Service | warning: unmapped provider resource cannot be attributed to any service |

## Instance Facts -- Provider Resources (Fly.io)

| Fact |
|------|
| ProviderResource 'Fly.io/srcd' supports Service 'src.do' |
| ProviderResource 'Fly.io/load-src-do' supports Service 'load.src.do' |
| ProviderResource 'Fly.io/svc-do' supports Service 'svc.do' |
| ProviderResource 'Fly.io/graphdl' supports Service 'graphdl-orm' |

## Instance Facts -- Provider Resources (ClickHouse)

| Fact |
|------|
| ProviderResource 'ClickHouse/VIN' supports Service 'src.do' |
| ProviderResource 'ClickHouse/VIN warehouse' supports Service 'src.do' |
| ProviderResource 'ClickHouse/do' supports Service 'apis' |
| ProviderResource 'ClickHouse/do warehouse' supports Service 'apis' |

## Instance Facts -- Provider Resources (MongoDB Atlas)

| Fact |
|------|
| ProviderResource 'MongoDB/Production/txn' supports Service 'auth.vin' |

## Instance Facts -- Provider Resources (MongoDB Atlas, unmapped)

| Instance |
|----------|
| ProviderResource 'MongoDB/SaaS/AI' |
| ProviderResource 'MongoDB/SaaS/SaaS' |
| ProviderResource 'MongoDB/Production/api' |
| ProviderResource 'MongoDB/Production/src' |
| ProviderResource 'MongoDB/Production/logs' |
| ProviderResource 'MongoDB/Production/vin' |
| ProviderResource 'MongoDB/SaaS/Apps' |
| ProviderResource 'MongoDB/Production/ai' |
| ProviderResource 'MongoDB/do/do' |
| ProviderResource 'MongoDB/SaaS/Logs' |

## Instance Facts -- Provider Resources (Fly.io, unmapped)

| Instance |
|----------|
| ProviderResource 'Fly.io/mda' |
| ProviderResource 'Fly.io/payload-apps' |
| ProviderResource 'Fly.io/blogs-cms' |
| ProviderResource 'Fly.io/dbsync' |
| ProviderResource 'Fly.io/nats-vin' |
| ProviderResource 'Fly.io/keyv' |
| ProviderResource 'Fly.io/vin-kafka' |
| ProviderResource 'Fly.io/wss' |
| ProviderResource 'Fly.io/lfs' |
| ProviderResource 'Fly.io/vin-clickhouse' |
| ProviderResource 'Fly.io/vectors' |
| ProviderResource 'Fly.io/sdb' |
| ProviderResource 'Fly.io/embeddings' |
| ProviderResource 'Fly.io/pktb' |
| ProviderResource 'Fly.io/vin-cloudflared' |
| ProviderResource 'Fly.io/geo-proxy' |
| ProviderResource 'Fly.io/dht' |
| ProviderResource 'Fly.io/chat-gpt' |
| ProviderResource 'Fly.io/prxy-do' |
| ProviderResource 'Fly.io/logpush' |
| ProviderResource 'Fly.io/gptd' |
| ProviderResource 'Fly.io/transcript-audio-splitter' |
| ProviderResource 'Fly.io/proxy-vin' |
| ProviderResource 'Fly.io/cms-studio' |
| ProviderResource 'Fly.io/svc-db' |
| ProviderResource 'Fly.io/payload-experiment' |

## Instance Facts -- February 2026 Invoice Totals

| Fact |
|------|
| Invoice 'Fly.io/2026-02' has Amount 642.95 |
| Invoice 'ClickHouse/2026-02' has Amount 1365.38 |
| Invoice 'MongoDB/2026-02' has Amount 1182.33 |
