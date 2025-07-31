# Segment API Engineering Specification

This documentation provides a comprehensive engineering specification for Segment's Customer Data Platform APIs, based on analysis of Segment's official documentation and API specifications.

## Table of Contents

- [Overview](./01-overview.md) - Architecture, concepts, and data flow
- [API Endpoints](./02-api-endpoints.md) - HTTP API endpoints, authentication, and rate limits
- [Track Method](./03-track.md) - Event tracking specification
- [Identify Method](./04-identify.md) - User identification specification
- [Page Method](./05-page.md) - Page view tracking specification
- [Group Method](./06-group.md) - Group association specification
- [Alias Method](./07-alias.md) - User identity merging specification
- [Common Fields](./08-common-fields.md) - Shared fields, data types, and reserved properties
- [Data Model](./09-data-model.md) - Complete data model and relationships

## Quick Reference

### Core Methods

| Method     | Purpose                      | Endpoint            |
| ---------- | ---------------------------- | ------------------- |
| `track`    | Record user actions/events   | `POST /v1/track`    |
| `identify` | Set user traits and identity | `POST /v1/identify` |
| `page`     | Record page views            | `POST /v1/page`     |
| `group`    | Associate user with groups   | `POST /v1/group`    |
| `alias`    | Merge user identities        | `POST /v1/alias`    |

### Base URLs

- **US/Global**: `https://api.segment.io`
- **EU**: `https://api.segment.eu`

### Authentication

All requests require a Write Key in the Authorization header:

```
Authorization: Basic {base64(writeKey:)}
```

## Implementation Principles

1. **Event-Driven Architecture**: All interactions are captured as discrete events
2. **Schema Flexibility**: JSON payloads with flexible schema support
3. **Identity Resolution**: Robust system for tracking users across sessions and devices
4. **Real-time Processing**: Low-latency ingestion with immediate downstream delivery
5. **Compliance Ready**: Built-in privacy controls and data governance

## Getting Started

1. Review the [Overview](./01-overview.md) to understand core concepts
2. Set up authentication using your Write Key
3. Implement the [Track method](./03-track.md) for event collection
4. Add [Identify method](./04-identify.md) for user identification
5. Extend with additional methods as needed

---

_This specification is based on Segment's public API documentation as of January 2025_
