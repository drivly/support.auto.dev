# Feature Request Lifecycle

## States

Proposed, Investigating, Approved, InProgress, Shipped, Closed

## Transitions

| From | To | Event |
|------|-----|-------|
| Proposed | Investigating | investigate |
| Investigating | Approved | approve |
| Investigating | Closed | reject |
| Approved | InProgress | startWork |
| InProgress | Shipped | deploy |
| Shipped | Closed | confirm |
