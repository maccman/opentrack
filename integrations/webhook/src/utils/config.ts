import { z } from 'zod'

/**
 * Supported HTTP methods for webhook requests
 */
export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
export type HttpMethod = z.infer<typeof httpMethodSchema>

/**
 * Configuration schema for webhook integration
 */
export const webhookConfigSchema = z.object({
  /**
   * The webhook endpoint URL
   */
  url: z.string().url('Must be a valid URL'),

  /**
   * HTTP method to use for requests
   * @default 'POST'
   */
  method: httpMethodSchema.optional().default('POST'),

  /**
   * Custom headers to include in requests
   */
  headers: z.record(z.string(), z.string()).optional(),

  /**
   * Request timeout in milliseconds
   * @default 10000 (10 seconds)
   */
  timeout: z.number().positive().optional().default(10000),

  /**
   * Number of retry attempts for failed requests
   * @default 3
   */
  retryAttempts: z.number().min(0).max(10).optional().default(3),

  /**
   * Whether to include the original payload in the webhook request
   * @default true
   */
  includePayload: z.boolean().optional().default(true),

  /**
   * Whether to validate SSL certificates
   * @default true
   */
  validateSsl: z.boolean().optional().default(true),
})

export type WebhookConfig = z.infer<typeof webhookConfigSchema>

/**
 * Validates and parses webhook configuration
 */
export function validateWebhookConfig(config: unknown): WebhookConfig {
  return webhookConfigSchema.parse(config)
}
