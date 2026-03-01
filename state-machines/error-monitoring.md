# Error Monitoring

Proactive error detection and resolution cycle.

## States

Monitoring, Detected, Investigating, AutoResolved, Escalated, Resolved

## Transitions

| From | To | Event | Guard |
|------|-----|-------|-------|
| Monitoring | Detected | errorSpikeDetected | |
| Detected | Investigating | investigate | |
| Investigating | AutoResolved | knownPatternFixed | Known resolution exists |
| Investigating | Escalated | unknownPattern | No known resolution |
| Escalated | Resolved | humanResolves | |
| AutoResolved | Monitoring | resume | |
| Resolved | Monitoring | resume | |
