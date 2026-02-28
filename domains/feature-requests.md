# Feature Requests

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| FeatureRequest | FeatureRequestId | Emerged from support request patterns |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| FeatureRequestId | string | format: uuid |
| VoteCount | integer | minimum: 0 |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 28 | SupportRequest leads to FeatureRequest | \*:1 |
| 29 | FeatureRequest has Subject | 1:1 |
| 30 | FeatureRequest has Description | 1:1 |
| 31 | FeatureRequest has VoteCount | 1:1 |
| 32 | FeatureRequest concerns APIProduct | \*:\* |
