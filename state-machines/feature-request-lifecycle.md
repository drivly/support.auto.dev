# Feature Request Lifecycle

## States

Proposed, Investigating, Approved, InProgress, Shipped

## Transitions

| From | To | Event |
|------|-----|-------|
| Proposed | Investigating | investigate |
| Investigating | Approved | approve |
| Investigating | Proposed | defer |
| Approved | InProgress | startWork |
| InProgress | Shipped | deploy |
