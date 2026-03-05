export interface Env {
  AUTO_DEV_API_URL: string
  AUTO_DEV_API_KEY: string
  SLACK_WEBHOOK_URL: string
  SUPPORT_KV: KVNamespace
}

export interface SupportMessage {
  role: 'user' | 'agent' | 'admin'
  content: string
  timestamp: string
  toolCalls?: Array<{ tool: string; result: unknown }>
}

export interface SupportRequestData {
  customerId: string
  subject: string
  status: 'sent' | 'escalated' | 'resolved' | 'closed'
  createdAt: string
  updatedAt: string
  messages: SupportMessage[]
}
