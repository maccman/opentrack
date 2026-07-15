import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'

import { getAllowedIntegrationNames, setWriteKeyRouting } from '../ingest-routing'

function createEvent(): H3Event {
  return { context: {} } as H3Event
}

describe('ingest routing', () => {
  it('restricts the product source to BigQuery', () => {
    const event = createEvent()
    setWriteKeyRouting(event, 'bigquery-only')

    expect(getAllowedIntegrationNames(event)).toEqual(['BigQuery'])
  })

  it('leaves the default source unrestricted', () => {
    const event = createEvent()
    setWriteKeyRouting(event, 'all')

    expect(getAllowedIntegrationNames(event)).toBeUndefined()
  })
})
