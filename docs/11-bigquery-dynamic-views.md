# BigQuery Dynamic Views

## Overview

Segment creates dynamic views in BigQuery that automatically adapt to schema changes while providing clean, queryable interfaces for analytics. These views abstract the complexity of Segment's raw data structure and provide business-friendly tables that evolve with your data.

## Core Concept

Dynamic views in BigQuery solve several key challenges:

- **Schema Evolution**: Automatically handle new properties and traits without breaking queries
- **Data Consolidation**: Merge multiple raw tables into unified business views
- **Performance Optimization**: Pre-aggregate common queries and patterns
- **Type Safety**: Ensure consistent data types across evolving schemas

## Segment's Table Structure

### Raw Tables Created by Segment

Segment creates several foundational tables in your BigQuery dataset:

| Table          | Purpose            | Content                          |
| -------------- | ------------------ | -------------------------------- |
| `identifies`   | All identify calls | User traits and identity linking |
| `tracks`       | All track calls    | Event data with common fields    |
| `pages`        | All page calls     | Page view data                   |
| `groups`       | All group calls    | Organization/account data        |
| `{event_name}` | Individual events  | Event-specific properties        |

### Dynamic Views Layer

On top of these raw tables, Segment creates dynamic views:

| View             | Purpose                  | Data Source                  |
| ---------------- | ------------------------ | ---------------------------- |
| `users`          | Latest user state        | Aggregated from `identifies` |
| `user_summary`   | User behavior metrics    | Aggregated from `tracks`     |
| `session_tracks` | Session-based event flow | Processed from `tracks`      |
| `event_flow`     | User journey analysis    | Cross-table aggregation      |

## Users Table Dynamic View

The `users` table is Segment's most important dynamic view, representing the latest state of each user.

### SQL Implementation Pattern

```sql
-- Segment's Users Dynamic View Pattern
CREATE OR REPLACE VIEW `project.dataset.users` AS (
  WITH latest_identifies AS (
    SELECT
      user_id,
      anonymous_id,
      received_at,
      sent_at,
      -- Flatten common traits
      JSON_EXTRACT_SCALAR(traits, '$.email') as email,
      JSON_EXTRACT_SCALAR(traits, '$.firstName') as first_name,
      JSON_EXTRACT_SCALAR(traits, '$.lastName') as last_name,
      JSON_EXTRACT_SCALAR(traits, '$.company') as company,
      JSON_EXTRACT_SCALAR(traits, '$.plan') as plan,
      JSON_EXTRACT_SCALAR(traits, '$.phone') as phone,

      -- Handle nested objects
      JSON_EXTRACT_SCALAR(traits, '$.address.city') as address_city,
      JSON_EXTRACT_SCALAR(traits, '$.address.state') as address_state,
      JSON_EXTRACT_SCALAR(traits, '$.address.country') as address_country,

      -- Convert types
      CAST(JSON_EXTRACT_SCALAR(traits, '$.age') AS INT64) as age,
      CAST(JSON_EXTRACT_SCALAR(traits, '$.logins') AS INT64) as logins,
      PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*S%Ez', JSON_EXTRACT_SCALAR(traits, '$.createdAt')) as created_at,

      -- Custom traits (add based on your schema)
      JSON_EXTRACT_SCALAR(traits, '$.signupSource') as signup_source,
      CAST(JSON_EXTRACT_SCALAR(traits, '$.isVip') AS BOOL) as is_vip,

      -- Row number for deduplication
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY received_at DESC
      ) as rn
    FROM `project.dataset.identifies`
    WHERE user_id IS NOT NULL
  ),

  user_activity AS (
    SELECT
      user_id,
      MIN(received_at) as first_seen,
      MAX(received_at) as last_seen,
      COUNT(*) as total_events,
      COUNT(DISTINCT event) as unique_events,
      COUNTIF(event = 'page_view') as page_views,
      COUNTIF(event = 'signup') as signups,
      COUNTIF(event LIKE '%purchase%') as purchases
    FROM `project.dataset.tracks`
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  )

  SELECT
    u.user_id,
    u.anonymous_id,
    u.email,
    u.first_name,
    u.last_name,
    u.company,
    u.plan,
    u.phone,
    u.address_city,
    u.address_state,
    u.address_country,
    u.age,
    u.logins,
    u.created_at,
    u.signup_source,
    u.is_vip,
    u.received_at as last_updated,

    -- Activity metrics
    a.first_seen,
    a.last_seen,
    a.total_events,
    a.unique_events,
    a.page_views,
    a.signups,
    a.purchases,

    -- Computed fields
    DATE_DIFF(CURRENT_DATE(), DATE(a.first_seen), DAY) as days_since_signup,
    DATE_DIFF(CURRENT_DATE(), DATE(a.last_seen), DAY) as days_since_last_activity,
    CASE
      WHEN DATE_DIFF(CURRENT_DATE(), DATE(a.last_seen), DAY) <= 7 THEN 'Active'
      WHEN DATE_DIFF(CURRENT_DATE(), DATE(a.last_seen), DAY) <= 30 THEN 'At Risk'
      ELSE 'Inactive'
    END as user_status

  FROM latest_identifies u
  LEFT JOIN user_activity a ON u.user_id = a.user_id
  WHERE u.rn = 1  -- Only latest state per user
)
```

## Schema Evolution Handling

### Dynamic Column Creation

Segment handles new properties by automatically expanding the view definition:

```sql
-- Schema evolution pattern
CREATE OR REPLACE VIEW `project.dataset.users` AS (
  SELECT
    user_id,
    -- Existing fields
    email,
    first_name,

    -- Dynamically detect and add new traits
    ${DYNAMIC_TRAITS_COLUMNS},

    -- Auto-generated timestamp
    _last_updated
  FROM (
    -- Subquery that discovers schema changes
    ${SCHEMA_DISCOVERY_QUERY}
  )
)
```

### Type Promotion Strategy

When data types conflict, Segment uses this promotion hierarchy:

1. **Boolean** → String
2. **Integer** → Float → String
3. **Date** → String
4. **Object** → JSON String
5. **Array** → JSON String

```sql
-- Type promotion example
SELECT
  user_id,
  -- Handle type conflicts gracefully
  CASE
    WHEN SAFE_CAST(JSON_EXTRACT_SCALAR(traits, '$.age') AS INT64) IS NOT NULL
    THEN CAST(JSON_EXTRACT_SCALAR(traits, '$.age') AS INT64)
    ELSE NULL
  END as age,

  -- Fallback to string for mixed types
  COALESCE(
    SAFE_CAST(JSON_EXTRACT_SCALAR(traits, '$.revenue') AS FLOAT64),
    SAFE_CAST(JSON_EXTRACT_SCALAR(traits, '$.revenue') AS STRING)
  ) as revenue
FROM identifies
```

## Event Tables Dynamic Views

### Individual Event Views

Each custom event gets its own optimized view:

```sql
-- Product Purchased event view
CREATE OR REPLACE VIEW `project.dataset.product_purchased` AS (
  SELECT
    user_id,
    anonymous_id,
    received_at,
    sent_at,

    -- Common event fields
    event,
    event_text,

    -- Event-specific properties (flattened)
    JSON_EXTRACT_SCALAR(properties, '$.productId') as product_id,
    JSON_EXTRACT_SCALAR(properties, '$.productName') as product_name,
    CAST(JSON_EXTRACT_SCALAR(properties, '$.price') AS FLOAT64) as price,
    JSON_EXTRACT_SCALAR(properties, '$.currency') as currency,
    CAST(JSON_EXTRACT_SCALAR(properties, '$.quantity') AS INT64) as quantity,
    JSON_EXTRACT_SCALAR(properties, '$.category') as category,

    -- Computed fields
    CAST(JSON_EXTRACT_SCALAR(properties, '$.price') AS FLOAT64) *
    CAST(JSON_EXTRACT_SCALAR(properties, '$.quantity') AS INT64) as total_value,

    -- Context fields (if needed)
    JSON_EXTRACT_SCALAR(context, '$.page.url') as page_url,
    JSON_EXTRACT_SCALAR(context, '$.campaign.source') as utm_source

  FROM `project.dataset.tracks`
  WHERE event = 'Product Purchased'
    AND received_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY) -- Optimize with partitioning
)
```

### Unified Events View

A consolidated view of all events with common patterns:

```sql
-- All events unified view
CREATE OR REPLACE VIEW `project.dataset.events_unified` AS (
  SELECT
    user_id,
    anonymous_id,
    event,
    received_at,

    -- Common properties across all events
    JSON_EXTRACT_SCALAR(properties, '$.revenue') as revenue,
    JSON_EXTRACT_SCALAR(properties, '$.currency') as currency,
    JSON_EXTRACT_SCALAR(properties, '$.category') as category,
    JSON_EXTRACT_SCALAR(properties, '$.source') as source,

    -- Event categorization
    CASE
      WHEN event IN ('Product Purchased', 'Order Completed') THEN 'Revenue'
      WHEN event IN ('Signup', 'Login') THEN 'Authentication'
      WHEN event IN ('Page Viewed', 'Screen Viewed') THEN 'Engagement'
      ELSE 'Other'
    END as event_category,

    -- Raw properties for flexibility
    properties as raw_properties,
    context as raw_context

  FROM `project.dataset.tracks`
  WHERE received_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
)
```

## Session Analysis Views

### Session Tracking

```sql
-- Session-based event tracking
CREATE OR REPLACE VIEW `project.dataset.session_events` AS (
  WITH session_boundaries AS (
    SELECT
      user_id,
      anonymous_id,
      event,
      received_at,
      properties,

      -- Session logic: new session if >30 minutes since last event
      SUM(CASE
        WHEN TIMESTAMP_DIFF(
          received_at,
          LAG(received_at) OVER (PARTITION BY COALESCE(user_id, anonymous_id) ORDER BY received_at),
          MINUTE
        ) > 30 OR LAG(received_at) OVER (PARTITION BY COALESCE(user_id, anonymous_id) ORDER BY received_at) IS NULL
        THEN 1
        ELSE 0
      END) OVER (
        PARTITION BY COALESCE(user_id, anonymous_id)
        ORDER BY received_at
        ROWS UNBOUNDED PRECEDING
      ) as session_id

    FROM `project.dataset.tracks`
    WHERE received_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  )

  SELECT
    user_id,
    anonymous_id,
    CONCAT(COALESCE(user_id, anonymous_id), '_', session_id) as session_key,
    session_id,
    event,
    received_at,
    properties,

    -- Session metrics
    MIN(received_at) OVER (PARTITION BY COALESCE(user_id, anonymous_id), session_id) as session_start,
    MAX(received_at) OVER (PARTITION BY COALESCE(user_id, anonymous_id), session_id) as session_end,
    COUNT(*) OVER (PARTITION BY COALESCE(user_id, anonymous_id), session_id) as session_event_count,

    -- Event sequence within session
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(user_id, anonymous_id), session_id
      ORDER BY received_at
    ) as event_sequence

  FROM session_boundaries
)
```

## Groups/Accounts Dynamic View

### B2B Account Aggregation

```sql
-- Companies/Accounts view
CREATE OR REPLACE VIEW `project.dataset.accounts` AS (
  WITH latest_groups AS (
    SELECT
      group_id,
      user_id,

      -- Company traits
      JSON_EXTRACT_SCALAR(traits, '$.name') as company_name,
      JSON_EXTRACT_SCALAR(traits, '$.industry') as industry,
      CAST(JSON_EXTRACT_SCALAR(traits, '$.employees') AS INT64) as employees,
      CAST(JSON_EXTRACT_SCALAR(traits, '$.revenue') AS FLOAT64) as revenue,
      JSON_EXTRACT_SCALAR(traits, '$.plan') as plan,
      JSON_EXTRACT_SCALAR(traits, '$.website') as website,

      -- Location
      JSON_EXTRACT_SCALAR(traits, '$.address.city') as city,
      JSON_EXTRACT_SCALAR(traits, '$.address.state') as state,
      JSON_EXTRACT_SCALAR(traits, '$.address.country') as country,

      received_at,
      ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY received_at DESC) as rn

    FROM `project.dataset.groups`
    WHERE group_id IS NOT NULL
  ),

  account_activity AS (
    SELECT
      JSON_EXTRACT_SCALAR(context, '$.groupId') as group_id,
      COUNT(*) as total_events,
      COUNT(DISTINCT user_id) as active_users,
      MIN(received_at) as first_activity,
      MAX(received_at) as last_activity,
      SUM(CASE WHEN event LIKE '%purchase%' THEN 1 ELSE 0 END) as purchase_events,
      SUM(CAST(JSON_EXTRACT_SCALAR(properties, '$.revenue') AS FLOAT64)) as total_revenue

    FROM `project.dataset.tracks`
    WHERE JSON_EXTRACT_SCALAR(context, '$.groupId') IS NOT NULL
    GROUP BY JSON_EXTRACT_SCALAR(context, '$.groupId')
  )

  SELECT
    g.group_id,
    g.company_name,
    g.industry,
    g.employees,
    g.revenue,
    g.plan,
    g.website,
    g.city,
    g.state,
    g.country,
    g.received_at as last_updated,

    -- Activity metrics
    COALESCE(a.active_users, 0) as active_users,
    COALESCE(a.total_events, 0) as total_events,
    a.first_activity,
    a.last_activity,
    COALESCE(a.purchase_events, 0) as purchase_events,
    COALESCE(a.total_revenue, 0) as total_revenue,

    -- Health metrics
    CASE
      WHEN a.last_activity > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY) THEN 'Active'
      WHEN a.last_activity > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) THEN 'At Risk'
      ELSE 'Inactive'
    END as account_status

  FROM latest_groups g
  LEFT JOIN account_activity a ON g.group_id = a.group_id
  WHERE g.rn = 1
)
```

## Implementation Best Practices

### 1. Materialized Views for Performance

```sql
-- Create materialized view for expensive computations
CREATE MATERIALIZED VIEW `project.dataset.users_materialized`
PARTITION BY DATE(last_seen)
CLUSTER BY user_status, plan
AS (
  SELECT * FROM `project.dataset.users`
  WHERE last_seen >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
)
```

### 2. Incremental Updates

```sql
-- Incremental refresh pattern
CREATE OR REPLACE TABLE `project.dataset.users_incremental` AS (
  SELECT * FROM `project.dataset.users`
  WHERE last_updated >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
)
```

### 3. Schema Change Detection

```sql
-- Monitor schema changes
CREATE OR REPLACE VIEW `project.dataset.schema_evolution` AS (
  SELECT
    'identifies' as table_name,
    JSON_EXTRACT_SCALAR(traits, '$') as trait_keys,
    COUNT(*) as occurrence_count,
    MIN(received_at) as first_seen,
    MAX(received_at) as last_seen
  FROM `project.dataset.identifies`,
  UNNEST(JSON_EXTRACT_ARRAY(JSON_KEYS(traits))) as trait_key
  GROUP BY trait_key

  UNION ALL

  SELECT
    'tracks' as table_name,
    JSON_EXTRACT_SCALAR(properties, '$') as property_keys,
    COUNT(*) as occurrence_count,
    MIN(received_at) as first_seen,
    MAX(received_at) as last_seen
  FROM `project.dataset.tracks`,
  UNNEST(JSON_EXTRACT_ARRAY(JSON_KEYS(properties))) as property_key
  GROUP BY property_key
)
```

## Maintenance and Monitoring

### View Refresh Strategy

1. **Real-time Views**: Use standard views for up-to-date data
2. **Batch Views**: Use materialized views for performance
3. **Scheduled Refresh**: Update materialized views on schedule
4. **Change Detection**: Monitor for schema changes

### Performance Optimization

```sql
-- Optimize with proper partitioning and clustering
CREATE MATERIALIZED VIEW `project.dataset.events_optimized`
PARTITION BY DATE(received_at)
CLUSTER BY user_id, event
AS (
  SELECT
    user_id,
    event,
    received_at,
    properties,
    DATE(received_at) as event_date
  FROM `project.dataset.tracks`
  WHERE received_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
)
```

### Monitoring Queries

```sql
-- Monitor view performance
SELECT
  view_name,
  creation_time,
  last_modified_time,
  row_count,
  size_bytes
FROM `project.dataset.INFORMATION_SCHEMA.TABLES`
WHERE table_type = 'VIEW'
ORDER BY last_modified_time DESC
```

## Common Query Patterns

### User Segmentation

```sql
-- Segment users by behavior
SELECT
  user_status,
  plan,
  COUNT(*) as user_count,
  AVG(total_events) as avg_events,
  AVG(days_since_signup) as avg_tenure
FROM `project.dataset.users`
GROUP BY user_status, plan
ORDER BY user_count DESC
```

### Revenue Attribution

```sql
-- Revenue by user segments
SELECT
  u.plan,
  u.signup_source,
  COUNT(DISTINCT u.user_id) as users,
  SUM(p.total_value) as total_revenue,
  AVG(p.total_value) as avg_order_value
FROM `project.dataset.users` u
JOIN `project.dataset.product_purchased` p ON u.user_id = p.user_id
GROUP BY u.plan, u.signup_source
ORDER BY total_revenue DESC
```

### Funnel Analysis

```sql
-- User journey funnel
WITH funnel_steps AS (
  SELECT
    user_id,
    MAX(CASE WHEN event = 'Signup' THEN 1 ELSE 0 END) as step_1_signup,
    MAX(CASE WHEN event = 'Profile Completed' THEN 1 ELSE 0 END) as step_2_profile,
    MAX(CASE WHEN event = 'First Purchase' THEN 1 ELSE 0 END) as step_3_purchase
  FROM `project.dataset.events_unified`
  GROUP BY user_id
)

SELECT
  SUM(step_1_signup) as signups,
  SUM(step_2_profile) as profiles_completed,
  SUM(step_3_purchase) as first_purchases,

  -- Conversion rates
  SAFE_DIVIDE(SUM(step_2_profile), SUM(step_1_signup)) as signup_to_profile,
  SAFE_DIVIDE(SUM(step_3_purchase), SUM(step_2_profile)) as profile_to_purchase
FROM funnel_steps
```

## Next Steps

- Review [BigQuery Spec](./10-bigquery-spec.md) for detailed schema information
- Explore [Data Model](./09-data-model.md) for relationship understanding
- Check [Common Fields](./08-common-fields.md) for payload structure details

## References

- [BigQuery Dynamic SQL Patterns](https://cloud.google.com/bigquery/docs/dynamic-sql)
- [Segment Schema Evolution](https://segment.com/docs/connections/storage/warehouses/schema/)
- [BigQuery Materialized Views](https://cloud.google.com/bigquery/docs/materialized-views-intro)
