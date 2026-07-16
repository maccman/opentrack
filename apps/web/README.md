# OpenTrack Web API

A Nitro-based web API for the OpenTrack analytics platform.

Look at the [nitro quick start](https://nitro.unjs.io/guide#quick-start) to learn more how to get started.

## Internal Regulations API

`POST /internal/v1/regulations` executes a Segment-style `DELETE_ONLY` regulation against every
configured destination (see the root README for the full contract and caveats). It is a
server-to-server endpoint:

- Authentication is `Authorization: Bearer $OPENTRACK_SECRET` — a dedicated secret of at least 32
  characters with no whitespace. The browser-visible `WRITE_KEY` is never accepted, and if
  `OPENTRACK_SECRET` equals `WRITE_KEY` or is too weak, the endpoint fails closed with `503`.
- The request body must be `Content-Type: application/json` with exactly
  `{"regulationType": "DELETE_ONLY", "subjectType": "USER_ID", "subjectIds": ["..."]}` (1–100 ids,
  each up to 255 characters).
- CORS grants are only ever attached to public `/v1/*` routes, so browsers cannot make credentialed
  cross-origin calls to `/internal/*`.

## CORS Configuration

The API includes built-in CORS (Cross-Origin Resource Sharing) support optimized for analytics endpoints.
CORS headers apply only to the public `/v1/*` analytics routes; internal routes never receive them.

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
- CORS headers are applied to all routes automatically
