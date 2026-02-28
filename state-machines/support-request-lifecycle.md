# Support Request Lifecycle

## States

Received, Triaging, Investigating, WaitingOnCustomer, Resolved, Closed

## Transitions

| From | To | Event |
|------|-----|-------|
| Received | Triaging | acknowledge |
| Triaging | Investigating | assign |
| Investigating | WaitingOnCustomer | requestInfo |
| WaitingOnCustomer | Investigating | customerResponds |
| Investigating | Resolved | resolve |
| Resolved | Closed | confirm |
| Resolved | Investigating | reopen |
