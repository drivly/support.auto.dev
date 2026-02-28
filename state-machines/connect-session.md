# Connect Session

Integration connection workflow from auth.vin. Tracks a customer's attempt
to connect an external service (auction platform, DMS, credit provider, etc.).

## States

Pending, Success, Error, Cancelled

## Transitions

| From | To | Event |
|------|-----|-------|
| Pending | Success | connectionSucceeds |
| Pending | Error | connectionFails |
| Pending | Cancelled | userCancels |
