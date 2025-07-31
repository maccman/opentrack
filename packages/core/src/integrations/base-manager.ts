import type {
  AliasPayload,
  GroupPayload,
  IdentifyPayload,
  Integration,
  PagePayload,
  TrackPayload,
} from '@app/spec'

type SegmentPayload =
  | TrackPayload
  | IdentifyPayload
  | PagePayload
  | GroupPayload
  | AliasPayload

export class BaseIntegrationManager {
  private enabledIntegrations: Integration[] = []

  constructor(integrations: (new () => Integration)[]) {
    this.enabledIntegrations = integrations
      .map((I) => new I())
      .filter((i) => i.isEnabled())
  }

  public async process(payload: SegmentPayload) {
    const promises = this.enabledIntegrations.map((integration) => {
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
