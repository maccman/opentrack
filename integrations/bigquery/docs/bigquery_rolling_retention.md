# BigQuery rolling retention runbook

This runbook applies a rolling **13-calendar-month** retention period to raw OpenTrack events in the dedicated `opentrack_analytics` BigQuery dataset. It uses the versioned [`bigquery_rolling_retention_v1.sql`](bigquery_rolling_retention_v1.sql) script as a native BigQuery scheduled query.

The query deletes old rows from the existing unpartitioned tables. It does not expire or drop whole tables, add an OpenTrack API endpoint, or require an application or Vercel cron.

## Scope and safety model

- `received_at` is written by the OpenTrack integration, so clients cannot extend retention by supplying an old or future event timestamp.
- The cutoff is the execution time minus 13 calendar months in UTC. Rows exactly at the cutoff are retained; only rows with `received_at < retention_cutoff` are deleted.
- Historical tables do not consistently carry OpenTrack labels. The script therefore limits itself to `BASE TABLE`s in the dedicated dataset and requires exactly one `id STRING` column and one `received_at TIMESTAMP` column.
- Project, dataset, and table identifiers must match the conservative identifier formats used by the integration before they are interpolated into dynamic SQL.
- The script asserts that every base table matches the fingerprint. A schema surprise fails the run before any deletion rather than silently leaving a table outside retention.
- Each table is deleted independently, without an all-table transaction. A partial run is safe to retry because every `DELETE` is idempotent.

Production inventory validation on 2026-07-17 found that all 73 base tables matched the fingerprint. The script deliberately does not hardcode that count because OpenTrack creates new event-specific tables over time.

## Destination boundary

This policy covers raw events stored in BigQuery only. OpenTrack destinations fan out independently, so a successful BigQuery run does not delete data held by another provider.

Customer.io [stores raw profile activity data for 30 days](https://docs.customer.io/messaging/profiles/find/using-data-index/), although older event-derived state can still be used by features such as segmentation. Active profile traits are current profile state, not raw event history, and do not inherit that 30-day activity-history limit or this BigQuery 13-month policy. Manage profile traits and profile deletion through the Customer.io lifecycle separately.

## Prerequisites

1. Use a dedicated scheduled-query service account rather than a personal identity.
2. Grant only the permissions needed to list/read table metadata, create query jobs, and delete rows in `opentrack_analytics`.
3. Run the scheduled query in the same BigQuery location as the dataset.
4. Replace `YOUR_PROJECT_ID` in the versioned SQL. Keep `dataset_id` set to `opentrack_analytics` for production.

Do not remove the identifier, table-type, or schema assertions to make a failing run pass. Investigate the inventory difference first.

## Validate before the first production run

Run this read-only inventory query after replacing `YOUR_PROJECT_ID`:

```sql
WITH schema_fingerprints AS (
  SELECT
    table_name,
    COUNTIF(column_name = 'id' AND data_type = 'STRING') = 1
      AND COUNTIF(column_name = 'received_at' AND data_type = 'TIMESTAMP') = 1
      AND COUNTIF(column_name IN ('id', 'received_at')) = 2
      AS has_opentrack_fingerprint
  FROM `YOUR_PROJECT_ID.opentrack_analytics.INFORMATION_SCHEMA.COLUMNS`
  GROUP BY table_name
)
SELECT
  tables.table_name,
  tables.table_type,
  REGEXP_CONTAINS(tables.table_name, r'^[A-Za-z0-9_]+$') AS has_safe_identifier,
  COALESCE(schema_fingerprints.has_opentrack_fingerprint, FALSE)
    AS has_opentrack_fingerprint
FROM `YOUR_PROJECT_ID.opentrack_analytics.INFORMATION_SCHEMA.TABLES` AS tables
LEFT JOIN schema_fingerprints USING (table_name)
ORDER BY tables.table_type, tables.table_name;
```

Confirm all of the following:

- every physical table reports `BASE TABLE`, `has_safe_identifier = TRUE`, and `has_opentrack_fingerprint = TRUE`;
- views are visible in the inventory but are not retention targets;
- no unrelated physical tables have been added to this dedicated dataset;
- the calculated cutoff shown by the expression below matches the intended UTC instant.

```sql
SELECT TIMESTAMP(
  DATETIME_SUB(CURRENT_DATETIME('UTC'), INTERVAL 13 MONTH),
  'UTC'
) AS retention_cutoff_utc;
```

## Test in a scratch dataset

Before scheduling production, copy the script and point `dataset_id` at a scratch dataset with the same location. Create at least two fingerprint-matching tables and insert rows at:

- one second before the calculated cutoff;
- exactly the calculated cutoff;
- one second after the calculated cutoff;
- the current timestamp.

Run the copied script manually and verify that only the row before the cutoff is deleted from each table. Run it again and verify that it reports zero deleted rows.

Then add a base table missing one fingerprint column and verify that the script fails before deleting anything. A view without the fingerprint should not block a run because only base tables are mutation targets.

## Schedule and operate

1. Create a native BigQuery scheduled query from the reviewed versioned SQL. Do not configure a destination table.
2. Run it daily at a fixed UTC time. Daily execution keeps the active-query retention boundary within one schedule interval.
3. Use the same project, region, and service account validated in the manual run.
4. Run once manually, inspect every child `DELETE` job, and confirm the final per-table and total row counts.
5. Alert on failed or overdue transfer runs. If a run partially succeeds, fix the failing table or permission and rerun the same script; do not restore already-deleted rows.
6. Review bytes processed after the first run. These tables are unpartitioned, so each `DELETE` must scan the relevant timestamp column. Partition migration is a separate optimization, not part of this retention procedure.

Newly streamed rows are much newer than the 13-month cutoff and are not deletion candidates. If BigQuery nevertheless reports a streaming-buffer DML error, let the buffer drain and rerun rather than weakening the predicate.

## Recovery window and compliance wording

The scheduled query enforces 13 months of **active-query retention**. BigQuery can still recover deleted data during the dataset's configurable time-travel window (two to seven days), followed by a non-configurable seven-day fail-safe period. Account for that recovery-only window in internal deletion and retention documentation; do not claim that deleted bytes become physically unrecoverable immediately after the scheduled query.

See Google's documentation for [BigQuery time travel and fail-safe](https://cloud.google.com/bigquery/docs/time-travel) and [scheduled queries](https://cloud.google.com/bigquery/docs/scheduling-queries).
