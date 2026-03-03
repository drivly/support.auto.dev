# Support

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| SupportRequest | RequestId | Inbound support thread |
| Message | MessageId | Individual message in a support thread |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| RequestId | string | format: uuid |
| MessageId | string | format: uuid |
| Subject | string | |
| Description | string | |
| Body | string | |
| SentAt | string | format: date-time |
| ChannelName | string | enum: Email |
| Priority | string | enum: low, medium, high, urgent |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| Customer submits SupportRequest | 1:\* |
| SupportRequest has Subject | \*:1 |
| SupportRequest has Description | \*:1 |
| SupportRequest arrives via Channel | \*:1 |
| SupportRequest has Priority | \*:1 |
| SupportRequest concerns APIProduct | \*:\* |
| SupportRequest has Message | 1:\* |
| Message has Body | \*:1 |
| Message has SentAt | \*:1 |
| Customer sends Message | 1:\* |

## Instance Facts

| Fact |
|------|
| SupportRequest is handled via Channel 'Email' |

## Deontic Constraints

| Constraint |
|-----------|
| Support response must not reference internal team structure |
| Support response must not use emdashes |
