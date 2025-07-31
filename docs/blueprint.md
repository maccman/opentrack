# Libroseg Architectural Blueprint

This document outlines the architecture and implementation plan for Libroseg, an open-source Segment alternative designed to be deployed on Vercel.

### 1. High-Level Architecture

The system will be built around Vercel Functions (using Nitro), which will handle incoming API requests. The core principle is to provide an immediate response to the client and then process the event asynchronously using Vercel's `waitUntil` feature. This ensures that the client-facing API is extremely fast and resilient to failures in downstream integrations.

Here’s a diagram of the proposed architecture:

```mermaid
graph TD
    subgraph "Client"
        A[Segment SDK Request<br/>(e.g., POST /v1/track)]
    end

    subgraph "Vercel Serverless Function"
        A --> B{Nitro API Endpoint};
        B --> C[1. Parse & Validate Payload<br/>(using Zod)];
        C --> D[2. Immediately Return 200 OK];
        C --> E[3. Call `waitUntil` with Event];
    end

    subgraph "Async Processing (via waitUntil)"
        E --> F{Integration Manager};
        F --> G[BigQuery Integration];
        F --> H[Customer.io Integration];
        F --> I[...Future Integrations];
    end

    subgraph "Downstream Services"
        G --> J[(Google BigQuery)];
        H --> K[(Customer.io API)];
    end
```

### 2. Component Breakdown & Implementation Plan

#### Phase 1: Core Plumbing & API Endpoints

1.  **API Endpoints (`apps/web/server/routes/v1/`)**:

    - Create five API route handlers using Nitro for each Segment endpoint:
      - `track.post.ts`
      - `identify.post.ts`
      - `page.post.ts`
      - `group.post.ts`
      - `alias.post.ts`
    - Each handler will be responsible for receiving the request, validating the body, and triggering the asynchronous processing.

2.  **Validation Layer (`packages/core/src/validation/`)**:
    - We will use `zod` for robust payload validation.
    - Create a separate Zod schema for each event type (`Track`, `Identify`, `Page`, etc.) based on the detailed specifications in the `docs/`. This ensures data integrity before it's passed to integrations.
    - This logic will live in a new `packages/core` module to be shared across the application.

#### Phase 2: Extensible Integration Framework

1.  **Integration Interface (`packages/core/src/integrations/`)**:

    - Define a generic `Integration` interface. All third-party integrations will implement this interface, ensuring a consistent contract.

    ```typescript
    // packages/core/src/integrations/types.ts
    export interface Integration {
      name: string
      isEnabled(): boolean // Checks if required env vars are present
      init?(): Promise<void> // Optional: for async setup

      track(payload: TrackPayload): Promise<void>
      identify(payload: IdentifyPayload): Promise<void>
      page(payload: PagePayload): Promise<void>
      group(payload: GroupPayload): Promise<void>
      alias(payload: AliasPayload): Promise<void>
    }
    ```

2.  **Integration Manager (`packages/core/src/integrations/manager.ts`)**:

    - This singleton will manage all available integrations.
    - **Registry**: It will maintain a list of all integration classes (e.g., `[BigQueryIntegration, CustomerIOIntegration]`).
    - **Initialization**: On startup, it will filter the registry to only enabled integrations (by calling `isEnabled()`) and initialize them.
    - **Event Processing**: It will have a central `process` method that takes an event and fans it out to all enabled integrations.

    ```typescript
    // packages/core/src/integrations/manager.ts
    class IntegrationManager {
      private enabledIntegrations: Integration[] = []

      constructor(integrations: (new () => Integration)[]) {
        this.enabledIntegrations = integrations
          .map((I) => new I())
          .filter((i) => i.isEnabled())
      }

      public async process(event: SegmentEvent) {
        const promises = this.enabledIntegrations.map((integration) => {
          switch (event.type) {
            case 'track':
              return integration.track(event.payload)
            // ... other cases for identify, page, group, alias
          }
        })

        // Use Promise.allSettled to ensure one failing integration
        // doesn't stop others. Log any failures.
        await Promise.allSettled(promises)
      }
    }
    ```

### 3. Core Event Flow in Detail

Here’s how the `track.post.ts` handler would work, serving as a template for all other endpoints:

```typescript
// apps/web/server/routes/v1/track.post.ts
import { defineEventHandler, readBody } from 'h3'
import { waitUntil } from '@vercel/functions'
import { trackSchema } from './...' // Zod schema
import { integrationManager } from './...' // Singleton instance

export default defineEventHandler(async (event) => {
  // 1. Read and validate body
  const body = await readBody(event)
  const validation = trackSchema.safeParse(body)

  if (!validation.success) {
    // Set response status and return validation errors
    event.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  // 2. Offload processing to `waitUntil`
  waitUntil(
    integrationManager.process({
      type: 'track',
      payload: validation.data,
    }),
  )

  // 3. Return immediate success response
  return { success: true }
})
```

### 4. Example Integration: BigQuery (Start to Finish)

This demonstrates how a new integration is created and how it functions within the framework.

1.  **Create the Integration File (`packages/core/src/integrations/bigquery.ts`)**:

    ```typescript
    import { BigQuery } from '@google-cloud/bigquery'
    import type { Integration, TrackPayload } from './types'

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
        return !!(
          process.env.BIGQUERY_PROJECT_ID &&
          this.datasetId &&
          this.tableId
        )
      }

      // Track event handler
      public async track(payload: TrackPayload): Promise<void> {
        // 1. Transform the payload to a flat BigQuery row
        const row = this.transformToRow(payload, 'track')

        // 2. Insert the row into BigQuery
        await this.client!.dataset(this.datasetId!)
          .table(this.tableId!)
          .insert([row])
      }

      // ... Implement identify, page, group, alias methods similarly

      private transformToRow(payload: any, type: string): object {
        // A simple transformation to a flat structure.
        // This can be customized based on the desired table schema.
        return {
          message_id: payload.messageId,
          timestamp: payload.timestamp,
          type: type,
          user_id: payload.userId,
          anonymous_id: payload.anonymousId,
          event: payload.event, // Specific to track events
          properties: JSON.stringify(payload.properties || {}),
          context: JSON.stringify(payload.context || {}),
          traits: JSON.stringify(payload.traits || {}), // For identify events
        }
      }
    }
    ```

2.  **Update BigQuery Table Schema**: The target table in BigQuery should be created with a schema that can accept the transformed row data.

    ```sql
    CREATE TABLE your_dataset.your_table (
        message_id STRING,
        timestamp TIMESTAMP,
        type STRING,
        user_id STRING,
        anonymous_id STRING,
        event STRING,
        properties STRING, -- Stored as a JSON string
        context STRING,    -- Stored as a JSON string
        traits STRING      -- Stored as a JSON string
    );
    ```
