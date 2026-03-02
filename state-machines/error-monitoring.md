# Error Monitoring

Proactive error detection, investigation, and resolution cycle.
Alerts come from Vercel emails, Cloudflare notifications, or
the agent's own ClickHouse log analysis.

## States

Monitoring, Detected, Investigating, ProposingFix, AwaitingApproval, Deploying, AutoResolved, Escalated, Resolved

## Transitions

| From | To | Event | Guard |
|------|-----|-------|-------|
| Monitoring | Detected | alertReceived | |
| Monitoring | Detected | anomalyDetected | |
| Detected | Investigating | investigate | |
| Investigating | AutoResolved | knownPatternFixed | Known resolution exists |
| Investigating | ProposingFix | proposeFix | Agent can write a fix |
| Investigating | Escalated | escalate | No known resolution, agent cannot fix |
| ProposingFix | AwaitingApproval | fixProposed | |
| AwaitingApproval | Deploying | approve | |
| AwaitingApproval | Investigating | reject | |
| Deploying | Resolved | deploySucceeds | |
| Deploying | Investigating | deployFails | |
| Escalated | Resolved | humanResolves | |
| AutoResolved | Monitoring | resume | |
| Resolved | Monitoring | resume | |
