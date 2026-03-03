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

| Reading | Multiplicity |
|---------|-------------|
| SupportRequest leads to FeatureRequest | \*:1 |
| FeatureRequest has Subject | \*:1 |
| FeatureRequest has Description | \*:1 |
| FeatureRequest has VoteCount | \*:1 |
| FeatureRequest concerns APIProduct | \*:\* |
