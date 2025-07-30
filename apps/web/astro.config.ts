import path from 'node:path'

import node from '@astrojs/node'
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, envField } from 'astro/config'

function setEnv(name: string, value?: string) {
  if (value) {
    process.env[name] = value
  }
}

// A URL with the project name.
// Example: my-git-hash.vercel.app
// TODO: To have better security, we should use [Preview Deployment Suffix](https://vercel.com/docs/deployments/preview-deployment-suffix) so that the OAuth redirect URLs are using all own domains.
setEnv(
  'SITE_DEPLOYMENT_URL',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
)

// A URL with the branch name.
// Example: my-branch-name.vercel.app
setEnv(
  'SITE_PREVIEW_BRANCH_URL',
  process.env.VERCEL_BRANCH_URL
    ? `https://${process.env.VERCEL_BRANCH_URL}`
    : undefined,
)

// The production URL of the project.
// Example: my-site.com
setEnv(
  'SITE_PRODUCTION_URL',
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined,
)

// The base site URL. This is used for redirecting etc.
setEnv(
  'SITE_BASE_URL',
  // production environment
  process.env.SITE_PRODUCTION_URL ||
    // preview environment
    process.env.SITE_PREVIEW_BRANCH_URL ||
    // deployment environment not tied to a specific branch
    // (e.g., older deployments from a branch)
    process.env.SITE_DEPLOYMENT_URL ||
    // local development
    'http://localhost:3001',
)

// https://astro.build/config
const config = defineConfig({
  output: 'server',
  adapter: process.env.VERCEL
    ? vercel({
        maxDuration: 300,
      })
    : node({ mode: 'standalone' }),

  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    },
  },

  security: {
    // For Mailgun webhooks, we don't need to check the origin
    checkOrigin: false,
  },

  // https://docs.astro.build/en/guides/environment-variables/#type-safe-environment-variables
  env: {
    schema: {
      SITE_BASE_URL: envField.string({
        context: 'client',
        access: 'public',
        optional: false,
      }),
      SITE_DEPLOYMENT_URL: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      SITE_PREVIEW_BRANCH_URL: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      SITE_PRODUCTION_URL: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      DATABASE_URL: envField.string({
        context: 'server',
        access: 'secret',
        optional: false,
      }),
      AUTH_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: false,
      }),
      GITHUB_CLIENT_ID: envField.string({
        context: 'server',
        access: 'secret',
        optional: false,
      }),
      GITHUB_CLIENT_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: false,
      }),
    },
  },
})

export default config
