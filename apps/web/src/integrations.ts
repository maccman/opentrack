import type { LoggerConfig } from '@app/core'
import { IntegrationManager } from '@app/core'
import type { Integration } from '@app/spec'
import { BigQueryIntegration, type BigQueryIntegrationConfig } from '@integrations/bigquery'
import { CustomerioIntegration, type CustomerioConfig } from '@integrations/customerio'
import { WebhookIntegration, type WebhookIntegrationConfig } from '@integrations/webhook'
import pino from 'pino'

// =============================================================================
// SHARED UTILITIES
// =============================================================================

/**
 * Logger configuration constants
 */
const LOGGER_NAME = 'IntegrationManager' as const
const DEFAULT_PRODUCTION_LOG_LEVEL = 'info' as const
const DEFAULT_DEVELOPMENT_LOG_LEVEL = 'debug' as const

/**
 * Helper function to safely retrieve optional environment variables
 * @param name - The environment variable name
 * @returns The environment variable value or undefined if not set
 */
function getOptionalEnvVar(name: string): string | undefined {
  return process.env[name]
}

/**
 * Parses JSON credentials from a string with proper error handling
 * @param jsonString - The JSON string to parse
 * @returns Parsed credentials object
 * @throws Error if JSON is invalid
 */
function parseJsonCredentials(jsonString: string): object {
  try {
    return JSON.parse(jsonString) as object
  } catch {
    throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON format')
  }
}

// =============================================================================
// BIGQUERY INTEGRATION
// =============================================================================

/**
 * Creates a BigQuery integration instance if the required environment variables are set
 *
 * Required environment variables:
 * - BIGQUERY_PROJECT_ID: Google Cloud project ID
 * - BIGQUERY_DATASET: BigQuery dataset name
 *
 * Optional environment variables:
 * - BIGQUERY_AUTO_TABLE_MANAGEMENT: Enable/disable automatic table management (defaults to true)
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON: JSON string containing service account credentials
 *
 * @returns BigQuery integration instance or null if required variables are missing
 */
function createBigQueryIntegration(): Integration | null {
  const projectId = getOptionalEnvVar('BIGQUERY_PROJECT_ID')
  const datasetId = getOptionalEnvVar('BIGQUERY_DATASET')

  if (!projectId || !datasetId) {
    return null
  }

  const config: BigQueryIntegrationConfig = {
    projectId,
    datasetId,
    autoTableManagement: getOptionalEnvVar('BIGQUERY_AUTO_TABLE_MANAGEMENT') !== 'false',
  }

  const credentialsJson = getOptionalEnvVar('GOOGLE_APPLICATION_CREDENTIALS_JSON')
  if (credentialsJson) {
    config.credentials = parseJsonCredentials(credentialsJson)
  }

  return new BigQueryIntegration(config)
}

// =============================================================================
// CUSTOMER.IO INTEGRATION
// =============================================================================

/**
 * Customer.io region constants
 */
const DEFAULT_CUSTOMERIO_REGION = 'US' as const
const EU_REGION = 'EU' as const

/**
 * Creates a Customer.io integration instance if the required environment variables are set
 *
 * Required environment variables:
 * - CUSTOMERIO_SITE_ID: Customer.io site identifier
 * - CUSTOMERIO_API_KEY: Customer.io API key
 *
 * Optional environment variables:
 * - CUSTOMERIO_REGION: Customer.io region ('EU' or 'US', defaults to 'US')
 *
 * @returns Customer.io integration instance or null if required variables are missing
 */
function createCustomerioIntegration(): Integration | null {
  const siteId = getOptionalEnvVar('CUSTOMERIO_SITE_ID')
  const apiKey = getOptionalEnvVar('CUSTOMERIO_API_KEY')

  if (!siteId || !apiKey) {
    return null
  }

  const region = getOptionalEnvVar('CUSTOMERIO_REGION')?.toUpperCase()
  const config: CustomerioConfig = {
    siteId,
    apiKey,
    region: region === EU_REGION ? EU_REGION : DEFAULT_CUSTOMERIO_REGION,
  }

  return new CustomerioIntegration(config)
}

// =============================================================================
// WEBHOOK INTEGRATION
// =============================================================================

/**
 * Webhook configuration constants
 */
const DEFAULT_HTTP_METHOD = 'POST' as const

/**
 * Creates a webhook integration instance if the required environment variables are set
 *
 * Required environment variables:
 * - WEBHOOK_URL: The webhook endpoint URL
 *
 * @returns Webhook integration instance or null if required variables are missing
 */
function createWebhookIntegration(): Integration | null {
  const url = getOptionalEnvVar('WEBHOOK_URL')

  if (!url) {
    return null
  }

  const config: WebhookIntegrationConfig = {
    url,
    method: DEFAULT_HTTP_METHOD,
  }

  return new WebhookIntegration(config)
}

// =============================================================================
// INTEGRATION FACTORY
// =============================================================================

/**
 * Creates and returns all available integrations based on environment configuration
 *
 * This function attempts to create each integration type and filters out any
 * that couldn't be created due to missing required environment variables.
 *
 * @returns Array of successfully configured integration instances
 */
function createIntegrations(): Integration[] {
  const integrationFactories = [createBigQueryIntegration, createCustomerioIntegration, createWebhookIntegration]

  return integrationFactories
    .map((factory) => factory())
    .filter((integration): integration is Integration => integration !== null)
}

/**
 * Creates logger configuration for the integration manager
 *
 * Debug logging is enabled when:
 * - OPENTRACK_DEBUG environment variable is set to 'true', OR
 * - NODE_ENV is set to 'development'
 *
 * Environment variables:
 * - OPENTRACK_DEBUG: Enable debug logging ('true' to enable)
 * - NODE_ENV: Application environment ('development', 'production', etc.)
 * - OPENTRACK_LOG_LEVEL: Override default log level
 *
 * @returns Logger configuration or undefined if debug logging is disabled
 */
function createLoggerConfig(): LoggerConfig | undefined {
  const isDebugEnabled =
    getOptionalEnvVar('OPENTRACK_DEBUG') === 'true' || getOptionalEnvVar('NODE_ENV') === 'development'

  if (!isDebugEnabled) {
    return undefined
  }

  const isProduction = getOptionalEnvVar('NODE_ENV') === 'production'
  const defaultLevel = isProduction ? DEFAULT_PRODUCTION_LOG_LEVEL : DEFAULT_DEVELOPMENT_LOG_LEVEL
  const logLevel = getOptionalEnvVar('OPENTRACK_LOG_LEVEL') || defaultLevel

  const logger = pino({
    name: LOGGER_NAME,
    level: logLevel,
  })

  return {
    enabled: true,
    logger,
  }
}

/**
 * Main integration manager instance configured with all available integrations and logger
 *
 * This is the primary export that should be used throughout the application
 * to access integration functionality.
 */
export const integrationManager = new IntegrationManager(createIntegrations(), createLoggerConfig())
