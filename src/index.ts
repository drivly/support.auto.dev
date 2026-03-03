import { AutoRouter, cors } from 'itty-router'
import { handleChat } from './chat'

const { preflight, corsify } = cors()

const router = AutoRouter({
  before: [preflight],
  finally: [corsify],
})

router
  .post('/chat', handleChat)
  .get('/health', () => new Response('ok'))

export default { fetch: router.fetch }
