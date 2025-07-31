# Web App Integration Tests

This directory contains integration tests for the Libroseg web application using the official Segment Node.js package.

## Overview

The integration tests demonstrate that the Libroseg web server is fully compatible with the Segment ecosystem by:

1. **Using the official Segment analytics-node package** - The same package that developers use to send analytics data to Segment.com
2. **Testing all analytics endpoints** - Covers track, identify, page, group, and alias events
3. **Validating payload handling** - Ensures proper validation and error handling
4. **Supporting batch operations** - Implements the `/v1/batch` endpoint for compatibility with Segment's batching

## Test Structure

### Key Features Tested

- **Segment Analytics Node Package Integration**: Uses `analytics-node@6.2.0` configured to send data to localhost instead of segment.com
- **All Event Types**: Tests all five core Segment events (track, identify, page, group, alias)
- **Batch Endpoint**: Tests the `/v1/batch` endpoint that handles multiple events in a single request
- **Error Handling**: Validates that invalid payloads are properly rejected
- **Direct API Testing**: Also tests endpoints directly using HTTP requests

### Test Setup

The tests use:

- **nitro-test-utils**: For automatic Nitro server setup and management
- **vitest**: As the testing framework
- **analytics-node**: The official Segment Node.js client library

### Configuration

The analytics client is configured to:

- Send data to `http://localhost:3000` (test server)
- Flush immediately (`flushAt: 1`) for deterministic testing
- Use a short flush interval for fast test execution

## Running Tests

```bash
# Run integration tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Implementation Details

### Batch Endpoint

The `/v1/batch` endpoint was implemented to provide full compatibility with the Segment API. This endpoint:

- Accepts arrays of events in a single request
- Validates each event according to its type
- Processes valid events and reports errors for invalid ones
- Returns detailed success/error information

### Event Processing

Each event type is validated using the project's Zod schemas and then processed through the `IntegrationManager` system, ensuring consistency with the rest of the application.

## Significance

These tests prove that Libroseg can serve as a drop-in replacement for Segment's HTTP API, allowing existing applications using the Segment Node.js package to switch to Libroseg with minimal configuration changes.
