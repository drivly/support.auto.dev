# Support

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| SupportRequest | RequestId | Inbound support thread |
| Message | MessageId | Individual message in a support thread |
| SupportResponse | MessageId | Subtype of Message |
| Request | RequestId | Supertype of SupportRequest and FeatureRequest |
| Admin | EmailAddress | Subtype of Customer |

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
| ImplementationDetail | string | |
| Reason | string | |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| Customer submits SupportRequest | 1:\* |
| Request has Subject | \*:1 |
| Request has Description | \*:1 |
| Request concerns APIProduct | \*:\* |
| SupportRequest is a subtype of Request | subtype |
| FeatureRequest is a subtype of Request | subtype |
| SupportRequest arrives via ChannelName | \*:1 |
| SupportRequest has Priority | \*:1 |
| SupportRequest has Message | 1:\* |
| Message has Body | \*:1 |
| Message has SentAt | \*:1 |
| Customer sends Message | 1:\* |
| SupportResponse is a subtype of Message | subtype |
| Admin redrafts SupportResponse with Reason | \*:\* |
| Admin resolves SupportRequest | \*:\* |
| Admin reopens SupportRequest | \*:\* |
| Admin merges SupportRequest into SupportRequest | \*:\* |
| Admin adds Constraint to SupportResponse | \*:\* |

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

| SupportResponse must not reveal ImplementationDetail |
| SupportResponse must not offer to perform APIRequest on behalf of Customer |
| SupportResponse is permitted to offer APIRequest assistance when Customer cannot retrieve data |
| SupportResponse must not name ListingSource |
| SupportResponse must not reference IngestionPipeline |
| SupportResponse must not claim availability of UnavailableFeature |

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
| SupportResponse must not name ListingSource | Autolist |
| SupportResponse must not name ListingSource | AutoNation |
| SupportResponse must not name ListingSource | AutoTrader |
| SupportResponse must not name ListingSource | Carfax |
| SupportResponse must not name ListingSource | CarStory |
| SupportResponse must not name ListingSource | Carvana |
| SupportResponse must not name ListingSource | CarMax |
| SupportResponse must not name ListingSource | Edmunds |
| SupportResponse must not name ListingSource | Marketcheck |
| SupportResponse must not reference IngestionPipeline | src.do |
| SupportResponse must not reference IngestionPipeline | load.src.do |
| SupportResponse must not reference IngestionPipeline | ClickHouse |
| SupportResponse must not reference IngestionPipeline | svc.do |
| SupportResponse must not reference IngestionPipeline | BrightData |
| SupportResponse must not reveal ImplementationDetail | provider names |
| SupportResponse must not reveal ImplementationDetail | internal service names |
| SupportResponse must not reveal ImplementationDetail | infrastructure architecture |
| SupportResponse must not reveal ImplementationDetail | database technology |
| SupportResponse must not reveal ImplementationDetail | scraping or data collection methods |
| SupportResponse must not reveal ImplementationDetail | knowledge graph |
| SupportResponse must not reveal ImplementationDetail | fact-based storage |
| SupportResponse must not reveal ImplementationDetail | state machine |
| SupportResponse must not reveal ImplementationDetail | domain model |
| SupportResponse must not reveal ImplementationDetail | readings or constraints |
| SupportResponse must not claim availability of UnavailableFeature | per-endpoint pricing outside plan tiers |
| SupportResponse must not claim availability of UnavailableFeature | warranty data in specs |
| SupportResponse must not claim availability of UnavailableFeature | specs for commercial vehicles |
