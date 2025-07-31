import type {
  AliasPayload,
  GroupPayload,
  IdentifyPayload,
  Integration,
  PagePayload,
  TrackPayload,
} from '@app/spec'
import { BigQuery } from '@google-cloud/bigquery'

type Payload =
  | TrackPayload
  | IdentifyPayload
  | PagePayload
  | GroupPayload
  | AliasPayload

export class BigQueryIntegration implements Integration {
  public name = 'BigQuery'
  private client: BigQuery | null = null
  private tableId = process.env.BIGQUERY_TABLE
  private datasetId = process.env.BIGQUERY_DATASET

  constructor() {
    if (this.isEnabled()) {
      this.client = new BigQuery()
    }
  }

  public isEnabled(): boolean {
    return !!(process.env.BIGQUERY_PROJECT_ID && this.datasetId && this.tableId)
  }

  private async insert(payload: Payload, type: string) {
    if (!this.client) {
      return
    }

    const row = this.transformToRow(payload, type)
    await this.client
      .dataset(this.datasetId!)
      .table(this.tableId!)
      .insert([row])
  }

  public async track(payload: TrackPayload): Promise<void> {
    await this.insert(payload, 'track')
  }

  public async identify(payload: IdentifyPayload): Promise<void> {
    await this.insert(payload, 'identify')
  }

  public async page(payload: PagePayload): Promise<void> {
    await this.insert(payload, 'page')
  }

  public async group(payload: GroupPayload): Promise<void> {
    await this.insert(payload, 'group')
  }

  public async alias(payload: AliasPayload): Promise<void> {
    await this.insert(payload, 'alias')
  }

  private transformToRow(payload: Payload, type: string): object {
    const base = {
      message_id: payload.messageId,
      timestamp: payload.timestamp,
      type: type,
      user_id: payload.userId,
      context: JSON.stringify(payload.context || {}),
    }

    if (payload.type === 'track') {
      return {
        ...base,
        anonymous_id: payload.anonymousId,
        event: payload.event,
        properties: JSON.stringify(payload.properties || {}),
      }
    }

    if (payload.type === 'identify') {
      return {
        ...base,
        anonymous_id: payload.anonymousId,
        traits: JSON.stringify(payload.traits || {}),
      }
    }

    if (payload.type === 'page') {
      return {
        ...base,
        anonymous_id: payload.anonymousId,
        name: payload.name,
        properties: JSON.stringify(payload.properties || {}),
      }
    }

    if (payload.type === 'group') {
      return {
        ...base,
        anonymous_id: payload.anonymousId,
        group_id: payload.groupId,
        traits: JSON.stringify(payload.traits || {}),
      }
    }

    if (payload.type === 'alias') {
      return {
        ...base,
        previous_id: payload.previousId,
      }
    }

    throw new Error(`Unknown payload type: ${type}`)
  }
}
