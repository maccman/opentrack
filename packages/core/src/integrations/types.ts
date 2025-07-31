import type { AliasPayload, GroupPayload, IdentifyPayload, PagePayload, TrackPayload } from '@app/spec'

export type IntegrationPayload = TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload
