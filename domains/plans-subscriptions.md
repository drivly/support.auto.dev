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

| Reading | Multiplicity |
|---------|-------------|
| Subscription is on Plan | \*:1 |
| Subscription has Interval | \*:1 |
| Plan has monthly Price | \*:1 |
| Plan has annual Price | \*:1 |
| Plan has RateLimit | \*:1 |
| Customer has StripeCustomerId | 1:1 |
| Subscription has TrialEnd | \*:1 |
| Subscription has LastPlanChangeAt | \*:1 |
| WebhookEvent has EventType | \*:1 |
| WebhookEvent has EventStatus | \*:1 |

## Instance Facts

| Fact |
|------|
| Subscription starts with TrialEnd |

## Deontic Constraints

| Constraint |
|-----------|
| Plan change must require explicit Customer confirmation |
