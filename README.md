# Libroseg

The purpose of this project is to create an open source slimmed down [Segment](https://segment.com). The project will emulate the exact same Segment API endpoints.

The task will be to take a event, then stream it onto the 3rd party integrations. The integrations that we will initially build out are:

- Customer.io
- Google BigQuery

You can self-host this app on Vercel, which should be extremely fast. We will be using Vercel functions with their new fluid compute feature.

This app provides a HTTP interface that is Segment-compliant. You can take the existing segment.js JavaScript library and point them at these endpoints.

## Setup

1. Clone the repository
2. Run `pnpm install`
3. Run `pnpm dev`

### Configuration

1. Create a `.env` file in the root of the project.
2. Add the following variables:

```env
# Customer.io
CUSTOMERIO_SITE_ID=your-customerio-site-id
CUSTOMERIO_API_KEY=your-customerio-api-key

# Google BigQuery
BIGQUERY_PROJECT_ID=your-bigquery-project-id
BIGQUERY_DATASET=your-dataset
BIGQUERY_TABLE=your-table
```

API Endpoints

Emulates Segment’s HTTP Tracking API:
• POST /v1/track
• POST /v1/identify
• POST /v1/page
• POST /v1/group
• POST /v1/alias

Payloads and responses match the official Segment API.

---

## API Endpoints

Emulates [Segment’s HTTP Tracking API](https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/):

- `POST /v1/track`
- `POST /v1/identify`
- `POST /v1/page`
- `POST /v1/group`
- `POST /v1/alias`

Payloads and responses match the official Segment API.

---

## Authentication

No authentication is required for this API. Since there's only one organization and the service is hosted on Vercel, incoming requests don't need to differentiate between different organizations or users. All API endpoints accept requests without any authentication headers or tokens.

This simplifies integration and allows for immediate event tracking without the overhead of API key management or user authentication flows.

---

## Integrations

### Customer.io

Events will be forwarded as [Customer.io Track API](https://customer.io/docs/api/#operation/track) calls.  
Requires `CUSTOMERIO_SITE_ID` and `CUSTOMERIO_API_KEY`.

### Google BigQuery

Events are streamed directly into your BigQuery table.  
Requires `BIGQUERY_PROJECT_ID`, `BIGQUERY_DATASET`, and `BIGQUERY_TABLE`.

---

## Example Usage

Send an event:

```bash
curl -X POST http://localhost:3000/v1/track \
  -H 'Content-Type: application/json' \
  -d '{
        "userId": "123",
        "event": "Order Completed",
        "properties": { "revenue": 42 }
      }'
```

---

# Monorepo Scaffold

This is a scaffold for a modern web application using a monorepo architecture. It's designed to provide a solid foundation for new projects, with a focus on type-safety, developer experience, and scalability.

## What's inside?

This monorepo includes:

- `apps/web`: An [Astro](https://astro.build/) application for the frontend.
- `packages/api`: API utilities and database actions for server-side operations.
- `packages/db`: Database schemas, migrations, and query utilities using [Kysely](https://kysely.dev/).
- `packages/utils`: Shared utilities used across the monorepo.
- **Authentication**: Example implementation using [better-auth](https://github.com/BetterAuth/better-auth) with GitHub as an OAuth provider.
- **UI**: Basic UI setup with [Tailwind CSS](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/).
- **Tooling**:
  - [Turborepo](https://turbo.build/repo) for high-performance builds.
  - [PNPM](https://pnpm.io/) for efficient package management.
  - [TypeScript](https://www.typescriptlang.org/) for static typing.
  - [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) for code quality.

## Perfect for AI-Assisted Development

This scaffold is specifically designed to excel with AI coding assistants and "vibe coding" workflows:

- **Rich Examples**: The codebase provides comprehensive examples of common patterns like API routing, database connections, migrations, authentication flows, and UI components that AI can learn from and replicate.
- **Comprehensive Cursor Rules**: Pre-configured `.cursor/rules/` directory with detailed guidelines for:
  - Database patterns and Kysely type helpers
  - React component conventions and shadcn/ui usage
  - TypeScript best practices and naming conventions
  - Environment variable management
  - Code organization and project structure
- **Consistent Patterns**: Standardized approaches across the entire stack make it easy for AI to understand and extend the codebase following established conventions.
- **Type Safety**: Full TypeScript coverage provides clear contracts and interfaces that AI can work with confidently.

Whether you're pair programming with Claude, GitHub Copilot, or Cursor's AI, this scaffold gives your AI assistant the context and examples it needs to generate high-quality, consistent code that follows your project's patterns.

## Getting Started

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-repo/monorepo-scaffold.git
    cd monorepo-scaffold
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**

    Create a `.env` file in `apps/web` and add the following variables:

    ```env
    # Generate a secret with `openssl rand -base64 32`
    AUTH_SECRET="your_auth_secret"

    # From your GitHub OAuth application
    GITHUB_CLIENT_ID="your_github_client_id"
    GITHUB_CLIENT_SECRET="your_github_client_secret"

    # Your local PostgreSQL connection string
    DATABASE_URL="postgres://user:password@localhost:5432/monorepo-scaffold"
    ```

4.  **Set up the database:**

    Make sure you have a PostgreSQL server running. Then, run the migrations:

    ```bash
    DATABASE_URL="postgres://user:password@localhost:5432/monorepo-scaffold" pnpm --filter @app/db db:migrate
    ```

5.  **Run the development server:**

    ```bash
    pnpm dev
    ```

    The web application will be available at `http://localhost:3001`.

## Development

- `pnpm build`: Build all apps and packages.
- `pnpm lint`: Lint all code.
- `pnpm typecheck`: Run TypeScript to check for type errors.
- `pnpm test`: Run tests.

# Authors

- [@ocavue](https://github.com/ocavue)
- [@maccman](https://github.com/maccman)

# License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
