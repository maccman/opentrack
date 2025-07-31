// Local Storage Utilities

export interface StorageConfig {
  userIdKey: string
  anonymousIdKey: string
  traitsKey: string
}

export class AnalyticsStorage {
  private config: StorageConfig

  constructor(config: StorageConfig) {
    this.config = config
  }

  // User ID management
  getUserId(): string | null {
    try {
      return localStorage.getItem(this.config.userIdKey)
    } catch {
      return null
    }
  }

  setUserId(userId: string): void {
    try {
      localStorage.setItem(this.config.userIdKey, userId)
    } catch {
      // Ignore storage errors
    }
  }

  removeUserId(): void {
    try {
      localStorage.removeItem(this.config.userIdKey)
    } catch {
      // Ignore storage errors
    }
  }

  // Anonymous ID management
  getAnonymousId(): string | null {
    try {
      return localStorage.getItem(this.config.anonymousIdKey)
    } catch {
      return null
    }
  }

  setAnonymousId(anonymousId: string): void {
    try {
      localStorage.setItem(this.config.anonymousIdKey, anonymousId)
    } catch {
      // Ignore storage errors
    }
  }

  // Traits management
  getTraits(): Record<string, unknown> {
    try {
      const traits = localStorage.getItem(this.config.traitsKey)
      return traits ? (JSON.parse(traits) as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  setTraits(traits: Record<string, unknown>): void {
    try {
      localStorage.setItem(this.config.traitsKey, JSON.stringify(traits))
    } catch {
      // Ignore storage errors
    }
  }

  removeTraits(): void {
    try {
      localStorage.removeItem(this.config.traitsKey)
    } catch {
      // Ignore storage errors
    }
  }

  // Clear all analytics data
  clear(): void {
    this.removeUserId()
    this.removeTraits()
    // Don't remove anonymous ID as it should persist across resets
  }
}