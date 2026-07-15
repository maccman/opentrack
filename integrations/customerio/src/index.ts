import type { AliasPayload, GroupPayload, IdentifyPayload, Integration, PagePayload, TrackPayload } from '@app/spec'
import { assertString } from '@app/utils'
import { TrackClient } from 'customerio-node'

import { CustomerioErrorHandler, CustomerioTransformer, RegionManager, type CustomerioRegion } from './utils'

export interface CustomerioConfig {
  siteId: string
  apiKey: string
  region?: CustomerioRegion
  timeout?: number
  retryAttempts?: number
}

export class CustomerioIntegration implements Integration {
  public name = 'Customer.io'
  private client: TrackClient
  private config: CustomerioConfig
  private regionManager: RegionManager

  constructor(config: CustomerioConfig) {
    assertString(config.siteId, 'siteId is required')
    assertString(config.apiKey, 'apiKey is required')

    this.config = {
      timeout: 10000,
      retryAttempts: 3,
      region: 'US',
      ...config,
    }

    this.regionManager = new RegionManager(this.config.region)

    this.client = new TrackClient(this.config.siteId, this.config.apiKey, {
      region: this.regionManager.getCustomerioRegion(),
      timeout: this.config.timeout,
    })
  }

  /**
   * Identify a user in Customer.io
   */
  async identify(payload: IdentifyPayload): Promise<void> {
    try {
      const transformed = CustomerioTransformer.transformIdentify(payload)

      // Validate email if present
      if (
        transformed.traits.email &&
        typeof transformed.traits.email === 'string' &&
        !CustomerioTransformer.isValidEmail(transformed.traits.email)
      ) {
        throw new Error(`Invalid email format: ${transformed.traits.email}`)
      }

      // Sanitize properties
      transformed.traits = CustomerioTransformer.sanitizeProperties(transformed.traits)

      await this.executeWithRetry(() => this.client.identify(transformed.id, transformed.traits))
    } catch (error) {
      throw CustomerioErrorHandler.mapError(error)
    }
  }

  /**
   * Track an event in Customer.io
   */
  async track(payload: TrackPayload): Promise<void> {
    try {
      const transformed = CustomerioTransformer.transformTrack(payload)

      // Sanitize properties
      transformed.properties = CustomerioTransformer.sanitizeProperties(transformed.properties)

      if (transformed.id) {
        // Regular track event with user ID
        await this.executeWithRetry(() =>
          this.client.track(transformed.id!, {
            name: transformed.event,
            data: transformed.properties,
          })
        )
      } else {
        // Anonymous track event
        const anonymousId = payload.anonymousId || this.generateAnonymousId()
        await this.executeWithRetry(() =>
          this.client.trackAnonymous(anonymousId, {
            name: transformed.event,
            data: transformed.properties,
          })
        )
      }
    } catch (error) {
      throw CustomerioErrorHandler.mapError(error)
    }
  }

  /**
   * Track a page view in Customer.io
   */
  async page(payload: PagePayload): Promise<void> {
    try {
      const transformed = CustomerioTransformer.transformPage(payload)

      // Sanitize properties
      transformed.properties = CustomerioTransformer.sanitizeProperties(transformed.properties)

      if (transformed.id) {
        // Page view with user ID - track as custom event
        await this.executeWithRetry(() =>
          this.client.track(transformed.id!, {
            name: transformed.event,
            data: transformed.properties,
          })
        )

        // Also track as page view if URL is available
        if (transformed.properties.url) {
          await this.executeWithRetry(() =>
            this.client.trackPageView(transformed.id!, transformed.properties.url as string)
          )
        }
      } else {
        // Anonymous page view
        const anonymousId = payload.anonymousId || this.generateAnonymousId()
        await this.executeWithRetry(() =>
          this.client.trackAnonymous(anonymousId, {
            name: transformed.event,
            data: transformed.properties,
          })
        )
      }
    } catch (error) {
      throw CustomerioErrorHandler.mapError(error)
    }
  }

  /**
   * Associate a user with a group in Customer.io
   */
  async group(payload: GroupPayload): Promise<void> {
    try {
      const transformed = CustomerioTransformer.transformGroup(payload)

      // Sanitize properties
      transformed.traits = CustomerioTransformer.sanitizeProperties(transformed.traits)

      // Customer.io doesn't have a direct group API, so we'll:
      // 1. Update the user with group information as attributes
      // 2. Track a "Group Joined" event

      const groupTraits = {
        [`group_${transformed.groupId}`]: true,
        [`group_${transformed.groupId}_joined_at`]: Math.floor(Date.now() / 1000),
        ...Object.fromEntries(Object.entries(transformed.traits).map(([key, value]) => [`group_${key}`, value])),
      }

      // Update user with group information
      await this.executeWithRetry(() => this.client.identify(transformed.id, groupTraits))

      // Track group joined event
      await this.executeWithRetry(() =>
        this.client.track(transformed.id, {
          name: 'Group Joined',
          data: {
            group_id: transformed.groupId,
            ...transformed.traits,
          },
        })
      )
    } catch (error) {
      throw CustomerioErrorHandler.mapError(error)
    }
  }

  /**
   * Alias (merge) user identities in Customer.io
   */
  async alias(payload: AliasPayload): Promise<void> {
    try {
      const transformed = CustomerioTransformer.transformAlias(payload)

      await this.executeWithRetry(() =>
        this.client.mergeCustomers(
          transformed.primaryType,
          transformed.primaryId,
          transformed.secondaryType,
          transformed.secondaryId
        )
      )
    } catch (error) {
      throw CustomerioErrorHandler.mapError(error)
    }
  }

  /**
   * Get integration name
   */
  getName(): string {
    return 'customerio'
  }

  /**
   * Get integration configuration
   */
  getConfig(): CustomerioConfig {
    return { ...this.config }
  }

  /**
   * Update region configuration
   */
  setRegion(region: CustomerioRegion): void {
    this.config.region = region
    this.regionManager.setRegion(region)

    // Recreate client with new region
    this.client = new TrackClient(this.config.siteId, this.config.apiKey, {
      region: this.regionManager.getCustomerioRegion(),
      timeout: this.config.timeout,
    })
  }

  /**
   * Test the connection to Customer.io
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple identify call with test data
      await this.client.identify('test_user_' + Date.now(), {
        email: 'test@example.com',
        test: true,
      })
      return true
    } catch (error) {
      const mappedError = CustomerioErrorHandler.mapError(error)

      // Authentication/authorization errors indicate connection issues
      if (mappedError.code === 'AUTHENTICATION_ERROR' || mappedError.code === 'AUTHORIZATION_ERROR') {
        return false
      }

      // Other errors might be acceptable for connection test
      return true
    }
  }

  /**
   * Execute a function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt < this.config.retryAttempts!; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        const mappedError = CustomerioErrorHandler.mapError(error)

        // Don't retry for non-retryable errors
        if (!CustomerioErrorHandler.isRetryableError(mappedError)) {
          throw mappedError
        }

        // Don't retry on the last attempt
        if (attempt === this.config.retryAttempts! - 1) {
          break
        }

        // Wait before retrying
        const delay = CustomerioErrorHandler.getRetryDelay(attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw CustomerioErrorHandler.mapError(lastError)
  }

  /**
   * Generate a random anonymous ID
   */
  private generateAnonymousId(): string {
    return 'anon_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
  }
}

export default CustomerioIntegration
