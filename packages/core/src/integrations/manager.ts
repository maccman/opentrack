import type { Integration } from '@app/spec'
import type { Logger } from 'pino'
import pino from 'pino'

import type {
  IntegrationPayload,
  IntegrationProcessOptions,
  IntegrationResult,
  LoggerConfig,
  SuppressionGuard,
} from './types'

export class IntegrationManager {
  protected integrations: Integration[] = []
  protected logger: Logger | null = null
  private suppressionGuard: SuppressionGuard | null = null

  constructor(integrations: Integration[], loggerConfig?: LoggerConfig, suppressionGuard?: SuppressionGuard) {
    this.integrations = integrations
    this.suppressionGuard = suppressionGuard ?? null

    if (loggerConfig?.enabled) {
      this.logger =
        loggerConfig.logger ??
        pino({
          name: 'IntegrationManager',
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
          serializers: {
            error: pino.stdSerializers.err,
          },
        })
    }

    this.logger?.info(
      { integrationNames: integrations.map((integration) => integration.constructor.name) },
      'Integrations loaded'
    )
  }

  /** Check the durable suppression boundary and propagate datastore failures. */
  public async isSuppressed(payload: IntegrationPayload): Promise<boolean> {
    if (!this.suppressionGuard) {
      return false
    }

    const { writeKey: _, ...cleanPayload } = payload as IntegrationPayload & { writeKey?: string }
    return await this.suppressionGuard.isSuppressed(cleanPayload as IntegrationPayload)
  }

  /** Return whether a configured destination is available for source routing. */
  public hasIntegration(name: string): boolean {
    return this.integrations.some((integration) => integration.name === name)
  }

  public async process(
    payload: IntegrationPayload,
    options: IntegrationProcessOptions = {}
  ): Promise<IntegrationResult[]> {
    const startTime = Date.now()

    // Strip writeKey before processing - it's for authentication only, not for integrations
    const { writeKey: _, ...cleanPayload } = payload as IntegrationPayload & { writeKey?: string }

    const allowedIntegrationNames = options.allowedIntegrationNames ? new Set(options.allowedIntegrationNames) : null
    const targetIntegrations = allowedIntegrationNames
      ? this.integrations.filter((integration) => allowedIntegrationNames.has(integration.name))
      : this.integrations

    if (this.suppressionGuard && !options.skipSuppressionCheck) {
      try {
        if (await this.suppressionGuard.isSuppressed(cleanPayload)) {
          this.logger?.info({ type: cleanPayload.type }, 'Event suppressed by privacy ledger')
          return targetIntegrations.map((integration) => ({
            integrationName: integration.constructor.name,
            success: true,
            duration: 0,
            suppressed: true,
          }))
        }
      } catch {
        this.logger?.error({ type: cleanPayload.type }, 'Privacy suppression check failed; event blocked')
        return targetIntegrations.map((integration) => ({
          integrationName: integration.constructor.name,
          success: false,
          duration: 0,
          blocked: true,
          error: new Error('Privacy suppression check failed closed'),
        }))
      }
    }

    this.logger?.info(
      {
        type: cleanPayload.type,
        timestamp: cleanPayload.timestamp,
      },
      'Processing event'
    )

    const promises = targetIntegrations.map(async (integration): Promise<IntegrationResult> => {
      const integrationName = integration.constructor.name
      const integrationStartTime = Date.now()

      this.logger?.info({ integration: integrationName }, 'Starting integration')

      try {
        switch (cleanPayload.type) {
          case 'track':
            await integration.track(cleanPayload)
            break
          case 'identify':
            await integration.identify(cleanPayload)
            break
          case 'page':
            await integration.page(cleanPayload)
            break
          case 'group':
            await integration.group(cleanPayload)
            break
          case 'alias':
            await integration.alias(cleanPayload)
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
            error: errorObj,
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
