# Plans & Subscriptions

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Subscription | SubscriptionId | Stripe subscription |
| Plan | PlanName | Free, Starter, Growth, Scale |
| WebhookEvent | EventId | Stripe webhook idempotency tracking |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| SubscriptionId | string | pattern: sub_.+ |
| StripeCustomerId | string | pattern: cus_.+ |
| PlanName | string | enum: Free, Starter, Growth, Scale |
| Interval | string | enum: monthly, annually |
| Price | number | minimum: 0 |
| RateLimit | integer | minimum: 0 |
| EventId | string | |
| EventType | string | |
| EventStatus | string | enum: processed, failed, skipped |
| TrialEnd | string | format: date-time |
| LastPlanChangeAt | string | format: date-time |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 7 | Subscription is on Plan | \*:1 |
| 8 | Subscription has Interval | \*:1 |
| 10 | Plan has monthly Price | 1:1 |
| 11 | Plan has annual Price | 1:1 |
| 12 | Plan has RateLimit | 1:1 |
| 102 | Customer has StripeCustomerId | 1:1 |
| 103 | Subscription has TrialEnd | \*:1 |
| 104 | Subscription has LastPlanChangeAt | \*:1 |
| 106 | WebhookEvent has EventType | \*:1 |
| 107 | WebhookEvent has EventStatus | \*:1 |
