/**
 * Test setup - runs before tests start
 * Sets environment variables before the Nitro server is built
 */

// Set WRITE_KEY before anything else runs
process.env.WRITE_KEY = 'test-write-key-for-integration'
