import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely'
import { NeonDialect } from 'kysely-neon'
import { Pool } from 'pg'
import ws from 'ws'

import type { DB } from './types'

function setupNeonDb(connectionString: string): Kysely<DB> {
  console.log('[db] setting up neon db')

  return new Kysely<DB>({
    dialect: new NeonDialect({
      connectionString,
      webSocketConstructor: ws,
    }),
    log: ['error'],
    plugins: [new CamelCasePlugin()],
  })
}

function setupPostgresDb(connectionString: string): Kysely<DB> {
  console.log('[db] setting up postgres db')

  const pool = new Pool({
    connectionString,
  })

  // Prevent the server crashing when the pool has an error.
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
  })

  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool,
    }),
    log: ['error'],
    plugins: [new CamelCasePlugin()],
  })
}

export function setupDb(connectionString: string): Kysely<DB> {
  if (!connectionString) {
    throw new Error('connectionString cannot be empty')
  }

  const isNeonDb = connectionString.includes('.neon.tech/')
  return isNeonDb
    ? setupNeonDb(connectionString)
    : setupPostgresDb(connectionString)
}
