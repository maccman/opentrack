import type { AliasPayload } from '@app/spec'
import { aliasEventSchema } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

import { integrationManager } from '@/integrations'

export default defineEventHandler(async (event) => {
  const body = await readBody<AliasPayload>(event)
  const validation = aliasEventSchema.safeParse({ ...body, type: 'alias' })

  if (!validation.success) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  waitUntil(integrationManager.process(validation.data))

  return { success: true }
})
