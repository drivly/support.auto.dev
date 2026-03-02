# Error Monitoring

Proactive monitoring of live API requests. The agent watches ClickHouse
logs for error spikes and failure patterns, investigates root causes,
and either auto-resolves known patterns or proposes fixes for approval.

Alerts come from two sources:
- **External notifications** — Vercel error emails, Cloudflare alerts
- **Internal monitoring** — agent queries ClickHouse response logs in the apis project, detects elevated fail rates

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| ErrorPattern | PatternId | A detected error pattern (spike, new failure mode) |
| Alert | AlertId | An inbound notification or detected anomaly |
| Fix | FixId | A proposed code change to resolve an error |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| PatternId | string | format: uuid |
| AlertId | string | format: uuid |
| FixId | string | format: uuid |
| ErrorRate | number | minimum: 0 |
| Severity | string | enum: info, warning, critical |
| Resolution | string | |
| Body | string | |
| DetectedAt | string | format: date-time |
| CodeChange | string | |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 66 | ErrorPattern has PatternId | 1:1 |
| 67 | ErrorPattern has Description | 1:1 |
| 68 | ErrorPattern has ErrorRate | 1:1 |
| 69 | ErrorPattern has Severity | \*:1 |
| 70 | ErrorPattern affects APIProduct | \*:\* |
| 71 | ErrorPattern involves DataProvider | \*:\* |
| 72 | ErrorPattern has Resolution | 1:1 |
| 77 | Alert has AlertId | 1:1 |
| 78 | Alert has Body | 1:1 |
| 79 | Alert has DetectedAt | 1:1 |
| 80 | ErrorPattern has Alert | 1:\* |
| 81 | Fix has FixId | 1:1 |
| 82 | Fix has Description | 1:1 |
| 83 | Fix has CodeChange | 1:1 |
| 84 | ErrorPattern has Fix | 1:\* |
