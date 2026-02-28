# Support

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| SupportRequest | RequestId | Inbound from Slack or email |
| Channel | ChannelName | Communication channel |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| RequestId | string | format: uuid |
| Subject | string | |
| Description | string | |
| ChannelName | string | enum: Slack, Email |
| Priority | string | enum: low, medium, high, urgent |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 22 | Customer submits SupportRequest | 1:\* |
| 23 | SupportRequest has Subject | 1:1 |
| 24 | SupportRequest has Description | 1:1 |
| 25 | SupportRequest arrives via Channel | \*:1 |
| 26 | SupportRequest has Priority | \*:1 |
| 27 | SupportRequest concerns APIProduct | \*:\* |
