# OpenTrack

**OpenTrack** is a lightweight, open-source Segment alternative designed for high-performance event tracking. Built to be deployed on Vercel and has a Segment compatible API.

## Quick start

1. Deploy OpenTrack to Vercel with a single click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/maccman/opentrack&envLink=https://github.com/maccman/opentrack#configuration)

2. Configure the integrations you want to use through ENV variables on Vercel (e.g. `CUSTOMERIO_SITE_ID`).

3. Install the OpenTrack client and start tracking events:

```bash
npm install opentrack-analytics
```

```javascript
import analytics from 'opentrack-analytics'

// Initialize with your OpenTrack instance
analytics.load('your-write-key', {
  host: 'https://your-opentrack-deployment.vercel.app',
})

// Track an event
analytics.track('Product Purchased', {
  productId: 'prod-456',
  price: 99.99,
  currency: 'USD',
})
```

## Documentation

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Integrations](#integrations)
  - [Google BigQuery](#google-bigquery)
  - [Customer.io](#customerio)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#usage)
  - [Using OpenTrack Client (Recommended)](#using-opentrack-client-recommended)
  - [Using `analytics-node` (Segment SDK)](#using-analytics-node-segment-sdk)
  - [Direct API Calls](#direct-api-calls)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Segment-Compliant API**: Drop-in replacement for Segment’s HTTP Tracking API. Use existing Segment SDKs with minimal configuration changes.
- **High Performance**: Built for serverless environments, OpenTrack provides rapid response times by processing events asynchronously.
- **Extensible Integration Framework**: Easily add new destinations for your analytics data.

## Available integrations

- [Google BigQuery](./integrations/bigquery/README.md)
- [Customer.io](./integrations/customerio/README.md)
- [Webhook](./integrations/webhook/README.md)

## Architecture

OpenTrack is designed for speed and reliability. It leverages a serverless architecture to handle incoming API requests and processes events asynchronously.

Here’s a high-level overview of the data flow:

```mermaid
graph TD
    subgraph "Client"
        A["Segment SDK Request"]
    end

    subgraph "Vercel Serverless Function"
        A --> B{Nitro API Endpoint}
        B --> C["Parse & Validate Payload"]
        C --> D["Return 200 OK"]
        C --> E["Process Event Async"]
    end

    subgraph "Async Processing"
        E --> F{Integration Manager}
        F --> G[BigQuery Integration]
        F --> H[Customer.io Integration]
    end

    subgraph "Downstream Services"
        G --> J[(Google BigQuery)]
        H --> K[(Customer.io API)]
    end
```

This asynchronous approach ensures that your application receives a fast response, while OpenTrack reliably delivers the data to your configured integrations.

## API Endpoints

OpenTrack emulates Segment’s HTTP Tracking API, providing the following endpoints:

- `POST /v1/track`
- `POST /v1/identify`
- `POST /v1/page`
- `POST /v1/group`
- `POST /v1/alias`

Payloads and responses for these endpoints are compatible with the official Segment API.

## Integrations

OpenTrack comes with pre-built support for the following integrations:

### Google BigQuery

- **Segment-Compatible Schema**: Data is stored in a schema that mirrors Segment's conventions, allowing you to use existing queries and BI tools.
- **Automatic Table & Schema Management**: Automatically creates datasets, tables, and columns, and adjusts data types as needed.
- **Dynamic SQL Views**: Includes a script to create analytics-ready views on top of your raw data.

### Customer.io

- **Full API Support**: Implements all core tracking methods (`identify`, `track`, `page`, `group`, `alias`).
- **Multi-Region Support**: Works with both US and EU data centers.
- **Resilient Delivery**: Features automatic retries with exponential backoff for reliable event delivery.

## Getting Started

Follow these steps to set up and run your own instance of OpenTrack.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/)

### Installation

#### Manual Deployment

1.  Clone the repository, and then import into Vercel.

### Configuration

1.  For development, **Create a `.env` file** in `./apps/web/.env`. For production, you can use the Vercel environment variables.
2.  **Add the following environment variables** for the integrations you want to use:

    ```env
    # Customer.io
    CUSTOMERIO_SITE_ID=your-customerio-site-id
    CUSTOMERIO_API_KEY=your-customerio-api-key
    CUSTOMERIO_REGION=US # or EU

    # Google BigQuery
    BIGQUERY_PROJECT_ID=your-gcp-project-id
    BIGQUERY_DATASET=your_bigquery_dataset_name
    # Optional: Set to 'false' to manage BigQuery schema manually
    BIGQUERY_AUTO_TABLE_MANAGEMENT=true
    ```

    You will also need to set up Google Cloud authentication. Refer to the instructions in the [Google BigQuery integration README](./integrations/bigquery/README.md).

## Usage

You can send data to your OpenTrack instance using the OpenTrack client library, any Segment-compatible library, or by making direct HTTP requests.

### Using OpenTrack Client (Recommended)

The OpenTrack client is a lightweight (~6KB), Segment-compatible analytics library designed specifically for OpenTrack. It works in browsers, Node.js, and SSR environments (Next.js, Astro, SvelteKit, etc.).

#### Installation

```bash
npm install opentrack-analytics
# or
pnpm add opentrack-analytics
```

#### Basic Usage

```javascript
import analytics from 'opentrack-analytics'

// Initialize with your OpenTrack instance
analytics.load('your-write-key', {
  host: 'https://your-opentrack-deployment.vercel.app',
  debug: process.env.NODE_ENV === 'development',
})

// Identify a user
analytics.identify('user-123', {
  email: 'test@example.com',
  name: 'Test User',
  plan: 'premium',
})

// Track an event
analytics.track('Product Purchased', {
  productId: 'prod-456',
  price: 99.99,
  currency: 'USD',
})

// Track a page view
analytics.page()

// Or with custom properties
analytics.page('Marketing', 'Pricing Page', {
  campaign: 'spring-sale',
})

// Group users by organization
analytics.group('company-456', {
  name: 'Acme Corp',
  industry: 'Technology',
})
```

#### Next.js Example

```typescript
// lib/analytics.ts
import analytics from 'opentrack-analytics'

analytics.load('your-write-key', {
  host: 'https://your-opentrack-deployment.vercel.app',
})

export default analytics

// components/Analytics.tsx
'use client'
import { useEffect } from 'react'
import analytics from '../lib/analytics'

export default function Analytics() {
  useEffect(() => {
    analytics.page()
  }, [])

  return null
}
```

#### Direct Browser Usage (Script Tag)

```html
<script src="https://unpkg.com/opentrack-analytics@1.0.0/dist/analytics.iife.js"></script>
<script>
  analytics.load('your-write-key', {
    host: 'https://your-opentrack-deployment.vercel.app',
  })
</script>
```

For more examples including Astro, SvelteKit, Vue/Nuxt, and advanced configuration options, see the [OpenTrack Client documentation](./apps/client/README.md).

### Using `analytics-node` (Segment SDK)

If you prefer to use Segment's official SDK, the `analytics-node` package can be used by pointing it to your OpenTrack deployment URL.

#### Installation

```bash
pnpm add analytics-node
```

#### Example

```javascript
import Analytics from 'analytics-node'

const analytics = new Analytics('', {
  host: 'https://your-opentrack-deployment.vercel.app',
})

// Identify a user
analytics.identify({
  userId: 'user-123',
  traits: {
    email: 'test@example.com',
    name: 'Test User',
    plan: 'premium',
  },
})

// Track a purchase event
analytics.track({
  userId: 'user-123',
  event: 'Product Purchased',
  properties: {
    productId: 'prod-456',
    price: 99.99,
    currency: 'USD',
  },
})

// Track a page view
analytics.page({
  userId: 'user-123',
  name: 'Pricing Page',
  properties: {
    url: 'https://your-app.com/pricing',
  },
})
```

### Direct API Calls

You can also send events directly to the API endpoints using `curl` or any other HTTP client.

```bash
curl -X POST https://your-opentrack-deployment.vercel.app/v1/track \
  -H 'Content-Type: application/json' \
  -d '{
        "userId": "user-123",
        "event": "Order Completed",
        "properties": { "revenue": 42.00 }
      }'
```

## Development

- **Run the development server**: `pnpm dev`
- **Run tests**: `pnpm test`
- **Lint code**: `pnpm lint`
- **Check types**: `pnpm typecheck`

## Contributing

Contributions are welcome! Please open an issue or submit a pull request if you have any ideas or improvements.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
