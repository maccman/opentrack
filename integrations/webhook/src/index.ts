import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '@app/spec'
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'

import { validateWebhookConfig, WebhookErrorHandler, WebhookTransformer, type WebhookConfig } from './utils'

export interface WebhookIntegrationConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  timeout?: number
  retryAttempts?: number
  includePayload?: boolean
  validateSsl?: boolean
}

export class WebhookIntegration implements Integration {
  public name = 'Webhook'
  private client: AxiosInstance
  private config: WebhookConfig

  constructor(config: WebhookIntegrationConfig) {
    // Validate and normalize configuration
    this.config = validateWebhookConfig(config)

    // Create axios instance with configuration
    this.client = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OpenTrack-Webhook/1.0.0',
        ...this.config.headers,
      },
      // SSL validation
      httpsAgent: this.config.validateSsl
        ? undefined
        : {
            rejectUnauthorized: false,
          },
    })

    // Add request interceptor for debugging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Webhook] Sending ${config.method?.toUpperCase()} request to ${config.url}`)
        return config
      },
      (error) => {
        console.error('[Webhook] Request interceptor error:', error)
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
    )

    // Add response interceptor for debugging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[Webhook] Received ${response.status} response from ${response.config.url}`)
        return response
      },
      (error) => {
        const mappedError = WebhookErrorHandler.mapError(error)
        console.error(`[Webhook] Request failed:`, mappedError.message)
        return Promise.reject(new Error(mappedError.message))
      }
    )
  }

  /**
   * Sends a request to the webhook endpoint with retry logic
   */
  private async sendWebhook(payload: Record<string, unknown>): Promise<void> {
    return await this.executeWithRetry(async () => {
      const requestConfig: AxiosRequestConfig = {
        method: this.config.method,
        url: this.config.url,
        data: payload,
      }

      // For GET requests, send data as query parameters
      if (this.config.method === 'GET') {
        requestConfig.params = payload
        delete requestConfig.data
      }

      await this.client.request(requestConfig)
    })
  }

  /**
   * Executes a function with retry logic for failed requests
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= this.config.retryAttempts + 1; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        const webhookError = WebhookErrorHandler.mapError(error)

        // Don't retry if it's the last attempt or error is not retryable
        if (attempt === this.config.retryAttempts + 1 || !WebhookErrorHandler.isRetryableError(webhookError)) {
          throw webhookError
        }

        // Wait before retrying
        const delay = WebhookErrorHandler.getRetryDelay(attempt)
        console.log(`[Webhook] Attempt ${attempt} failed, retrying in ${delay}ms:`, webhookError.message)
        await this.sleep(delay)
      }
    }

    // This should never be reached, but TypeScript requires it
    throw WebhookErrorHandler.mapError(lastError)
  }

  /**
   * Sleep utility for retry delays
   */
  private async sleep(ms: number): Promise<void> {
    return await new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Prepares the payload for sending based on configuration
   */
  private preparePayload(
    payload: TrackPayload | IdentifyPayload | PagePayload | GroupPayload | AliasPayload
  ): Record<string, unknown> {
    if (this.config.includePayload) {
      // Include full transformed payload
      const webhookPayload = WebhookTransformer.transform(payload)
      return WebhookTransformer.sanitize(webhookPayload) as unknown as Record<string, unknown>
    } else {
      // Send minimal payload without original data
      const minimalPayload = WebhookTransformer.transformMinimal(payload)
      return minimalPayload as Record<string, unknown>
    }
  }

  public async track(payload: TrackPayload): Promise<void> {
    const webhookPayload = this.preparePayload(payload)
    await this.sendWebhook(webhookPayload)
  }

  public async identify(payload: IdentifyPayload): Promise<void> {
    const webhookPayload = this.preparePayload(payload)
    await this.sendWebhook(webhookPayload)
  }

  public async page(payload: PagePayload): Promise<void> {
    const webhookPayload = this.preparePayload(payload)
    await this.sendWebhook(webhookPayload)
  }

  public async group(payload: GroupPayload): Promise<void> {
    const webhookPayload = this.preparePayload(payload)
    await this.sendWebhook(webhookPayload)
  }

  public async alias(payload: AliasPayload): Promise<void> {
    const webhookPayload = this.preparePayload(payload)
    await this.sendWebhook(webhookPayload)
  }

  /**
   * Tests the webhook connection by sending a test payload
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testPayload = {
        type: 'test',
        messageId: 'test-message-id',
        timestamp: new Date().toISOString(),
        data: {
          message: 'OpenTrack webhook connection test',
        },
        integrations: {
          webhook: {
            sentAt: new Date().toISOString(),
            version: '1.0.0',
          },
        },
      }

      await this.sendWebhook(testPayload)
      return true
    } catch (error) {
      console.error('[Webhook] Connection test failed:', error)
      return false
    }
  }

  /**
   * Gets the current configuration
   */
  public getConfig(): WebhookConfig {
    return { ...this.config }
  }

  /**
   * Updates the webhook URL
   */
  public setUrl(url: string): void {
    const newConfig = { ...this.config, url }
    this.config = validateWebhookConfig(newConfig)
  }

  /**
   * Updates custom headers
   */
  public setHeaders(headers: Record<string, string>): void {
    this.config.headers = headers

    // Update axios instance headers
    this.client.defaults.headers.common = {
      'Content-Type': 'application/json',
      'User-Agent': 'OpenTrack-Webhook/1.0.0',
      ...headers,
    }
  }
}
