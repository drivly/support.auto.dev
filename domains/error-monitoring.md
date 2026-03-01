# Error Monitoring

Proactive monitoring of live API requests. The agent watches ClickHouse
logs for error spikes and failure patterns, investigates root causes,
and either auto-resolves known patterns or escalates with the
investigation already done.

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| ErrorPattern | PatternId | A detected error pattern (spike, new failure mode) |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| PatternId | string | format: uuid |
| ErrorRate | number | minimum: 0 |
| Severity | string | enum: info, warning, critical |
| Resolution | string | |

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
