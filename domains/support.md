# Support

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| SupportRequest | RequestId | Inbound support thread |
| Message | MessageId | Individual message in a support thread |
| Channel | ChannelName | Communication channel |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| RequestId | string | format: uuid |
| MessageId | string | format: uuid |
| Subject | string | |
| Description | string | |
| Body | string | |
| SentAt | string | format: date-time |
| ChannelName | string | enum: Slack, Email |
| Priority | string | enum: low, medium, high, urgent |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 22 | Customer submits SupportRequest | 1:\* |
| 23 | SupportRequest has Subject | \*:1 |
| 24 | SupportRequest has Description | \*:1 |
| 25 | SupportRequest arrives via Channel | \*:1 |
| 26 | SupportRequest has Priority | \*:1 |
| 27 | SupportRequest concerns APIProduct | \*:\* |
| 73 | SupportRequest has Message | 1:\* |
| 74 | Message has Body | \*:1 |
| 75 | Message has SentAt | \*:1 |
| 76 | Customer sends Message | 1:\* |
