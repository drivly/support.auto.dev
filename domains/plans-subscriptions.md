# Plans & Subscriptions

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Subscription | SubscriptionId | Stripe subscription |
| Plan | PlanName | Free, Starter, Growth, Scale |
| WebhookEvent | EventId | Stripe webhook idempotency tracking |
| Verb | VerbName | Event action |
| Function | FunctionName | Executable behavior |

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
| VerbName | string | |
| FunctionName | string | |
| CallbackUrl | string | format: uri |
| HttpMethod | string | enum: GET, POST, PUT, PATCH, DELETE |
| FunctionType | string | enum: httpCallback, query, agentInvocation, transform |

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
| Verb runs Function | \*:1 |
| Function has FunctionType | \*:1 |
| Function has CallbackUrl | \*:1 |
| Function has HttpMethod | \*:1 |

## Instance Facts

| Fact |
|------|
| Subscription starts with TrialEnd |
| subscribe runs SubscribeCustomer |
| SubscribeCustomer has FunctionType httpCallback |
| SubscribeCustomer has CallbackUrl https://auth.vin/api/internal/billing/change-plan |
| SubscribeCustomer has HttpMethod POST |
| paymentFails runs HandlePaymentFailure |
| HandlePaymentFailure has FunctionType httpCallback |
| HandlePaymentFailure has CallbackUrl https://auth.vin/api/internal/billing/payment-failed |
| HandlePaymentFailure has HttpMethod POST |
| paymentSucceeds runs HandlePaymentSuccess |
| HandlePaymentSuccess has FunctionType httpCallback |
| HandlePaymentSuccess has CallbackUrl https://auth.vin/api/internal/billing/payment-succeeded |
| HandlePaymentSuccess has HttpMethod POST |
| userCancels runs CancelSubscription |
| CancelSubscription has FunctionType httpCallback |
| CancelSubscription has CallbackUrl https://auth.vin/api/internal/billing/cancel |
| CancelSubscription has HttpMethod POST |
| resubscribe runs ResubscribeCustomer |
| ResubscribeCustomer has FunctionType httpCallback |
| ResubscribeCustomer has CallbackUrl https://auth.vin/api/internal/billing/change-plan |
| ResubscribeCustomer has HttpMethod POST |
| trialEnds runs HandleTrialEnd |
| HandleTrialEnd has FunctionType httpCallback |
| HandleTrialEnd has CallbackUrl https://auth.vin/api/internal/billing/trial-ended |
| HandleTrialEnd has HttpMethod POST |

## Deontic Constraints

| Constraint |
|-----------|
| Plan change must require explicit Customer confirmation |
