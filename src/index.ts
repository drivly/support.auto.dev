import { AutoRouter, cors } from 'itty-router'
import { handleChat, handleContactAssign, handleRedraft } from './chat'
import { listRequests, getRequest, adminReply, resolveRequest, reopenRequest, mergeRequests } from './requests'

const { preflight, corsify } = cors()

const router = AutoRouter({
  before: [preflight],
  finally: [corsify],
})

router
  .post('/chat', handleChat)
  .get('/contact/assign', handleContactAssign)
  .get('/requests', listRequests)
  .get('/requests/:id', getRequest)
  .post('/requests/:id/reply', adminReply)
  .post('/requests/:id/resolve', resolveRequest)
  .post('/requests/:id/redraft', handleRedraft)
  .post('/requests/:id/reopen', reopenRequest)
  .post('/requests/:id/merge', mergeRequests)
  .get('/health', () => new Response('ok'))

export default { fetch: router.fetch }
