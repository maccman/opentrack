import { trackEventSchema, type TrackPayload } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

import { integrationManager } from '@/integrations'

export default defineEventHandler(async (event) => {
  const body = await readBody<TrackPayload>(event)
  const validation = trackEventSchema.safeParse({ ...body, type: 'track' })

  if (!validation.success) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  waitUntil(integrationManager.process(validation.data))

  return { success: true }
})
