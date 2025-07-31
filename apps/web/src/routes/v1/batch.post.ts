import { IntegrationManager } from '@app/core'
import { aliasEventSchema, groupEventSchema, identifyEventSchema, pageEventSchema, trackEventSchema } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

const integrationManager = new IntegrationManager()

interface BatchPayload {
  batch: Array<{
    type: 'track' | 'identify' | 'page' | 'group' | 'alias'
    [key: string]: any
  }>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<BatchPayload>(event)

  if (!body.batch || !Array.isArray(body.batch)) {
    event.node.res.statusCode = 400
    return { error: 'Invalid payload: batch array is required' }
  }

  const processedEvents = []
  const errors = []

  for (const item of body.batch) {
    try {
      let validation

      switch (item.type) {
        case 'track':
          validation = trackEventSchema.safeParse(item)
          break
        case 'identify':
          validation = identifyEventSchema.safeParse(item)
          break
        case 'page':
          validation = pageEventSchema.safeParse(item)
          break
        case 'group':
          validation = groupEventSchema.safeParse(item)
          break
        case 'alias':
          validation = aliasEventSchema.safeParse(item)
          break
        default:
          errors.push({ error: `Unknown event type: ${item.type}` })
          continue
      }

      if (!validation.success) {
        errors.push({
          error: 'Invalid payload',
          details: validation.error.issues,
          type: item.type,
        })
        continue
      }

      // Process the validated event
      waitUntil(integrationManager.process(validation.data))
      processedEvents.push({ type: item.type, status: 'processed' })
    } catch (error) {
      errors.push({
        error: 'Processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: item.type,
      })
    }
  }

  // Return success if at least some events were processed
  if (processedEvents.length > 0) {
    const response: any = {
      success: true,
      processed: processedEvents.length,
      total: body.batch.length,
    }

    if (errors.length > 0) {
      response.errors = errors
    }

    return response
  } else {
    event.node.res.statusCode = 400
    return { error: 'No events could be processed', details: errors }
  }
})
