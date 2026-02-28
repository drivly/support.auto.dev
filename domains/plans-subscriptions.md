# Plans & Subscriptions

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Subscription | SubscriptionId | Stripe subscription |
| Plan | PlanName | Free, Starter, Growth, Scale |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| SubscriptionId | string | pattern: sub_.+ |
| PlanName | string | enum: Free, Starter, Growth, Scale |
| Interval | string | enum: monthly, annually |
| Price | number | minimum: 0 |
| RateLimit | integer | minimum: 0 |

## Readings

| # | Reading | Multiplicity |
|---|---------|-------------|
| 7 | Subscription is on Plan | \*:1 |
| 8 | Subscription has Interval | \*:1 |
| 9 | Plan has PlanName | 1:1 |
| 10 | Plan has monthly Price | 1:1 |
| 11 | Plan has annual Price | 1:1 |
| 12 | Plan has RateLimit | 1:1 |
