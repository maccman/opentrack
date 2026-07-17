-- ============================================================================
-- OpenTrack BigQuery rolling retention (version 1)
--
-- Deletes rows whose server-written received_at timestamp is older than 13
-- calendar months in UTC. Run this as a native BigQuery scheduled query.
--
-- Before use, replace YOUR_PROJECT_ID. The dedicated dataset is intentionally
-- fixed to opentrack_analytics; see bigquery_rolling_retention.md for validation,
-- testing, scheduling, and recovery-window guidance.
-- ============================================================================

DECLARE project_id STRING DEFAULT 'YOUR_PROJECT_ID';
DECLARE dataset_id STRING DEFAULT 'opentrack_analytics';
DECLARE retention_cutoff TIMESTAMP DEFAULT TIMESTAMP(
  DATETIME_SUB(CURRENT_DATETIME('UTC'), INTERVAL 13 MONTH),
  'UTC'
);
DECLARE rows_deleted INT64;

-- These are the same conservative identifier shapes accepted by the OpenTrack
-- BigQuery integration. Identifiers are interpolated only after validation.
ASSERT REGEXP_CONTAINS(project_id, r'^[a-z][0-9a-z-]{4,61}[0-9a-z]$')
AS 'Replace YOUR_PROJECT_ID with a valid Google Cloud project ID';
ASSERT REGEXP_CONTAINS(dataset_id, r'^[A-Za-z0-9_]+$')
AS 'Invalid BigQuery dataset identifier';

-- Historical OpenTrack tables do not consistently have labels. The dedicated
-- dataset boundary plus the exact id/received_at type fingerprint identifies the
-- physical tables this script may mutate.
EXECUTE IMMEDIATE FORMAT(
  """
  CREATE TEMP TABLE retention_inventory AS
  WITH schema_fingerprints AS (
    SELECT
      table_name,
      COUNTIF(column_name = 'id' AND data_type = 'STRING') = 1
        AND COUNTIF(column_name = 'received_at' AND data_type = 'TIMESTAMP') = 1
        AND COUNTIF(column_name IN ('id', 'received_at')) = 2
        AS has_opentrack_fingerprint
    FROM `%s.%s.INFORMATION_SCHEMA.COLUMNS`
    GROUP BY table_name
  )
  SELECT
    tables.table_name,
    REGEXP_CONTAINS(tables.table_name, r'^[A-Za-z0-9_]+$') AS has_safe_identifier,
    COALESCE(schema_fingerprints.has_opentrack_fingerprint, FALSE)
      AS has_opentrack_fingerprint
  FROM `%s.%s.INFORMATION_SCHEMA.TABLES` AS tables
  LEFT JOIN schema_fingerprints USING (table_name)
  WHERE tables.table_type = 'BASE TABLE'
  """,
  project_id,
  dataset_id,
  project_id,
  dataset_id
);

-- The dataset is dedicated to OpenTrack. A new or malformed base table should
-- fail the entire run visibly instead of being skipped and retained forever.
ASSERT (SELECT COUNT(*) FROM retention_inventory) > 0
AS 'No base tables found in the retention dataset';
ASSERT (SELECT COUNTIF(NOT has_safe_identifier) FROM retention_inventory) = 0
AS 'A base table has an unsafe identifier; no rows were deleted';
ASSERT (SELECT COUNTIF(NOT has_opentrack_fingerprint) FROM retention_inventory) = 0
AS 'A base table does not match the OpenTrack schema fingerprint; no rows were deleted';

CREATE TEMP TABLE retention_results (
  table_name STRING,
  rows_deleted INT64
);

-- There is deliberately no transaction spanning all tables. Each DELETE is
-- idempotent and commits independently, so rerunning after partial failure is safe.
FOR target IN (
  SELECT table_name
  FROM retention_inventory
  ORDER BY table_name
)
DO
  EXECUTE IMMEDIATE FORMAT(
    'DELETE FROM `%s.%s.%s` WHERE received_at < @retention_cutoff',
    project_id,
    dataset_id,
    target.table_name
  )
  USING retention_cutoff AS retention_cutoff;

  SET rows_deleted = @@row_count;
  INSERT INTO retention_results (table_name, rows_deleted)
  VALUES (target.table_name, rows_deleted);
END FOR;

-- The query returns per-table counts; the child query jobs remain available for
-- scheduled-run auditing.
SELECT
  retention_cutoff AS retention_cutoff_utc,
  table_name,
  rows_deleted,
  SUM(rows_deleted) OVER () AS total_rows_deleted
FROM retention_results
ORDER BY table_name;
