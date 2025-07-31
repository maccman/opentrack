# OpenTrack Web API

A Nitro-based web API for the OpenTrack analytics platform.

Look at the [nitro quick start](https://nitro.unjs.io/guide#quick-start) to learn more how to get started.

## CORS Configuration

The API includes built-in CORS (Cross-Origin Resource Sharing) support optimized for analytics endpoints.

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
