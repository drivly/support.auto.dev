# Business Metrics

The meta-domain. Models the business structure — services, costs, revenue — so any agent can reason about business health and trace problems to their financial impact.

## Entity Types

| Entity | Reference Scheme | Notes |
|--------|-----------------|-------|
| Service | ServiceName | A deployed service (apis, src.do, svc.do, etc.) |
| RevenueStream | StreamName | A source of revenue |
| CostCenter | CostCenterName | An operational expense category |

## Value Types

| Value | Type | Constraints |
|-------|------|------------|
| ServiceName | string | |
| StreamName | string | |
| CostCenterName | string | |
| Amount | number | minimum: 0 |
| CostCategory | string | enum: Infrastructure, AI, People, Proxy, CAPTCHA, Payment Processing, Domains |
| Frequency | string | enum: Monthly, Annually |
| ServiceRuntime | string | enum: Cloudflare Workers, Fly.io, Vercel |

## Readings

| Reading | Multiplicity |
|---------|-------------|
| Service provides APIProduct | \*:\* |
| Service runs on CostCenter | \*:\* |
| Service has ServiceRuntime | \*:1 |
| CostCenter has CostCategory | \*:1 |
| CostCenter has Amount per Frequency | UC(CostCenter,Frequency) |
| Plan generates RevenueStream | \*:\* |
| RevenueStream has Amount per Frequency | UC(RevenueStream,Frequency) |

## Instance Facts

| Fact |
|------|
| Service 'apis' has ServiceRuntime 'Cloudflare Workers' |
| Service 'apis' runs on CostCenter 'Cloudflare' |
| Service 'apis' runs on CostCenter 'Anthropic' |
| Service 'apis' provides APIProduct 'vinDecode' |
| Service 'apis' provides APIProduct 'listings' |
| Service 'apis' provides APIProduct 'photos' |
| Service 'apis' provides APIProduct 'specs' |
| Service 'apis' provides APIProduct 'recalls' |
| Service 'apis' provides APIProduct 'build' |
| Service 'apis' provides APIProduct 'tco' |
| Service 'apis' provides APIProduct 'payments' |
| Service 'apis' provides APIProduct 'apr' |
| Service 'apis' provides APIProduct 'openRecalls' |
| Service 'apis' provides APIProduct 'plateToVin' |
| Service 'apis' provides APIProduct 'taxes' |
| Service 'src.do' has ServiceRuntime 'Fly.io' |
| Service 'src.do' runs on CostCenter 'Fly.io' |
| Service 'src.do' runs on CostCenter 'ClickHouse' |
| Service 'svc.do' has ServiceRuntime 'Fly.io' |
| Service 'svc.do' runs on CostCenter 'Fly.io' |
| Service 'svc.do' runs on CostCenter 'BrightData' |
| Service 'svc.do' runs on CostCenter '2Captcha' |
| Service 'svc.do' runs on CostCenter 'OpenAI' |
| Service 'load.src.do' has ServiceRuntime 'Fly.io' |
| Service 'load.src.do' runs on CostCenter 'Fly.io' |
| Service 'graphdl-orm' has ServiceRuntime 'Fly.io' |
| Service 'graphdl-orm' runs on CostCenter 'Fly.io' |
| Service 'graphdl-orm' runs on CostCenter 'MongoDB Atlas' |
| Service 'auth.vin' has ServiceRuntime 'Fly.io' |
| Service 'auth.vin' runs on CostCenter 'Fly.io' |
| Service 'auth.vin' runs on CostCenter 'MongoDB Atlas' |
| Service 'auth.vin' runs on CostCenter 'Stripe' |
| Service 'auto.dev' has ServiceRuntime 'Vercel' |
| Service 'auto.dev' runs on CostCenter 'Vercel' |
| Service 'auto.dev-dashboard' has ServiceRuntime 'Vercel' |
| Service 'auto.dev-dashboard' runs on CostCenter 'Vercel' |
| Service 'auto.dev-docs' has ServiceRuntime 'Vercel' |
| Service 'auto.dev-docs' runs on CostCenter 'Vercel' |
| Service 'support.auto.dev' has ServiceRuntime 'Cloudflare Workers' |
| Service 'support.auto.dev' runs on CostCenter 'Cloudflare' |
| CostCenter 'Fly.io' has CostCategory 'Infrastructure' |
| CostCenter 'Cloudflare' has CostCategory 'Infrastructure' |
| CostCenter 'MongoDB Atlas' has CostCategory 'Infrastructure' |
| CostCenter 'ClickHouse' has CostCategory 'Infrastructure' |
| CostCenter 'Vercel' has CostCategory 'Infrastructure' |
| CostCenter 'BrightData' has CostCategory 'Proxy' |
| CostCenter '2Captcha' has CostCategory 'CAPTCHA' |
| CostCenter 'Stripe' has CostCategory 'Payment Processing' |
| CostCenter 'Anthropic' has CostCategory 'AI' |
| CostCenter 'OpenAI' has CostCategory 'AI' |
| CostCenter 'Domain Registrations' has CostCategory 'Domains' |
| CostCenter 'Team' has CostCategory 'People' |

## Value Types (continued)

| Value | Type | Constraints |
|-------|------|------------|
| RunwayMonths | integer | minimum: 1 |
| CustomerAcquisitionCost | number | minimum: 0 |
| CustomerLifetimeValue | number | minimum: 0 |

## Fact Types with Deontic Mandatory Constraints

| Constraint |
|-----------|
| RevenueStream total must exceed CostCenter total per Frequency |
| Runway must exceed minimum RunwayMonths |
| CustomerAcquisitionCost must not exceed CustomerLifetimeValue |

## Deontic Mandatory Constraint Instance Facts

| Constraint | Instance |
|-----------|----------|
| RevenueStream total must exceed CostCenter total per Frequency | monthly |
| RevenueStream total must exceed CostCenter total per Frequency | annually |
| Runway must exceed minimum RunwayMonths | 6 |
