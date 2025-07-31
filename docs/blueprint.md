# OpenTrack Architectural Blueprint

This document outlines the architecture and implementation plan for OpenTrack, an open-source Segment alternative designed to be deployed on Vercel.

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

1.  **API Endpoints (`apps/web/src/routes/v1/`)**:
    - The five API route handlers in Nitro are already implemented for each Segment endpoint:
      - `track.post.ts`
      - `identify.post.ts`
      - `page.post.ts`
      - `group.post.ts`
      - `alias.post.ts`
    - Each handler is responsible for receiving the request, validating the body, and triggering asynchronous processing.

2.  **Validation Layer (`packages/spec/src/validation/`)**:
    - We are using `zod` for robust payload validation.
    - A separate Zod schema for each event type (`Track`, `Identify`, `Page`, etc.) is already created based on the detailed specifications in the `docs/`. This ensures data integrity before it's passed to integrations.
    - This logic lives in the `packages/spec` module.

#### Phase 2: Extensible Integration Framework

1.  **Integration Interface (`packages/spec/src/integration.ts`)**:
    - A generic `Integration` interface is defined in the `packages/spec` module. All third-party integrations must implement this interface, ensuring a consistent contract.

    ```typescript
    // packages/spec/src/integration.ts
    export interface Integration {
      name: string
      isEnabled(): boolean
      init?(): Promise<void>

      track(payload: TrackPayload): Promise<void>
      identify(payload: IdentifyPayload): Promise<void>
      page(payload: PagePayload): Promise<void>
      group(payload: GroupPayload): Promise<void>
      alias(payload: AliasPayload): Promise<void>
    }
    ```

2.  **Integration Manager (`packages/core/src/integrations/`)**:
    - A singleton manager, composed of `BaseIntegrationManager` and a concrete `IntegrationManager`, handles all available integrations.
    - **Registry**: It maintains a list of all integration classes (e.g., `[BigQueryIntegration, CustomerIOIntegration]`).
    - **Initialization**: On startup, it filters the registry to only enabled integrations (by calling `isEnabled()`) and initializes them.
    - **Event Processing**: It has a central `process` method that takes an event and fans it out to all enabled integrations.

    ```typescript
    // packages/core/src/integrations/base-manager.ts
    export class BaseIntegrationManager {
      // ...
      constructor(integrations: (new () => Integration)[]) {
        // ...
      }

      public async process(payload: SegmentPayload) {
        // ...
      }
    }

    // packages/core/src/integrations/manager.ts
    export class IntegrationManager extends BaseIntegrationManager {
      constructor() {
        super([BigQueryIntegration /*, CustomerIOIntegration */])
      }
    }
    ```

### 3. Core Event Flow in Detail

Here’s how the `track.post.ts` handler works, serving as a template for all other endpoints:

```typescript
// apps/web/src/routes/v1/track.post.ts
import { IntegrationManager } from '@app/core'
import { trackEventSchema, type TrackPayload } from '@app/spec'
import { waitUntil } from '@vercel/functions'
import { defineEventHandler, readBody } from 'h3'

const integrationManager = new IntegrationManager()

export default defineEventHandler(async (event) => {
  // 1. Read and validate body
  const body = await readBody<TrackPayload>(event)
  const validation = trackEventSchema.safeParse({ ...body, type: 'track' })

  if (!validation.success) {
    // Set response status and return validation errors
    event.node.res.statusCode = 400
    return { error: 'Invalid payload', details: validation.error.issues }
  }

  // 2. Offload processing to `waitUntil`
  waitUntil(integrationManager.process(validation.data))

  // 3. Return immediate success response
  return { success: true }
})
```
