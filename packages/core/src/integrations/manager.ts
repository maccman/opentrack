import type { Integration } from '@app/spec'

import type { IntegrationPayload } from './types'

export class IntegrationManager {
  protected integrations: Integration[] = []

  constructor(integrations: Integration[]) {
    this.integrations = integrations
  }

  public async process(payload: IntegrationPayload) {
    const promises = this.integrations.map((integration) => {
      switch (payload.type) {
        case 'track':
          return integration.track(payload)
        case 'identify':
          return integration.identify(payload)
        case 'page':
          return integration.page(payload)
        case 'group':
          return integration.group(payload)
        case 'alias':
          return integration.alias(payload)
      }
    })

    await Promise.allSettled(promises)
  }
}
