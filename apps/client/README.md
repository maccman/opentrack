# Libroseg Analytics Client Library

A Segment-compatible client-side analytics library that integrates with Libroseg's v1 API endpoints. This library provides the same interface as Segment's Analytics.js but sends data to your own Libroseg instance.

## Features

- **Segment-Compatible API**: Drop-in replacement for Segment's Analytics.js
- **Browser Beacon API**: Uses `navigator.sendBeacon()` for reliable event delivery
- **Automatic Identity Management**: Persists user identity across sessions using localStorage
- **Event Queuing**: Automatic batching and flushing of events
- **TypeScript Support**: Full TypeScript definitions included
- **Modular Architecture**: Clean separation of concerns with utility modules
- **Configurable Storage**: Customizable localStorage keys and prefixes
- **Lightweight**: ~6KB minified and gzipped

## Development

```bash
# Install dependencies
pnpm install

# Build the analytics.js file
pnpm build

# Start development server (for testing)
pnpm dev
```

## Usage

### Basic Setup

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
  </head>
  <body>
    <!-- Load the analytics library -->
    <script src="path/to/analytics.js"></script>

    <script>
      // Initialize with your Libroseg instance
      analytics.load('your-write-key', {
        host: 'https://your-libroseg-instance.com',
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
  host: 'https://your-libroseg-instance.com', // Your Libroseg endpoint
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

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | `'http://localhost:3000'` | Your Libroseg instance URL |
| `writeKey` | string | `''` | Write key for authentication |
| `flushAt` | number | `20` | Number of events to queue before auto-flushing |
| `flushInterval` | number | `10000` | Time in milliseconds between auto-flushes |
| `debug` | boolean | `false` | Enable console logging for debugging |
| `storagePrefix` | string | `'analytics_'` | Prefix for localStorage keys |
| `userIdKey` | string | `'analytics_user_id'` | localStorage key for user ID |
| `anonymousIdKey` | string | `'analytics_anonymous_id'` | localStorage key for anonymous ID |
| `traitsKey` | string | `'analytics_traits'` | localStorage key for user traits |

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

## Demo

Open `demo.html` in your browser to see the library in action. The demo shows all available methods and includes debug output.

## Output

The build process generates `dist/analytics.js` from the TypeScript source in `src/analytics.ts`. The compiled library:

- Is bundled as an IIFE (Immediately Invoked Function Expression)
- Exposes a global `analytics` object
- Works in all modern browsers
- Automatically tracks an initial page view
- Flushes events on page unload

## Integration with Libroseg

This library sends events to the following Libroseg endpoints:

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
- **Configuration**: Centralized config management with intelligent defaults
