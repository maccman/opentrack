# BigQuery Integration Specification

## Overview

This document describes how the OpenTrack BigQuery integration stores data, following Segment's BigQuery warehouse schema conventions for compatibility and consistency.

The integration supports **optional automatic table and schema management**. When enabled, you don't need to manually create tables or manage schema changes.

## Automatic Table and Schema Management

This feature is **enabled by default**. To disable it, set the following environment variable:

```bash
BIGQUERY_AUTO_TABLE_MANAGEMENT=false
```

### Key Features (When Enabled)

1.  **Dataset Creation**: Creates the dataset if it doesn't exist.
2.  **Table Creation**: Creates tables on first data insertion with an appropriate base schema.
3.  **Schema Evolution**: Adds new columns when new properties are discovered.
4.  **Type Relaxation**: Automatically widens column types when needed (e.g., INTEGER → FLOAT → STRING).
5.  **Caching**: Caches table schemas in memory for 5 minutes to reduce BigQuery API calls.

### Behavior When Disabled

If `BIGQUERY_AUTO_TABLE_MANAGEMENT` is set to `false`:

- The integration will attempt to insert data directly into pre-existing tables.
- **Tables and schemas must be created and managed manually.**
- If a table or column does not exist, the insertion will fail, and BigQuery will return an error.

## Dataset and Table Structure

### Dataset Naming

- Each source gets its own BigQuery dataset.
- Dataset names follow the pattern: `<source_name>` (converted to snake_case).
- Example: A source named "Production Site" creates dataset `production_site`.

### Table Structure

OpenTrack creates separate tables for each type of Segment call:

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

- All column names use `snake_case` format.
- Nested object properties are flattened with underscore separators.
- Example: `context.device.type` becomes `context_device_type`.

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

## Best Practices

1.  **Table Names**: Use snake_case for all table and column names.
2.  **Event Names**: Convert event names to valid table names (snake_case, alphanumeric + underscore).
3.  **Data Types**: Infer from the first non-null value received.
4.  **Nested Data**: Flatten objects, stringify arrays.
5.  **Reserved Names**: Never override Segment's reserved column names.
6.  **Auto-Management**: For ease of use, it is recommended to keep auto-management enabled.

## Compatibility Notes

This schema is designed to be compatible with:

- Segment's BigQuery destination
- Common BigQuery naming conventions
- Standard SQL querying patterns
- Business intelligence tools expecting Segment-style data
