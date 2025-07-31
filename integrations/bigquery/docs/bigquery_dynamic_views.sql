-- ====================================================================
-- Libroseg BigQuery Dynamic Views
-- ====================================================================
-- This script creates a set of dynamic views on top of the raw data
-- ingested by the Libroseg BigQuery integration. These views provide a
-- clean, analytics-ready layer for your data.
--
-- Instructions:
-- 1. Replace `your-project-id` with your Google Cloud Project ID.
-- 2. Replace `your-dataset-id` with the BigQuery dataset name for your source.
-- 3. Run this script in your BigQuery console.
-- ====================================================================


-- ====================================================================
-- View 1: users
-- Purpose: Provides the latest state for each user, combining identity
--          information with aggregated activity metrics.
-- ====================================================================
CREATE OR REPLACE VIEW `your-project-id.your-dataset-id.users` AS
WITH
  latest_identifies AS (
    -- Get the most recent identify call for each user to have the latest traits
    SELECT
      *,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY received_at DESC) AS rn
    FROM
      `your-project-id.your-dataset-id.identifies`
    WHERE
      user_id IS NOT NULL
  ),
  user_activity AS (
    -- Aggregate key activity metrics for each user from the tracks table
    SELECT
      user_id,
      MIN(received_at) AS first_seen,
      MAX(received_at) AS last_seen,
      COUNT(*) AS total_events,
      COUNT(DISTINCT event) AS unique_events,
      COUNTIF(event = 'page_viewed') AS page_views,
      COUNTIF(event = 'user_signed_up') AS signups,
      COUNTIF(event LIKE '%purchase%') AS purchases
    FROM
      `your-project-id.your-dataset-id.tracks`
    WHERE
      user_id IS NOT NULL
    GROUP BY
      user_id
  )
SELECT
  -- Select all columns from the latest identify call (e.g., email, first_name, etc.)
  identifies.* EXCEPT (rn),
  -- Join in aggregated activity data
  activity.first_seen,
  activity.last_seen,
  activity.total_events,
  activity.unique_events,
  activity.page_views,
  activity.signups,
  activity.purchases,
  -- Compute useful user-level metrics
  DATE_DIFF(CURRENT_DATE(), DATE(activity.first_seen), DAY) AS days_since_signup,
  DATE_DIFF(CURRENT_DATE(), DATE(activity.last_seen), DAY) AS days_since_last_activity,
  CASE
    WHEN DATE_DIFF(CURRENT_DATE(), DATE(activity.last_seen), DAY) <= 7 THEN 'Active'
    WHEN DATE_DIFF(CURRENT_DATE(), DATE(activity.last_seen), DAY) <= 30 THEN 'At Risk'
    ELSE 'Inactive'
  END AS user_status
FROM
  latest_identifies AS identifies
  LEFT JOIN user_activity AS activity ON identifies.user_id = activity.user_id
WHERE
  identifies.rn = 1;


-- ====================================================================
-- View 2: accounts
-- Purpose: Provides the latest state for each account/group, combining
--          group traits with aggregated activity from its users.
-- ====================================================================
CREATE OR REPLACE VIEW `your-project-id.your-dataset-id.accounts` AS
WITH
  latest_groups AS (
    -- Get the most recent group call for each group to have the latest traits
    SELECT
      *,
      ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY received_at DESC) AS rn
    FROM
      `your-project-id.your-dataset-id.groups`
    WHERE
      group_id IS NOT NULL
  ),
  account_activity AS (
    -- Aggregate activity metrics for each account from the tracks table
    SELECT
      context_group_id AS group_id,
      COUNT(*) AS total_events,
      COUNT(DISTINCT user_id) AS active_users,
      MIN(received_at) AS first_activity,
      MAX(received_at) AS last_activity,
      SUM(CASE WHEN event LIKE '%purchase%' THEN 1 ELSE 0 END) AS purchase_events
    FROM
      `your-project-id.your-dataset-id.tracks`
    WHERE
      context_group_id IS NOT NULL
    GROUP BY
      context_group_id
  )
SELECT
  -- Select all columns from the latest group call (e.g., name, industry, etc.)
  groups.* EXCEPT (rn),
  -- Join in aggregated activity data
  activity.total_events,
  activity.active_users,
  activity.first_activity,
  activity.last_activity,
  activity.purchase_events,
  -- Compute useful account-level metrics
  CASE
    WHEN activity.last_activity > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY) THEN 'Active'
    WHEN activity.last_activity > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) THEN 'At Risk'
    ELSE 'Inactive'
  END AS account_status
FROM
  latest_groups AS groups
  LEFT JOIN account_activity AS activity ON groups.group_id = activity.group_id
WHERE
  groups.rn = 1;


-- ====================================================================
-- View 3: session_events
-- Purpose: Enriches track events with session information, allowing for
--          analysis of user journeys and behavior within a session.
-- ====================================================================
CREATE OR REPLACE VIEW `your-project-id.your-dataset-id.session_events` AS
WITH
  session_boundaries AS (
    SELECT
      *,
      -- A new session is started if the time since the last event is > 30 minutes
      SUM(
        CASE
          WHEN TIMESTAMP_DIFF(
            received_at,
            LAG(received_at) OVER (PARTITION BY COALESCE(user_id, anonymous_id) ORDER BY received_at),
            MINUTE
          ) > 30
          OR LAG(received_at) OVER (PARTITION BY COALESCE(user_id, anonymous_id) ORDER BY received_at) IS NULL THEN 1
          ELSE 0
        END
      ) OVER (PARTITION BY COALESCE(user_id, anonymous_id) ORDER BY received_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS session_id
    FROM
      `your-project-id.your-dataset-id.tracks`
  )
SELECT
  *,
  -- Create a globally unique key for each session
  CONCAT(COALESCE(user_id, anonymous_id), '_', CAST(session_id AS STRING)) AS session_key,
  -- Add session-level metrics
  MIN(received_at) OVER (PARTITION BY COALESCE(user_id, anonymous_id), session_id) AS session_start,
  MAX(received_at) OVER (PARTITION BY COALESCE(user_id, anonymous_id), session_id) AS session_end,
  COUNT(*) OVER (PARTITION BY COALESCE(user_id, anonymous_id), session_id) AS session_event_count,
  -- Add event sequence number within the session
  ROW_NUMBER() OVER (PARTITION BY COALESCE(user_id, anonymous_id), session_id ORDER BY received_at) AS event_sequence
FROM
  session_boundaries;


-- ====================================================================
-- View 4: events_unified
-- Purpose: A simplified view of all track events with a standardized
--          category for easier high-level analysis.
-- NOTE: You may need to adjust the common properties (revenue, etc.)
--       if your events do not contain them, or the view creation will fail.
-- ====================================================================
CREATE OR REPLACE VIEW `your-project-id.your-dataset-id.events_unified` AS
SELECT
  user_id,
  anonymous_id,
  event,
  event_text,
  received_at,
  -- Add common properties you expect across many events.
  -- These will be NULL if the event doesn't have them.
  -- Example properties:
  -- revenue,
  -- currency,
  -- category,
  -- source,

  -- Categorize events for easier filtering and aggregation
  CASE
    WHEN event IN ('product_purchased', 'order_completed', 'subscription_started') THEN 'Revenue'
    WHEN event IN ('user_signed_up', 'user_logged_in') THEN 'Authentication'
    WHEN event IN ('page_viewed', 'screen_viewed', 'video_played') THEN 'Engagement'
    ELSE 'Other'
  END AS event_category
FROM
  `your-project-id.your-dataset-id.tracks`;
