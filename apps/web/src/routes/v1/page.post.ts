import { IntegrationManager } from '@app/core'
import { pageEventSchema, type PagePayload } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

const integrationManager = new IntegrationManager()

export default defineEventHandler(async (event) => {
  const body = await readBody<PagePayload>(event)
  const validation = pageEventSchema.safeParse({ ...body, type: 'page' })

  if (!validation.success) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  waitUntil(integrationManager.process(validation.data))

  return { success: true }
})
