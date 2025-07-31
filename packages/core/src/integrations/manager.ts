import type { Integration } from '@app/spec'
import type { Logger } from 'pino'
import pino from 'pino'

import type { IntegrationPayload, IntegrationResult, LoggerConfig } from './types'

export class IntegrationManager {
  protected integrations: Integration[] = []
  protected logger: Logger | null = null

  constructor(integrations: Integration[], loggerConfig?: LoggerConfig) {
    this.integrations = integrations

    if (loggerConfig?.enabled) {
      this.logger =
        loggerConfig.logger ??
        pino({
          name: 'IntegrationManager',
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        })
    }

    this.logger?.info(
      { integrationNames: integrations.map((integration) => integration.constructor.name) },
      'Integrations loaded'
    )
  }

  public async process(payload: IntegrationPayload): Promise<IntegrationResult[]> {
    const startTime = Date.now()

    this.logger?.info(
      {
        type: payload.type,
        userId: 'userId' in payload ? payload.userId : undefined,
        anonymousId: 'anonymousId' in payload ? payload.anonymousId : undefined,
        timestamp: payload.timestamp,
      },
      'Processing event'
    )

    const promises = this.integrations.map(async (integration): Promise<IntegrationResult> => {
      const integrationName = integration.constructor.name
      const integrationStartTime = Date.now()

      this.logger?.info({ integration: integrationName }, 'Starting integration')

      try {
        switch (payload.type) {
          case 'track':
            await integration.track(payload)
            break
          case 'identify':
            await integration.identify(payload)
            break
          case 'page':
            await integration.page(payload)
            break
          case 'group':
            await integration.group(payload)
            break
          case 'alias':
            await integration.alias(payload)
            break
        }

        const duration = Date.now() - integrationStartTime
        this.logger?.info(
          {
            integration: integrationName,
            duration,
          },
          'Integration completed successfully'
        )

        return {
          integrationName,
          success: true,
          duration,
        }
      } catch (error) {
        const duration = Date.now() - integrationStartTime
        const errorObj = error instanceof Error ? error : new Error(String(error))

        this.logger?.error(
          {
            integration: integrationName,
            duration,
            error: errorObj.message,
            stack: errorObj.stack,
          },
          'Integration failed'
        )

        return {
          integrationName,
          success: false,
          error: errorObj,
          duration,
        }
      }
    })

    const results = await Promise.allSettled(promises)
    const integrationResults = results.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            integrationName: 'Unknown',
            success: false,
            error: new Error('Promise rejected'),
            duration: 0,
          }
    )

    const totalDuration = Date.now() - startTime
    const successCount = integrationResults.filter((r) => r.success).length
    const failureCount = integrationResults.length - successCount

    this.logger?.info(
      {
        totalDuration,
        totalIntegrations: integrationResults.length,
        successful: successCount,
        failed: failureCount,
        results: integrationResults.map((r) => ({
          integration: r.integrationName,
          success: r.success,
          duration: r.duration,
          error: r.error?.message,
        })),
      },
      'Processing completed'
    )

    return integrationResults
  }
}
