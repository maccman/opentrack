# OpenTrack Analytics

A Segment-compatible client-side analytics library for OpenTrack. This library provides the same interface as Segment's Analytics.js but sends data to your own OpenTrack instance.

## Features

- **Segment-Compatible API**: Drop-in replacement for Segment's Analytics.js
- **Universal Support**: Works in browser, Node.js, and SSR environments (Next.js, Astro, etc.)
- **Multiple Build Formats**: ESM, CommonJS, UMD, and IIFE builds included
- **TypeScript Support**: Full TypeScript definitions included
- **Browser Beacon API**: Uses `navigator.sendBeacon()` for reliable event delivery
- **Automatic Identity Management**: Persists user identity across sessions using localStorage
- **Event Queuing**: Automatic batching and flushing of events
- **Modular Architecture**: Clean separation of concerns with utility modules
- **Configurable Storage**: Customizable localStorage keys and prefixes
- **Cryptographically Secure**: Uses `crypto.getRandomValues()` for secure ID generation
- **Lightweight**: ~6KB minified and gzipped

## Installation

```bash
npm install opentrack-analytics
# or
yarn add opentrack-analytics
# or
pnpm add opentrack-analytics
```

## Usage

### Framework-Specific Setup

#### Next.js (App Router)

```typescript
// app/lib/analytics.ts
import analytics from 'opentrack-analytics'

analytics.load('your-write-key', {
  host: 'https://your-opentrack-instance.com',
  debug: process.env.NODE_ENV === 'development',
})

export default analytics

// app/components/Analytics.tsx
'use client'
import { useEffect } from 'react'
import analytics from '../lib/analytics'

export default function Analytics() {
  useEffect(() => {
    // Track page view
    analytics.page()
  }, [])

  return null
}

// app/layout.tsx
import Analytics from './components/Analytics'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

#### Next.js (Pages Router)

```typescript
// lib/analytics.ts
import analytics from 'opentrack-analytics'

analytics.load('your-write-key', {
  host: 'https://your-opentrack-instance.com',
  debug: process.env.NODE_ENV === 'development',
})

export default analytics

// pages/_app.tsx
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import analytics from '../lib/analytics'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      analytics.page()
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    return () => router.events.off('routeChangeComplete', handleRouteChange)
  }, [router.events])

  return <Component {...pageProps} />
}
```

#### Astro

```typescript
---
// src/components/Analytics.astro
---
<script>
  import analytics from 'opentrack-analytics'

  analytics.load('your-write-key', {
    host: 'https://your-opentrack-instance.com',
    debug: import.meta.env.DEV,
  })

  // Track page view
  analytics.page()
</script>

<!-- layouts/Layout.astro -->
---
import Analytics from '../components/Analytics.astro'
---
<html lang="en">
  <head>
    <!-- head content -->
  </head>
  <body>
    <slot />
    <Analytics />
  </body>
</html>
```

#### SvelteKit

```typescript
// src/lib/analytics.ts
import analytics from 'opentrack-analytics'

analytics.load('your-write-key', {
  host: 'https://your-opentrack-instance.com',
  debug: import.meta.env.DEV,
})

export default analytics

// src/app.html
<script>
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import analytics from '$lib/analytics'

  onMount(() => {
    analytics.page()
  })

  // Track route changes
  $: if ($page.url) {
    analytics.page()
  }
</script>
```

#### Vue.js / Nuxt.js

```typescript
// plugins/analytics.client.ts (Nuxt 3)
import analytics from 'opentrack-analytics'

export default defineNuxtPlugin(() => {
  analytics.load('your-write-key', {
    host: 'https://your-opentrack-instance.com',
    debug: process.dev,
  })

  // Track initial page
  analytics.page()

  return {
    provide: {
      analytics,
    },
  }
})

// composables/useAnalytics.ts
export const useAnalytics = () => {
  const { $analytics } = useNuxtApp()
  return $analytics
}
```

#### Server-Safe Usage

For server-side rendering, you can use the server-safe import:

```typescript
// This won't break in SSR environments
import analytics from 'opentrack-analytics/server'

// Or conditionally import
const analytics = process.browser ? await import('opentrack-analytics') : await import('opentrack-analytics/server')
```

#### Direct Browser Usage (Script Tag)

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
  </head>
  <body>
    <!-- Load the analytics library -->
    <script src="https://unpkg.com/opentrack-analytics@1.0.0/dist/analytics.iife.js"></script>

    <script>
      // Initialize with your OpenTrack instance
      analytics.load('your-write-key', {
        host: 'https://your-opentrack-instance.com',
        debug: false,
      })
    </script>
  </body>
</html>
```

### API Methods

#### Track Events

```javascript
analytics.track('Button Clicked', {
  buttonText: 'Get Started',
  location: 'homepage',
})
```

#### Identify Users

```javascript
analytics.identify('user-123', {
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  plan: 'premium',
})
```

#### Track Page Views

```javascript
// Auto-capture page properties
analytics.page()

// Named page with category
analytics.page('Marketing', 'Landing Page', {
  campaign: 'spring-sale',
})
```

#### Group Users

```javascript
analytics.group('company-456', {
  name: 'Acme Corp',
  industry: 'Technology',
  employees: 100,
})
```

#### Alias Users

```javascript
analytics.alias('user-123', 'anonymous-456')
```

### Configuration Options

```javascript
analytics.load('your-write-key', {
  host: 'https://your-opentrack-instance.com', // Your OpenTrack endpoint
  flushAt: 20, // Flush when queue reaches this size
  flushInterval: 10000, // Flush interval in milliseconds
  debug: false, // Enable debug logging

  // Storage configuration
  storagePrefix: 'analytics_', // Prefix for localStorage keys
  userIdKey: 'analytics_user_id', // Custom key for user ID storage
  anonymousIdKey: 'analytics_anonymous_id', // Custom key for anonymous ID storage
  traitsKey: 'analytics_traits', // Custom key for traits storage
})
```

#### Configuration Reference

| Option           | Type    | Default                    | Description                                    |
| ---------------- | ------- | -------------------------- | ---------------------------------------------- |
| `host`           | string  | `'/'`                      | Your OpenTrack instance URL                    |
| `writeKey`       | string  | `''`                       | Write key for authentication                   |
| `flushAt`        | number  | `20`                       | Number of events to queue before auto-flushing |
| `flushInterval`  | number  | `10000`                    | Time in milliseconds between auto-flushes      |
| `debug`          | boolean | `false`                    | Enable console logging for debugging           |
| `storagePrefix`  | string  | `'analytics_'`             | Prefix for localStorage keys                   |
| `userIdKey`      | string  | `'analytics_user_id'`      | localStorage key for user ID                   |
| `anonymousIdKey` | string  | `'analytics_anonymous_id'` | localStorage key for anonymous ID              |
| `traitsKey`      | string  | `'analytics_traits'`       | localStorage key for user traits               |

**Note:** If you provide a custom `storagePrefix`, the individual key names will be automatically updated unless explicitly overridden.

### Utility Methods

```javascript
// Get current user information
const user = analytics.user()
console.log(user.id()) // Current user ID
console.log(user.anonymousId()) // Anonymous ID
console.log(user.traits()) // User traits

// Reset user identity
analytics.reset()

// Manually flush events
analytics.flush()

// Wait for library to be ready
analytics.ready(() => {
  console.log('Analytics ready!')
})
```

## Package Entry Points

This package provides multiple entry points for different use cases:

### Main Entry Point

```typescript
import analytics from 'opentrack-analytics'
// Uses the browser implementation when available, falls back to server-safe version
```

### Browser-Specific Entry Point

```typescript
import analytics from 'opentrack-analytics/browser'
// Always uses the full browser implementation
```

### Server-Safe Entry Point

```typescript
import analytics from 'opentrack-analytics/server'
// No-op implementation safe for server-side rendering
```

## Build Outputs

The package includes multiple build formats:

- **ESM** (`*.esm.js`): For modern bundlers and ES module environments
- **CommonJS** (`*.cjs.js`): For Node.js and older bundlers
- **UMD** (`analytics.umd.js`): Universal module definition for browser usage
- **IIFE** (`analytics.iife.js`): For direct script tag usage, exposes `OpenTrackAnalytics` global

All builds include:

- Source maps for debugging
- Minification for production
- TypeScript declaration files (`.d.ts`)

## Demo

Open `demo.html` in your browser to see the library in action. The demo shows all available methods and includes debug output.

## Integration with OpenTrack

This library sends events to the following OpenTrack endpoints:

- `POST /v1/track` - For track events
- `POST /v1/identify` - For identify events
- `POST /v1/page` - For page events
- `POST /v1/group` - For group events
- `POST /v1/alias` - For alias events

All payloads are fully compatible with Segment's API specification.

## Architecture

The library is built with a modular architecture for maintainability and extensibility:

```
src/
├── analytics.ts          # Main Analytics class
├── types.ts              # TypeScript interface definitions
├── config.ts             # Configuration management
└── utils/
    ├── id-generator.ts   # UUID and message ID generation
    ├── storage.ts        # localStorage abstraction
    ├── context.ts        # Browser context building
    ├── transport.ts      # HTTP transport layer
    └── index.ts          # Utility exports
```

### Key Components

- **Analytics Class**: Main API interface and event management
- **Storage Module**: Handles all localStorage operations with configurable keys
- **Transport Module**: Manages HTTP requests with beacon API and fetch fallback
- **Context Builder**: Automatically captures browser and page information
- **ID Generator**: Cryptographically secure UUID generation with Math.random fallback
- **Configuration**: Centralized config management with intelligent defaults

## Development

### Local Development

```bash
# Install dependencies
pnpm install

# Build all formats
pnpm build

# Start development server (for testing)
pnpm dev
```

### Publishing

The package is ready for npm publication with:

- Proper `package.json` configuration with exports map
- Multiple build formats (ESM, CJS, UMD, IIFE)
- TypeScript declarations
- Server-safe implementations
- Framework compatibility

```bash
# Build for production
pnpm build

# Publish to npm
npm publish
```

## Framework Compatibility

✅ **Next.js** (App Router & Pages Router)  
✅ **Astro**  
✅ **SvelteKit**  
✅ **Nuxt.js**  
✅ **Vue.js**  
✅ **React** (Create React App, Vite)  
✅ **Angular**  
✅ **Vanilla JavaScript**  
✅ **Server-Side Rendering (SSR)**  
✅ **Static Site Generation (SSG)**

## License

MIT License - see [LICENSE](LICENSE) file for details.
