/**
 * Seed all auto.dev-graphdl domain readings into a running GraphDL ORM instance.
 *
 * Usage: GRAPHDL_URL=http://localhost:3000 npx tsx scripts/seed-auto-dev.ts
 *
 * Requires a running graphdl-orm server. This script is a pure HTTP client —
 * it does not import or depend on any graphdl-orm internals.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = process.env.GRAPHDL_URL || 'http://localhost:3000'
const API = `${BASE_URL}/api`

// ─── HTTP Helpers ───────────────────────────────────────────────────────────

async function post(collection: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${API}/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`POST /api/${collection} ${res.status}: ${body}`)
  }
  return res.json().then((r: any) => r.doc)
}

async function patch(collection: string, id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${API}/${collection}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PATCH /api/${collection}/${id} ${res.status}: ${body}`)
  }
  return res.json().then((r: any) => r.doc)
}

async function find(collection: string, where: Record<string, any>): Promise<any[]> {
  const params = new URLSearchParams()
  for (const [field, condition] of Object.entries(where)) {
    for (const [op, val] of Object.entries(condition as Record<string, any>)) {
      params.set(`where[${field}][${op}]`, String(val))
    }
  }
  const res = await fetch(`${API}/${collection}?${params}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GET /api/${collection} ${res.status}: ${body}`)
  }
  return res.json().then((r: any) => r.docs)
}

// ─── Domain Helpers ─────────────────────────────────────────────────────────

const nounCache = new Map<string, any>()

async function ensureNoun(data: Record<string, any>): Promise<any> {
  if (nounCache.has(data.name)) return nounCache.get(data.name)
  const existing = await find('nouns', { name: { equals: data.name } })
  if (existing.length) {
    nounCache.set(data.name, existing[0])
    return existing[0]
  }
  const noun = await post('nouns', data)
  nounCache.set(data.name, noun)
  return noun
}

function nounId(name: string): string {
  const n = nounCache.get(name)
  if (!n) throw new Error(`Noun "${name}" not found in cache — create it first`)
  return n.id
}

async function createFact(name: string, text: string, relationship: string) {
  const schema = await post('graph-schemas', { name })
  await post('readings', { text, graphSchema: schema.id })
  await patch('graph-schemas', schema.id, { roleRelationship: relationship })
  return schema
}

function toCamelCase(text: string): string {
  return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

const multMap: Record<string, string> = {
  '*:1': 'many-to-one',
  '1:*': 'one-to-many',
  '*:*': 'many-to-many',
  '1:1': 'one-to-one',
}

// ─── Data Definitions ───────────────────────────────────────────────────────

interface ValueNounDef {
  name: string
  valueType: string
  format?: string
  enum?: string
  pattern?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
}

interface EntityNounDef {
  name: string
  plural: string
  permissions: string[]
  refScheme: string[]
}

interface FactDef {
  text: string
  multiplicity: string
}

interface StateMachineDef {
  entityNoun: string
  states: string[]
  transitions: { from: string; to: string; event: string }[]
}

// ─── Value Nouns (deduplicated across all 9 domains) ────────────────────────

const valueNouns: ValueNounDef[] = [
  // Customer & Auth
  { name: 'EmailAddress', valueType: 'string', format: 'email' },
  { name: 'Name', valueType: 'string' },
  { name: 'UserRole', valueType: 'string', enum: 'USER, ADMIN' },
  { name: 'KeyValue', valueType: 'string', pattern: 'sk_ad_.+' },
  { name: 'OAuthProvider', valueType: 'string', enum: 'github, google, okta, resend' },
  { name: 'Avatar', valueType: 'string', format: 'uri' },
  { name: 'Token', valueType: 'string' },
  { name: 'PasswordHash', valueType: 'string' },
  { name: 'TwoFactorEnabled', valueType: 'boolean' },
  { name: 'AccessToken', valueType: 'string' },
  { name: 'RefreshToken', valueType: 'string' },
  { name: 'ExpiresAt', valueType: 'string', format: 'date-time' },
  { name: 'ProviderAccountId', valueType: 'string' },

  // Support
  { name: 'RequestId', valueType: 'string', format: 'uuid' },
  { name: 'MessageId', valueType: 'string', format: 'uuid' },
  { name: 'Subject', valueType: 'string' },
  { name: 'Description', valueType: 'string' },
  { name: 'Body', valueType: 'string' },
  { name: 'SentAt', valueType: 'string', format: 'date-time' },
  { name: 'ChannelName', valueType: 'string', enum: 'Slack, Email' },
  { name: 'Priority', valueType: 'string', enum: 'low, medium, high, urgent' },

  // Error Monitoring
  { name: 'PatternId', valueType: 'string', format: 'uuid' },
  { name: 'AlertId', valueType: 'string', format: 'uuid' },
  { name: 'FixId', valueType: 'string', format: 'uuid' },
  { name: 'ErrorRate', valueType: 'number', minimum: 0 },
  { name: 'Severity', valueType: 'string', enum: 'info, warning, critical' },
  { name: 'Resolution', valueType: 'string' },
  { name: 'DetectedAt', valueType: 'string', format: 'date-time' },
  { name: 'CodeChange', valueType: 'string' },

  // Feature Requests
  { name: 'FeatureRequestId', valueType: 'string', format: 'uuid' },
  { name: 'VoteCount', valueType: 'integer', minimum: 0 },

  // API Products
  { name: 'EndpointSlug', valueType: 'string' },
  { name: 'EndpointPath', valueType: 'string' },
  { name: 'PricePerCall', valueType: 'number', minimum: 0 },
  { name: 'CategoryName', valueType: 'string', enum: 'Core, Marketplace, Financial, Safety' },
  { name: 'ProviderName', valueType: 'string', enum: 'Edmunds, Carvana, CarMax, NHTSA, Palmoves, PCMI, KBB, AutoList, CarBuzz' },
  { name: 'CoverageRegion', valueType: 'string', enum: 'US, Canada, EU, International' },
  { name: 'IdempotencyKey', valueType: 'string' },
  { name: 'UsageCount', valueType: 'integer', minimum: 0 },
  { name: 'ReportedAt', valueType: 'string', format: 'date-time' },

  // Plans & Subscriptions
  { name: 'SubscriptionId', valueType: 'string', pattern: 'sub_.+' },
  { name: 'StripeCustomerId', valueType: 'string', pattern: 'cus_.+' },
  { name: 'PlanName', valueType: 'string', enum: 'Free, Starter, Growth, Scale' },
  { name: 'Interval', valueType: 'string', enum: 'monthly, annually' },
  { name: 'Price', valueType: 'number', minimum: 0 },
  { name: 'RateLimit', valueType: 'integer', minimum: 0 },
  { name: 'EventId', valueType: 'string' },
  { name: 'EventType', valueType: 'string' },
  { name: 'EventStatus', valueType: 'string', enum: 'processed, failed, skipped' },
  { name: 'TrialEnd', valueType: 'string', format: 'date-time' },
  { name: 'LastPlanChangeAt', valueType: 'string', format: 'date-time' },

  // Integrations
  { name: 'IntegrationSlug', valueType: 'string' },
  { name: 'IntegrationName', valueType: 'string' },
  { name: 'IntegrationType', valueType: 'string', enum: 'auction-buying-and-selling, credit-reports, credit-applications, dealer-management-system, pricing-valuations, vehicle-history-reports' },
  { name: 'IntegrationStatus', valueType: 'string', enum: 'Active, Coming Soon' },
  { name: 'IntegrationUrl', valueType: 'string', format: 'uri' },
  { name: 'SessionToken', valueType: 'string' },
  { name: 'SessionStatus', valueType: 'string', enum: 'PENDING, SUCCESS, ERROR, CANCELLED' },
  { name: 'RedirectUri', valueType: 'string', format: 'uri' },
  { name: 'ConnectUrl', valueType: 'string', format: 'uri' },

  // Vehicle Data
  { name: 'MakeName', valueType: 'string' },
  { name: 'ModelName', valueType: 'string' },
  { name: 'TrimName', valueType: 'string' },
  { name: 'Year', valueType: 'integer', minimum: 1886 },
  { name: 'SpecsId', valueType: 'string' },
  { name: 'SquishVIN', valueType: 'string', pattern: '[A-Z0-9]{10}' },
  { name: 'ChromeId', valueType: 'string' },
  { name: 'EdmundsId', valueType: 'string' },
  { name: 'KBBId', valueType: 'string' },
  { name: 'ColorId', valueType: 'string' },
  { name: 'HexCode', valueType: 'string', pattern: '#[0-9A-Fa-f]{6}' },
  { name: 'ColorName', valueType: 'string' },
  { name: 'GenericColorName', valueType: 'string' },
  { name: 'OptionId', valueType: 'string' },
  { name: 'OptionType', valueType: 'string', enum: 'engine, transmission, drivetrain' },
  { name: 'BodyStyle', valueType: 'string', enum: 'Sedan, SUV, Truck, Coupe, Hatchback, Convertible, Van, Wagon' },
  { name: 'DoorCount', valueType: 'integer', minimum: 1, maximum: 8 },
  { name: 'SeatCount', valueType: 'integer', minimum: 1, maximum: 12 },
  { name: 'Drivetrain', valueType: 'string', enum: 'AWD, FWD, RWD' },
  { name: 'FuelType', valueType: 'string', enum: 'Gasoline, Diesel, Electric, Hybrid' },

  // Domain Evolution
  { name: 'ChangeId', valueType: 'string', format: 'uuid' },
  { name: 'ReadingText', valueType: 'string' },
  { name: 'Rationale', valueType: 'string' },
  { name: 'DomainName', valueType: 'string' },
]

// ─── Entity Nouns (deduplicated across all 9 domains) ───────────────────────

const entityNouns: EntityNounDef[] = [
  { name: 'Customer', plural: 'customers', permissions: ['create', 'read', 'update', 'list', 'login'], refScheme: ['EmailAddress'] },
  { name: 'Account', plural: 'accounts', permissions: ['create', 'read', 'update', 'list'], refScheme: ['Customer', 'OAuthProvider'] },
  { name: 'APIKey', plural: 'api-keys', permissions: ['create', 'read', 'update', 'list'], refScheme: ['KeyValue'] },
  { name: 'TwoFactorToken', plural: 'two-factor-tokens', permissions: ['create', 'read', 'update', 'list'], refScheme: ['Customer', 'Token'] },
  { name: 'TwoFactorConfirmation', plural: 'two-factor-confirmations', permissions: ['create', 'read', 'update', 'list'], refScheme: ['Customer'] },
  { name: 'SupportRequest', plural: 'support-requests', permissions: ['create', 'read', 'update', 'list'], refScheme: ['RequestId'] },
  { name: 'Message', plural: 'messages', permissions: ['create', 'read', 'update', 'list'], refScheme: ['MessageId'] },
  { name: 'Channel', plural: 'channels', permissions: ['create', 'read', 'update', 'list'], refScheme: ['ChannelName'] },
  { name: 'ErrorPattern', plural: 'error-patterns', permissions: ['create', 'read', 'update', 'list'], refScheme: ['PatternId'] },
  { name: 'Alert', plural: 'alerts', permissions: ['create', 'read', 'update', 'list'], refScheme: ['AlertId'] },
  { name: 'Fix', plural: 'fixes', permissions: ['create', 'read', 'update', 'list'], refScheme: ['FixId'] },
  { name: 'FeatureRequest', plural: 'feature-requests', permissions: ['create', 'read', 'update', 'list'], refScheme: ['FeatureRequestId'] },
  { name: 'APIProduct', plural: 'api-products', permissions: ['create', 'read', 'update', 'list'], refScheme: ['EndpointSlug'] },
  { name: 'ProductCategory', plural: 'product-categories', permissions: ['create', 'read', 'update', 'list'], refScheme: ['CategoryName'] },
  { name: 'DataProvider', plural: 'data-providers', permissions: ['create', 'read', 'update', 'list'], refScheme: ['ProviderName'] },
  { name: 'MeterEvent', plural: 'meter-events', permissions: ['create', 'read', 'update', 'list'], refScheme: ['IdempotencyKey'] },
  { name: 'Subscription', plural: 'subscriptions', permissions: ['create', 'read', 'update', 'list'], refScheme: ['SubscriptionId'] },
  { name: 'Plan', plural: 'plans', permissions: ['create', 'read', 'update', 'list'], refScheme: ['PlanName'] },
  { name: 'WebhookEvent', plural: 'webhook-events', permissions: ['create', 'read', 'update', 'list'], refScheme: ['EventId'] },
  { name: 'Integration', plural: 'integrations', permissions: ['create', 'read', 'update', 'list'], refScheme: ['IntegrationSlug'] },
  { name: 'ConnectedAccount', plural: 'connected-accounts', permissions: ['create', 'read', 'update', 'list'], refScheme: ['Customer', 'Integration'] },
  { name: 'ConnectSession', plural: 'connect-sessions', permissions: ['create', 'read', 'update', 'list'], refScheme: ['SessionToken'] },
  { name: 'Make', plural: 'makes', permissions: ['create', 'read', 'update', 'list'], refScheme: ['MakeName'] },
  { name: 'MakeModel', plural: 'make-models', permissions: ['create', 'read', 'update', 'list'], refScheme: ['Make', 'ModelName'] },
  { name: 'YearMakeModel', plural: 'year-make-models', permissions: ['create', 'read', 'update', 'list'], refScheme: ['MakeModel', 'Year'] },
  { name: 'YearMakeModelTrim', plural: 'year-make-model-trims', permissions: ['create', 'read', 'update', 'list'], refScheme: ['YearMakeModel', 'TrimName'] },
  { name: 'Specs', plural: 'specs', permissions: ['create', 'read', 'update', 'list'], refScheme: ['SpecsId'] },
  { name: 'Color', plural: 'colors', permissions: ['create', 'read', 'update', 'list'], refScheme: ['ColorId'] },
  { name: 'Option', plural: 'options', permissions: ['create', 'read', 'update', 'list'], refScheme: ['OptionId'] },
  { name: 'DomainChange', plural: 'domain-changes', permissions: ['create', 'read', 'update', 'list'], refScheme: ['ChangeId'] },
]

// ─── Facts (Readings) across all 9 domains ──────────────────────────────────

const facts: FactDef[] = [
  { text: 'Customer has Name', multiplicity: '*:1' },
  { text: 'Customer has UserRole', multiplicity: '*:1' },
  { text: 'Customer has APIKey', multiplicity: '1:1' },
  { text: 'Subscription belongs to Customer', multiplicity: '*:1' },
  { text: 'Customer authenticates via Account', multiplicity: '1:*' },
  { text: 'Customer has Avatar', multiplicity: '*:1' },
  { text: 'Customer has PasswordHash', multiplicity: '*:1' },
  { text: 'Customer has TwoFactorEnabled', multiplicity: '1:1' },
  { text: 'Account has ProviderAccountId', multiplicity: '1:1' },
  { text: 'Account has AccessToken', multiplicity: '*:1' },
  { text: 'Account has RefreshToken', multiplicity: '*:1' },
  { text: 'Account has ExpiresAt', multiplicity: '*:1' },
  { text: 'APIProduct has EndpointPath', multiplicity: '1:1' },
  { text: 'APIProduct has Description', multiplicity: '*:1' },
  { text: 'APIProduct belongs to ProductCategory', multiplicity: '*:1' },
  { text: 'Plan includes APIProduct', multiplicity: '*:*' },
  { text: 'APIProduct sources data from DataProvider', multiplicity: '*:*' },
  { text: 'DataProvider covers CoverageRegion', multiplicity: '*:*' },
  { text: 'MeterEvent has UsageCount', multiplicity: '*:1' },
  { text: 'MeterEvent has ReportedAt', multiplicity: '*:1' },
  { text: 'MeterEvent is for Customer', multiplicity: '*:1' },
  { text: 'MeterEvent is for APIProduct', multiplicity: '*:1' },
  { text: 'MeterEvent is for Subscription', multiplicity: '*:1' },
  { text: 'Subscription is on Plan', multiplicity: '*:1' },
  { text: 'Subscription has Interval', multiplicity: '*:1' },
  { text: 'Plan has monthly Price', multiplicity: '1:1' },
  { text: 'Plan has annual Price', multiplicity: '1:1' },
  { text: 'Plan has RateLimit', multiplicity: '1:1' },
  { text: 'Customer has StripeCustomerId', multiplicity: '1:1' },
  { text: 'Subscription has TrialEnd', multiplicity: '*:1' },
  { text: 'Subscription has LastPlanChangeAt', multiplicity: '*:1' },
  { text: 'WebhookEvent has EventType', multiplicity: '*:1' },
  { text: 'WebhookEvent has EventStatus', multiplicity: '*:1' },
  { text: 'Integration has IntegrationType', multiplicity: '*:1' },
  { text: 'Integration has IntegrationName', multiplicity: '1:1' },
  { text: 'Integration has IntegrationStatus', multiplicity: '*:1' },
  { text: 'Integration has IntegrationUrl', multiplicity: '1:1' },
  { text: 'ConnectedAccount has EmailAddress', multiplicity: '1:1' },
  { text: 'ConnectedAccount has APIKey', multiplicity: '1:1' },
  { text: 'ConnectSession has SessionStatus', multiplicity: '*:1' },
  { text: 'ConnectSession has RedirectUri', multiplicity: '*:1' },
  { text: 'ConnectSession has ConnectUrl', multiplicity: '*:1' },
  { text: 'ConnectSession is for Customer', multiplicity: '*:1' },
  { text: 'ConnectSession is for Integration', multiplicity: '*:1' },
  { text: 'Customer submits SupportRequest', multiplicity: '1:*' },
  { text: 'SupportRequest has Subject', multiplicity: '*:1' },
  { text: 'SupportRequest has Description', multiplicity: '*:1' },
  { text: 'SupportRequest arrives via Channel', multiplicity: '*:1' },
  { text: 'SupportRequest has Priority', multiplicity: '*:1' },
  { text: 'SupportRequest concerns APIProduct', multiplicity: '*:*' },
  { text: 'SupportRequest has Message', multiplicity: '1:*' },
  { text: 'Message has Body', multiplicity: '*:1' },
  { text: 'Message has SentAt', multiplicity: '*:1' },
  { text: 'Customer sends Message', multiplicity: '1:*' },
  { text: 'ErrorPattern has Description', multiplicity: '*:1' },
  { text: 'ErrorPattern has ErrorRate', multiplicity: '*:1' },
  { text: 'ErrorPattern has Severity', multiplicity: '*:1' },
  { text: 'ErrorPattern affects APIProduct', multiplicity: '*:*' },
  { text: 'ErrorPattern involves DataProvider', multiplicity: '*:*' },
  { text: 'ErrorPattern has Resolution', multiplicity: '*:1' },
  { text: 'Alert has Body', multiplicity: '*:1' },
  { text: 'Alert has DetectedAt', multiplicity: '*:1' },
  { text: 'ErrorPattern has Alert', multiplicity: '1:*' },
  { text: 'Fix has Description', multiplicity: '*:1' },
  { text: 'Fix has CodeChange', multiplicity: '*:1' },
  { text: 'ErrorPattern has Fix', multiplicity: '1:*' },
  { text: 'SupportRequest leads to FeatureRequest', multiplicity: '*:1' },
  { text: 'FeatureRequest has Subject', multiplicity: '*:1' },
  { text: 'FeatureRequest has Description', multiplicity: '*:1' },
  { text: 'FeatureRequest has VoteCount', multiplicity: '*:1' },
  { text: 'FeatureRequest concerns APIProduct', multiplicity: '*:*' },
  { text: 'Make manufactured Model as MakeModel', multiplicity: '*:*' },
  { text: 'MakeModel was manufactured for Year as YearMakeModel', multiplicity: '*:*' },
  { text: 'YearMakeModel has Trim as YearMakeModelTrim', multiplicity: '1:*' },
  { text: 'YearMakeModelTrim has Specs', multiplicity: '1:*' },
  { text: 'Specs has SquishVIN', multiplicity: '*:1' },
  { text: 'Specs has BodyStyle', multiplicity: '*:1' },
  { text: 'Specs has DoorCount', multiplicity: '*:1' },
  { text: 'Specs has SeatCount', multiplicity: '*:1' },
  { text: 'Specs has engine Option', multiplicity: '*:1' },
  { text: 'Specs has transmission Option', multiplicity: '*:1' },
  { text: 'Specs has drivetrain Option', multiplicity: '*:1' },
  { text: 'Make has EdmundsId', multiplicity: '1:1' },
  { text: 'Make has KBBId', multiplicity: '1:1' },
  { text: 'MakeModel has EdmundsId', multiplicity: '1:1' },
  { text: 'MakeModel has KBBId', multiplicity: '1:1' },
  { text: 'YearMakeModel has EdmundsId', multiplicity: '1:1' },
  { text: 'YearMakeModelTrim has EdmundsId', multiplicity: '1:1' },
  { text: 'YearMakeModelTrim has KBBId', multiplicity: '1:1' },
  { text: 'Specs has ChromeId', multiplicity: '1:1' },
  { text: 'Specs has EdmundsId', multiplicity: '1:1' },
  { text: 'Specs has KBBId', multiplicity: '1:1' },
  { text: 'Color has ColorName', multiplicity: '1:1' },
  { text: 'Color has GenericColorName', multiplicity: '*:1' },
  { text: 'Color has HexCode', multiplicity: '1:1' },
  { text: 'Specs has Color', multiplicity: '*:*' },
  { text: 'Option has OptionType', multiplicity: '*:1' },
  { text: 'Option belongs to Specs', multiplicity: '*:1' },
  { text: 'Option has EdmundsId', multiplicity: '1:1' },
  { text: 'Option has KBBId', multiplicity: '1:1' },
  { text: 'DomainChange has ReadingText', multiplicity: '*:1' },
  { text: 'DomainChange has Rationale', multiplicity: '*:1' },
  { text: 'DomainChange has DomainName', multiplicity: '*:1' },
  { text: 'FeatureRequest leads to DomainChange', multiplicity: '1:*' },
  { text: 'SupportRequest leads to DomainChange', multiplicity: '1:*' },
  { text: 'ErrorPattern leads to DomainChange', multiplicity: '1:*' },
]

// ─── State Machines ─────────────────────────────────────────────────────────

const stateMachines: StateMachineDef[] = [
  {
    entityNoun: 'SupportRequest',
    states: ['Received', 'Triaging', 'Investigating', 'WaitingOnCustomer', 'Resolved', 'Closed'],
    transitions: [
      { from: 'Received', to: 'Triaging', event: 'acknowledge' },
      { from: 'Triaging', to: 'Investigating', event: 'assign' },
      { from: 'Investigating', to: 'WaitingOnCustomer', event: 'requestInfo' },
      { from: 'WaitingOnCustomer', to: 'Investigating', event: 'customerResponds' },
      { from: 'Investigating', to: 'Resolved', event: 'resolve' },
      { from: 'Resolved', to: 'Closed', event: 'confirm' },
      { from: 'Resolved', to: 'Investigating', event: 'reopen' },
    ],
  },
  {
    entityNoun: 'ErrorPattern',
    states: ['Monitoring', 'Detected', 'Investigating', 'ProposingFix', 'AwaitingApproval', 'Deploying', 'AutoResolved', 'Escalated', 'Resolved'],
    transitions: [
      { from: 'Monitoring', to: 'Detected', event: 'alertReceived' },
      { from: 'Monitoring', to: 'Detected', event: 'anomalyDetected' },
      { from: 'Detected', to: 'Investigating', event: 'investigate' },
      { from: 'Investigating', to: 'AutoResolved', event: 'knownPatternFixed' },
      { from: 'Investigating', to: 'ProposingFix', event: 'proposeFix' },
      { from: 'Investigating', to: 'Escalated', event: 'escalate' },
      { from: 'ProposingFix', to: 'AwaitingApproval', event: 'fixProposed' },
      { from: 'AwaitingApproval', to: 'Deploying', event: 'approve' },
      { from: 'AwaitingApproval', to: 'Investigating', event: 'reject' },
      { from: 'Deploying', to: 'Resolved', event: 'deploySucceeds' },
      { from: 'Deploying', to: 'Investigating', event: 'deployFails' },
      { from: 'Escalated', to: 'Resolved', event: 'humanResolves' },
      { from: 'AutoResolved', to: 'Monitoring', event: 'resume' },
      { from: 'Resolved', to: 'Monitoring', event: 'resume' },
    ],
  },
  {
    entityNoun: 'FeatureRequest',
    states: ['Proposed', 'Investigating', 'Approved', 'InProgress', 'Shipped', 'Closed'],
    transitions: [
      { from: 'Proposed', to: 'Investigating', event: 'investigate' },
      { from: 'Investigating', to: 'Approved', event: 'approve' },
      { from: 'Investigating', to: 'Closed', event: 'reject' },
      { from: 'Approved', to: 'InProgress', event: 'startWork' },
      { from: 'InProgress', to: 'Shipped', event: 'deploy' },
      { from: 'Shipped', to: 'Closed', event: 'confirm' },
    ],
  },
  {
    entityNoun: 'Subscription',
    states: ['Free', 'Trialing', 'Active', 'PastDue', 'Cancelled'],
    transitions: [
      { from: 'Free', to: 'Trialing', event: 'subscribe' },
      { from: 'Free', to: 'Active', event: 'subscribe' },
      { from: 'Trialing', to: 'Active', event: 'trialEnds' },
      { from: 'Trialing', to: 'Cancelled', event: 'trialEnds' },
      { from: 'Active', to: 'PastDue', event: 'paymentFails' },
      { from: 'Active', to: 'Cancelled', event: 'userCancels' },
      { from: 'PastDue', to: 'Active', event: 'paymentSucceeds' },
      { from: 'PastDue', to: 'Cancelled', event: 'paymentFails' },
      { from: 'Cancelled', to: 'Trialing', event: 'resubscribe' },
      { from: 'Cancelled', to: 'Active', event: 'resubscribe' },
    ],
  },
  {
    entityNoun: 'Plan',
    states: ['Starter', 'Growth', 'Scale'],
    transitions: [
      { from: 'Starter', to: 'Growth', event: 'upgrade' },
      { from: 'Starter', to: 'Scale', event: 'upgrade' },
      { from: 'Growth', to: 'Scale', event: 'upgrade' },
      { from: 'Scale', to: 'Growth', event: 'downgrade' },
      { from: 'Scale', to: 'Starter', event: 'downgrade' },
      { from: 'Growth', to: 'Starter', event: 'downgrade' },
    ],
  },
  {
    entityNoun: 'ConnectSession',
    states: ['Pending', 'Success', 'Error', 'Cancelled'],
    transitions: [
      { from: 'Pending', to: 'Success', event: 'connectionSucceeds' },
      { from: 'Pending', to: 'Error', event: 'connectionFails' },
      { from: 'Pending', to: 'Cancelled', event: 'userCancels' },
    ],
  },
  {
    entityNoun: 'DomainChange',
    states: ['Proposed', 'Reviewing', 'Approved', 'Applied', 'Rejected'],
    transitions: [
      { from: 'Proposed', to: 'Reviewing', event: 'review' },
      { from: 'Reviewing', to: 'Approved', event: 'approve' },
      { from: 'Reviewing', to: 'Rejected', event: 'reject' },
      { from: 'Reviewing', to: 'Proposed', event: 'requestRevision' },
      { from: 'Approved', to: 'Applied', event: 'apply' },
    ],
  },
]

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Verify server is reachable
  console.log(`Connecting to GraphDL ORM at ${BASE_URL}...`)
  try {
    await fetch(`${API}/nouns?limit=1`)
  } catch {
    console.error(`Cannot reach ${BASE_URL}. Is graphdl-orm running? (cd graphdl-orm && npm run dev)`)
    process.exit(1)
  }
  console.log('Connected.\n')

  // ── 1. Value Nouns ──────────────────────────────────────────────────────
  console.log(`Creating ${valueNouns.length} value nouns...`)
  for (const v of valueNouns) {
    const data: Record<string, any> = { name: v.name, objectType: 'value', valueType: v.valueType }
    if (v.format) data.format = v.format
    if (v.enum) data.enum = v.enum
    if (v.pattern) data.pattern = v.pattern
    if (v.minimum !== undefined) data.minimum = v.minimum
    if (v.maximum !== undefined) data.maximum = v.maximum
    if (v.minLength !== undefined) data.minLength = v.minLength
    if (v.maxLength !== undefined) data.maxLength = v.maxLength
    await ensureNoun(data)
  }
  console.log(`  Done. ${nounCache.size} nouns in cache.\n`)

  // ── 2. Entity Nouns ─────────────────────────────────────────────────────
  console.log(`Creating ${entityNouns.length} entity nouns...`)
  for (const e of entityNouns) {
    await ensureNoun({
      name: e.name,
      objectType: 'entity',
      plural: e.plural,
      permissions: e.permissions,
    })
  }
  console.log(`  Done. ${nounCache.size} nouns in cache.\n`)

  // ── 3. Set Reference Schemes ────────────────────────────────────────────
  console.log('Setting reference schemes...')
  for (const e of entityNouns) {
    const refIds = e.refScheme.map(name => nounId(name))
    await patch('nouns', nounId(e.name), { referenceScheme: refIds })
  }
  console.log('  Done.\n')

  // ── 4. Facts (Graph Schemas + Readings) ─────────────────────────────────
  console.log(`Creating ${facts.length} facts...`)
  let created = 0
  let skipped = 0
  for (const f of facts) {
    const rel = multMap[f.multiplicity]
    if (!rel) {
      console.log(`  SKIP (unknown multiplicity "${f.multiplicity}"): ${f.text}`)
      skipped++
      continue
    }
    const name = toCamelCase(f.text)
    try {
      await createFact(name, f.text, rel)
      created++
    } catch (err: any) {
      console.log(`  ERROR on "${f.text}": ${err.message}`)
      skipped++
    }
  }
  console.log(`  Created: ${created}, Skipped/Errors: ${skipped}\n`)

  // ── 5. State Machines ───────────────────────────────────────────────────
  console.log(`Creating ${stateMachines.length} state machines...`)
  for (const sm of stateMachines) {
    console.log(`  ${sm.entityNoun}: ${sm.states.length} states, ${sm.transitions.length} transitions`)

    const definition = await post('state-machine-definitions', {
      noun: { relationTo: 'nouns', value: nounId(sm.entityNoun) },
    })

    const statusMap = new Map<string, string>()
    for (const s of sm.states) {
      const status = await post('statuses', { name: s, stateMachineDefinition: definition.id })
      statusMap.set(s, status.id)
    }

    const eventTypeMap = new Map<string, string>()
    for (const t of sm.transitions) {
      if (!eventTypeMap.has(t.event)) {
        const et = await post('event-types', { name: t.event })
        eventTypeMap.set(t.event, et.id)
      }
    }

    for (const t of sm.transitions) {
      await post('transitions', {
        from: statusMap.get(t.from),
        to: statusMap.get(t.to),
        eventType: eventTypeMap.get(t.event),
      })
    }
  }
  console.log('  Done.\n')

  // ── 6. Run Generators ───────────────────────────────────────────────────
  console.log('Running OpenAPI generator...')
  const openapiGen = await post('generators', {
    title: 'auto.dev Full API',
    version: '1.0.0',
    databaseEngine: 'Payload',
  })
  const schemaCount = openapiGen.output?.components?.schemas ? Object.keys(openapiGen.output.components.schemas).length : 0
  const pathCount = openapiGen.output?.paths ? Object.keys(openapiGen.output.paths).length : 0
  console.log(`  OpenAPI: ${schemaCount} schemas, ${pathCount} paths\n`)

  console.log('Running Payload collection generator...')
  const payloadGen = await post('generators', {
    title: 'auto.dev Collections',
    version: '1.0.0',
    databaseEngine: 'Payload',
    outputFormat: 'payload',
  })
  const fileCount = payloadGen.output?.files ? Object.keys(payloadGen.output.files).length : 0
  console.log(`  Payload: ${fileCount} collection files\n`)

  console.log('Running XState generator...')
  const xstateGen = await post('generators', {
    title: 'auto.dev State Machines',
    version: '1.0.0',
    databaseEngine: 'Payload',
    outputFormat: 'xstate',
  })
  const xstateFiles = xstateGen.output?.files ? Object.keys(xstateGen.output.files) : []
  console.log(`  XState: ${xstateFiles.length} files`)
  for (const f of xstateFiles) console.log(`    ${f}`)
  console.log()

  // ── 7. Write Output Files to Disk ───────────────────────────────────────
  const outDir = path.resolve(__dirname, '..', 'generated')
  fs.mkdirSync(outDir, { recursive: true })

  const openapiPath = path.join(outDir, 'openapi.json')
  fs.writeFileSync(openapiPath, JSON.stringify(openapiGen.output, null, 2))
  console.log(`Wrote ${openapiPath}`)

  if (payloadGen.output?.files) {
    for (const [filePath, content] of Object.entries(payloadGen.output.files)) {
      const fullPath = path.join(outDir, filePath)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content as string)
      console.log(`Wrote ${fullPath}`)
    }
  }

  if (xstateGen.output?.files) {
    for (const [filePath, content] of Object.entries(xstateGen.output.files)) {
      const fullPath = path.join(outDir, filePath)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content as string)
      console.log(`Wrote ${fullPath}`)
    }
  }

  console.log('\nDone! All output in: ' + outDir)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
