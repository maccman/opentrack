import { describe, expect, it } from 'vitest'

import { validateWebhookConfig } from '../../utils/config'

describe('validateWebhookConfig', () => {
  const validConfig = {
    url: 'https://webhook.example.com/events',
  }

  it('should validate valid config with defaults', () => {
    const result = validateWebhookConfig(validConfig)

    expect(result).toMatchObject({
      url: 'https://webhook.example.com/events',
      method: 'POST',
      timeout: 10000,
      retryAttempts: 3,
      includePayload: true,
      validateSsl: true,
    })
  })

  it('should validate config with all options', () => {
    const config = {
      url: 'https://api.example.com/webhook',
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'value',
      },
      timeout: 5000,
      retryAttempts: 2,
      includePayload: false,
      validateSsl: false,
    }

    const result = validateWebhookConfig(config)

    expect(result).toMatchObject(config)
  })

  it('should throw error for invalid URL', () => {
    const config = {
      url: 'not-a-url',
    }

    expect(() => validateWebhookConfig(config)).toThrow('Must be a valid URL')
  })

  it('should throw error for invalid HTTP method', () => {
    const config = {
      url: 'https://example.com',
      method: 'INVALID',
    }

    expect(() => validateWebhookConfig(config)).toThrow()
  })

  it('should throw error for negative timeout', () => {
    const config = {
      url: 'https://example.com',
      timeout: -1000,
    }

    expect(() => validateWebhookConfig(config)).toThrow()
  })

  it('should throw error for invalid retry attempts', () => {
    const config = {
      url: 'https://example.com',
      retryAttempts: -1,
    }

    expect(() => validateWebhookConfig(config)).toThrow()

    const configTooHigh = {
      url: 'https://example.com',
      retryAttempts: 15,
    }

    expect(() => validateWebhookConfig(configTooHigh)).toThrow()
  })

  it('should accept all supported HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

    for (const method of methods) {
      const config = {
        url: 'https://example.com',
        method,
      }

      expect(() => validateWebhookConfig(config)).not.toThrow()
    }
  })

  it('should handle missing optional fields', () => {
    const config = {
      url: 'https://example.com',
      headers: undefined,
    }

    const result = validateWebhookConfig(config)
    expect(result.headers).toBeUndefined()
  })
})
