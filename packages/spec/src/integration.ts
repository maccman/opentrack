import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'

export interface Integration {
  name: string
  isEnabled(): boolean
  init?(): Promise<void>

  track(payload: TrackPayload): Promise<void>
  identify(payload: IdentifyPayload): Promise<void>
  page(payload: PagePayload): Promise<void>
  group(payload: GroupPayload): Promise<void>
  alias(payload: AliasPayload): Promise<void>
}
