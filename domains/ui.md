# UI

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| DisplayColor | ColorName | Visual status indicator |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| ColorName | string | enum: green, amber, red, blue, violet, gray |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| Status has DisplayColor | \*:1 |

## Instance Facts

| Fact |
|------|
| Status 'Received' has DisplayColor 'blue' |
| Status 'Triaging' has DisplayColor 'amber' |
| Status 'Investigating' has DisplayColor 'violet' |
| Status 'WaitingOnCustomer' has DisplayColor 'amber' |
| Status 'Resolved' has DisplayColor 'green' |
| Status 'Draft' has DisplayColor 'gray' |
| Status 'Sent' has DisplayColor 'green' |
| Status 'Proposed' has DisplayColor 'blue' |
| Status 'Approved' has DisplayColor 'green' |
| Status 'InProgress' has DisplayColor 'violet' |
| Status 'Shipped' has DisplayColor 'green' |
