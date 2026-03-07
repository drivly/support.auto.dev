import type { ClaimWarning } from './verify'

export interface Env {
  AUTO_DEV_API_URL: string
  AUTO_DEV_API_KEY: string
  AUTH_VIN_API_KEY?: string
  SLACK_WEBHOOK_URL: string
  SUPPORT_KV: KVNamespace
}

export interface SupportMessage {
  role: 'user' | 'agent' | 'admin'
  content: string
  timestamp: string
  toolCalls?: Array<{ tool: string; result: unknown }>
  warnings?: ClaimWarning[]
}

export interface SupportRequestData {
  customerId: string
  subject: string
  status: 'sent' | 'escalated' | 'resolved' | 'closed' | 'merged'
  mergedInto?: string
  createdAt: string
  updatedAt: string
  messages: SupportMessage[]
}
