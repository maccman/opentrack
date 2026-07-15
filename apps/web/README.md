# OpenTrack Web API

A Nitro-based web API for the OpenTrack analytics platform.

Look at the [nitro quick start](https://nitro.unjs.io/guide#quick-start) to learn more how to get started.

## CORS Configuration

The API includes built-in CORS (Cross-Origin Resource Sharing) support optimized for analytics endpoints.
Only public `/v1/*` ingestion routes receive these browser CORS headers; internal server-to-server routes do not.

## Privacy Erasure

Set `OPENTRACK_SECRET` to a server-only credential with no whitespace that differs from the browser-visible
`WRITE_KEY`. When BigQuery and Customer.io are both configured and no unsupported destination is enabled,
`POST /internal/v1/privacy/erase` accepts a strict `{"userId":"<UUID>"}` JSON body and deletes the data currently
associated with that identifier. Erasure additionally requires `CUSTOMERIO_ANONYMOUS_EVENT_MERGE_ENABLED=true` after
an operator verifies that **Settings > Workspace Settings > Merge Options > Anonymous event merge** is enabled in
Customer.io. That setting lets Customer.io associate recent anonymous activity with the person deleted by this endpoint.

Before calling the endpoint, stop new analytics for the subject and allow already accepted or in-flight ingestion to
finish. Ingestion dispatches destination writes asynchronously and does not coordinate them with erasure. The endpoint
keeps no tombstone or suppression state, so events that arrive later require another erasure request. Customer.io uses
delete rather than suppression: the current person is removed, but later analytics can recreate the identifier.
BigQuery deletes the requested `user_id`, directly observed anonymous activity for that root, and alias records that
refer directly to the requested ID. Browser-supplied `previous_id` values are not promoted into additional user roots;
call the endpoint once for every historical user ID known by a trusted source. Each mutation batch is atomic, and
canonical identity tables are kept as retry anchors until the final batch. A `200` response means every BigQuery batch
committed and Customer.io accepted its deletion; a `202` response means streamed BigQuery rows still require a later
retry.

### Environment Variables

| Variable               | Description                             | Default           | Example                                             |
| ---------------------- | --------------------------------------- | ----------------- | --------------------------------------------------- |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins | `*` (all origins) | `https://app.example.com,https://admin.example.com` |

### Fixed Configuration

The following CORS settings are optimized for analytics and cannot be changed:

- **Methods**: `POST, OPTIONS` (analytics endpoints + preflight)
- **Headers**: `Content-Type, Authorization` (standard analytics headers)
- **Max Age**: `86400` seconds (24 hours for preflight caching)

### Usage Examples

#### Allow all origins (default)

```bash
# No configuration needed - this is the default
# CORS_ALLOWED_ORIGINS="*"
```

#### Allow specific domains

```bash
CORS_ALLOWED_ORIGINS="https://myapp.com,https://admin.myapp.com"
```

#### Development setup

```bash
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000"
```

#### Production setup

```bash
CORS_ALLOWED_ORIGINS="https://myapp.com"
```

### Development Notes

- In development mode, localhost origins are automatically allowed even if not explicitly configured
- The middleware automatically handles preflight OPTIONS requests
- CORS headers are applied automatically only to public `/v1/*` ingestion routes
