# Support

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| SupportRequest | RequestId | Inbound support thread |
| Message | MessageId | Individual message in a support thread |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| RequestId | string | format: uuid |
| MessageId | string | format: uuid |
| Subject | string | |
| Description | string | |
| Body | string | |
| SentAt | string | format: date-time |
| ChannelName | string | enum: Email |
| Priority | string | enum: low, medium, high, urgent |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| Customer submits SupportRequest | 1:\* |
| SupportRequest has Subject | \*:1 |
| SupportRequest has Description | \*:1 |
| SupportRequest arrives via ChannelName | \*:1 |
| SupportRequest has Priority | \*:1 |
| SupportRequest concerns APIProduct | \*:\* |
| SupportRequest has Message | 1:\* |
| Message has Body | \*:1 |
| Message has SentAt | \*:1 |
| Customer sends Message | 1:\* |

## Instance Facts

| Fact |
|------|
| SupportRequest is handled via ChannelName 'Email' |

## Fact Types with Deontic Mandatory Constraints

| Constraint |
|-----------|
| SupportResponse must not contain ProhibitedPunctuation |
| SupportResponse must not contain ProhibitedFormattingPattern |
| SupportResponse must not contain IntroductoryClause |
| SupportResponse must not reference ProtectedConcept |
| SupportResponse must not offer ProhibitedChannel |
| SupportResponse is delivered via Email |
| SupportResponse must not offer ProhibitedCommercialTerm |
| SupportResponse pricing claim must conform to PricingModel |

| SupportResponse must not offer to perform APIRequest on behalf of Customer |
| SupportResponse is permitted to offer APIRequest assistance when Customer cannot retrieve data |

## Deontic Mandatory Constraint Instance Facts

| Constraint | Instance |
|-----------|----------|
| SupportResponse must not contain ProhibitedPunctuation | — |
| SupportResponse must not contain ProhibitedPunctuation | – |
| SupportResponse must not contain ProhibitedPunctuation | -- |
| SupportResponse must not contain ProhibitedFormattingPattern | paragraph title inline with prose |
| SupportResponse must not contain ProhibitedFormattingPattern | bold header inline with prose |
| SupportResponse must not contain IntroductoryClause | "in summary" |
| SupportResponse must not contain IntroductoryClause | "to summarize" |
| SupportResponse must not contain IntroductoryClause | "overall" |
| SupportResponse must not contain IntroductoryClause | "in conclusion" |
| SupportResponse must not contain IntroductoryClause | "to recap" |
| SupportResponse must not reference ProtectedConcept | internal team structure |
| SupportResponse must not reference ProtectedConcept | Free plan |
| SupportResponse must not offer ProhibitedChannel | phone call |
| SupportResponse must not offer ProhibitedChannel | video meeting |
| SupportResponse must not offer ProhibitedChannel | Zoom |
| SupportResponse must not offer ProhibitedChannel | Teams |
| SupportResponse must not offer ProhibitedChannel | live chat |
| SupportResponse must not offer ProhibitedChannel | callback |
| SupportResponse must not offer ProhibitedCommercialTerm | custom pricing |
| SupportResponse must not offer ProhibitedCommercialTerm | enterprise deal |
| SupportResponse must not offer ProhibitedCommercialTerm | individual API access arrangement |
| SupportResponse must not offer ProhibitedCommercialTerm | volume discount |
| SupportResponse pricing claim must conform to PricingModel | base monthly subscription |
| SupportResponse pricing claim must conform to PricingModel | base annual subscription |
| SupportResponse pricing claim must conform to PricingModel | metered per-call usage |
