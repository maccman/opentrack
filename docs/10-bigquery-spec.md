# BigQuery Integration Specification

## Overview

This document describes how the Libroseg BigQuery integration stores data, following Segment's BigQuery warehouse schema conventions for compatibility and consistency.

## Dataset and Table Structure

### Dataset Naming

- Each source gets its own BigQuery dataset
- Dataset names follow the pattern: `<source_name>` (converted to snake_case)
- Example: A source named "Production Site" creates dataset `production_site`

### Table Structure

Libroseg creates separate tables for each type of Segment call:

| Table Name     | Purpose                   | Description                                          |
| -------------- | ------------------------- | ---------------------------------------------------- |
| `identifies`   | User identification calls | Stores all `identify()` calls with user traits       |
| `users`        | Latest user state         | Maintains current state of each user (latest traits) |
| `tracks`       | All track events          | Stores basic info for all `track()` calls            |
| `<event_name>` | Specific events           | Individual tables for each unique event type         |
| `pages`        | Page view calls           | Stores all `page()` calls with properties            |
| `groups`       | Group association calls   | Stores all `group()` calls with group traits         |
| `aliases`      | Identity merging calls    | Stores all `alias()` calls for identity resolution   |

## Schema Conventions

### Column Naming

- All column names use `snake_case` format
- Nested object properties are flattened with underscore separators
- Example: `context.device.type` becomes `context_device_type`

### Standard Columns

All tables include these standard Segment columns:

| Column         | Type      | Description                                        |
| -------------- | --------- | -------------------------------------------------- |
| `id`           | STRING    | Unique message ID for the event                    |
| `anonymous_id` | STRING    | Anonymous user identifier                          |
| `user_id`      | STRING    | Known user identifier (when available)             |
| `received_at`  | TIMESTAMP | When Segment received the event                    |
| `sent_at`      | TIMESTAMP | When the event was sent from client                |
| `timestamp`    | TIMESTAMP | Adjusted timestamp accounting for clock skew       |
| `context_*`    | VARIOUS   | Context fields (IP, user agent, device info, etc.) |
| `uuid_ts`      | TIMESTAMP | Processing timestamp for debugging                 |
| `loaded_at`    | TIMESTAMP | When data was loaded into BigQuery                 |

## Table-Specific Schemas

### `identifies` Table

Stores every `identify()` call with user traits as top-level columns.

**Key columns:**

- Standard columns (above)
- User traits as individual columns (e.g., `email`, `first_name`, `age`)

### `users` Table

Maintains the latest state for each user with upserts based on `user_id`.

**Key columns:**

- `id` (same as `user_id`)
- Latest user traits
- `received_at` (from most recent identify call)
- **Note:** No `anonymous_id` column (query `identifies` table for this)

### `tracks` Table

Stores basic information for all track events without custom properties.

**Key columns:**

- Standard columns
- `event` - Snake-cased event name for table reference
- `event_text` - Original event name as sent

### Event-Specific Tables (e.g., `order_completed`)

Each unique event gets its own table with all properties as columns.

**Key columns:**

- Standard columns
- `event` and `event_text`
- All event properties as individual columns

### `pages` Table

Stores page view events with page-specific properties.

**Key columns:**

- Standard columns
- `name` - Page name
- Page properties as individual columns (e.g., `url`, `title`, `referrer`)

### `groups` Table

Stores group association calls with group traits.

**Key columns:**

- Standard columns
- `group_id` - Group identifier
- Group traits as individual columns

### `aliases` Table

Stores identity merging calls.

**Key columns:**

- Standard columns
- `previous_id` - Previous user identifier being aliased

## Data Type Mapping

| Segment Type   | BigQuery Type | Notes                           |
| -------------- | ------------- | ------------------------------- |
| String         | STRING        | Default for text values         |
| Number         | FLOAT64       | For all numeric values          |
| Boolean        | BOOLEAN       | For true/false values           |
| Date/Timestamp | TIMESTAMP     | ISO 8601 format                 |
| Object         | STRING        | JSON-stringified nested objects |
| Array          | STRING        | JSON-stringified arrays         |

## Property Handling

### Nested Objects

Nested objects are flattened into column names:

```json
{
  "product": {
    "name": "iPhone",
    "category": "Electronics"
  }
}
```

Becomes columns: `product_name`, `product_category`

### Arrays

Arrays are stored as JSON strings:

```json
{
  "tags": ["mobile", "phone", "apple"]
}
```

Becomes column: `tags` with value `'["mobile", "phone", "apple"]'`

## Reserved Properties

These property names are reserved and automatically handled by Segment:

### Universal Reserved Names

- `id`, `anonymous_id`, `user_id`
- `received_at`, `sent_at`, `timestamp`
- `context_*` (all context fields)
- `uuid_ts`, `loaded_at`

### Call-Specific Reserved Names

- **Track**: `event`, `event_text`
- **Group**: `group_id`
- **Alias**: `previous_id`
- **Page**: `name`

## Example Schemas

### Sample `order_completed` Event Table

```sql
CREATE TABLE dataset.order_completed (
  id STRING,
  anonymous_id STRING,
  user_id STRING,
  received_at TIMESTAMP,
  sent_at TIMESTAMP,
  timestamp TIMESTAMP,
  context_ip STRING,
  context_user_agent STRING,
  event STRING,
  event_text STRING,
  order_id STRING,
  total FLOAT64,
  currency STRING,
  product_name STRING,
  product_category STRING,
  uuid_ts TIMESTAMP,
  loaded_at TIMESTAMP
);
```

### Sample `users` Table

```sql
CREATE TABLE dataset.users (
  id STRING,
  received_at TIMESTAMP,
  context_ip STRING,
  email STRING,
  first_name STRING,
  last_name STRING,
  age FLOAT64,
  uuid_ts TIMESTAMP
);
```

## Best Practices

1. **Table Names**: Use snake_case for all table and column names
2. **Event Names**: Convert event names to valid table names (snake_case, alphanumeric + underscore)
3. **Column Creation**: Only create columns when non-null values are present
4. **Data Types**: Infer from first non-null value received
5. **Nested Data**: Flatten objects, stringify arrays
6. **Reserved Names**: Never override Segment's reserved column names

## Compatibility Notes

This schema is designed to be compatible with:

- Segment's BigQuery destination
- Common BigQuery naming conventions
- Standard SQL querying patterns
- Business intelligence tools expecting Segment-style data
