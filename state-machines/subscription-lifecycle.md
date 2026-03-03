# Subscription Lifecycle

## States

Free, Trialing, Active, PastDue, Cancelled

## Transitions

| From | To | Event | Guard |
|------|-----|-------|-------|
| Free | Trialing | subscribe | Plan offers trial and Customer has no prior Subscription that was Trialing |
| Free | Active | subscribe | Plan has no trial |
| Trialing | Active | trialEnds | Payment succeeds |
| Trialing | Cancelled | trialEnds | No payment method |
| Active | PastDue | paymentFails | |
| Active | Cancelled | userCancels | |
| PastDue | Active | paymentSucceeds | |
| PastDue | Cancelled | paymentFails | |
| Cancelled | Trialing | resubscribe | Plan offers trial and Customer has no prior Subscription that was Trialing |
| Cancelled | Active | resubscribe | |
