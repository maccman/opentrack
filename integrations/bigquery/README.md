# BigQuery Integration for OpenTrack

This package provides a BigQuery integration for OpenTrack, designed to replicate Segment's BigQuery destination behavior. It handles sending analytics events to BigQuery, with robust support for automatic table and schema management.

## Features

- **Segment-Compatible Schema**: Creates tables and columns that match Segment's conventions, making it compatible with existing queries and BI tools.
- **Automatic Table & Schema Management**: Automatically creates datasets and tables, adds columns for new properties, and relaxes data types as needed. This feature can be disabled for manual management.
- **Type Inference**: Intelligently detects data types from your event payloads and maps them to appropriate BigQuery types (e.g., `INTEGER`, `FLOAT`, `TIMESTAMP`, `STRING`).
- **High Performance**: Caches schemas in memory to minimize API calls to BigQuery.

For a detailed specification of the schema, tables, and data handling, please see the [BigQuery Spec Documentation](../../docs/10-bigquery-spec.md).

## Setup and Configuration

To use the BigQuery integration, you need to configure the following environment variables.

### Required Variables

- `BIGQUERY_PROJECT_ID`: Your Google Cloud Project ID.
- `BIGQUERY_DATASET`: The BigQuery dataset where your data will be stored.

### Authentication Variables

Choose one of the following authentication methods:

- **`GOOGLE_APPLICATION_CREDENTIALS`**: Path to your service account key JSON file (recommended for file-based auth).
- **`GOOGLE_APPLICATION_CREDENTIALS_JSON`**: The complete service account key JSON as a string (recommended for containerized deployments).

If neither is set, the client will use Google Cloud's default credentials (works automatically on GCP services like Cloud Run, GKE, etc.).

#### Authentication Examples

**Option 1: Using a service account key file**

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
export BIGQUERY_PROJECT_ID="your-project-id"
export BIGQUERY_DATASET="your_dataset"
```

**Option 2: Using JSON credentials as environment variable (recommended for containers)**

```bash
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"...","client_email":"your-service@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}'
export BIGQUERY_PROJECT_ID="your-project-id"
export BIGQUERY_DATASET="your_dataset"
```

**Option 3: Using default credentials (for GCP services)**

```bash
# No authentication variables needed - uses default service account
export BIGQUERY_PROJECT_ID="your-project-id"
export BIGQUERY_DATASET="your_dataset"
```

### Optional Variables

- `BIGQUERY_AUTO_TABLE_MANAGEMENT`: Controls the automatic schema and table handling.
  - **`true`** (default): The integration will automatically create and update tables and schemas. This is the recommended setting for ease of use.
  - **`false`**: Disables automatic management. You will be responsible for creating and maintaining the tables and schemas manually. If a table is not correctly configured, data insertion will fail.

### Creating a Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** > **Service Accounts**
3. Click **Create Service Account**
4. Give it a name (e.g., "opentrack-bigquery")
5. Assign the required roles (see below)
6. Click **Create Key** and download the JSON file
7. Use the JSON file path or content as described in the authentication examples above

### Service Account Permissions

Ensure your Google Cloud service account has the following roles for the integration to function correctly, especially with auto-management enabled:

- **BigQuery Data Editor**: To create/modify tables and insert data.
- **BigQuery Job User**: To run queries and jobs.
- **BigQuery User**: To access datasets.

## Dynamic SQL Views for Analytics

To help you get started with analyzing your data, we provide a set of pre-built SQL views that create an analytics-ready layer on top of your raw data. These views handle common transformations like sessionization and user state management.

You can find the script to create these views in `integrations/bigquery/docs/bigquery_dynamic_views.sql`. Simply run this script in your BigQuery console after replacing the placeholder project and dataset IDs.
