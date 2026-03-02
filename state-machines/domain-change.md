# Domain Change

Lifecycle of a proposed change to the domain model.

## States

Proposed, Reviewing, Approved, Applied, Rejected

## Transitions

| From | To | Event | Guard |
|------|-----|-------|-------|
| Proposed | Reviewing | review | |
| Reviewing | Approved | approve | |
| Reviewing | Rejected | reject | |
| Reviewing | Proposed | requestRevision | |
| Approved | Applied | apply | |
