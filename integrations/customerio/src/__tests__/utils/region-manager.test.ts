import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RegionManager } from '../../utils/region-manager'

describe('RegionManager', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.CUSTOMERIO_REGION
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CUSTOMERIO_REGION = originalEnv
    } else {
      delete process.env.CUSTOMERIO_REGION
    }
  })

  describe('constructor', () => {
    it('should default to US region', () => {
      const manager = new RegionManager()
      expect(manager.getRegion()).toBe('US')
    })

    it('should accept EU region', () => {
      const manager = new RegionManager('EU')
      expect(manager.getRegion()).toBe('EU')
    })

    it('should accept US region explicitly', () => {
      const manager = new RegionManager('US')
      expect(manager.getRegion()).toBe('US')
    })
  })

  describe('setRegion', () => {
    it('should update the region', () => {
      const manager = new RegionManager('US')
      manager.setRegion('EU')
      expect(manager.getRegion()).toBe('EU')
    })
  })

  describe('getCustomerioRegion', () => {
    it('should return RegionUS for US', () => {
      const manager = new RegionManager('US')
      const region = manager.getCustomerioRegion()
      expect(region).toBeDefined()
    })

    it('should return RegionEU for EU', () => {
      const manager = new RegionManager('EU')
      const region = manager.getCustomerioRegion()
      expect(region).toBeDefined()
    })
  })

  describe('getApiUrl', () => {
    it('should return US API URL for US region', () => {
      const manager = new RegionManager('US')
      expect(manager.getApiUrl()).toBe('https://track.customer.io')
    })

    it('should return EU API URL for EU region', () => {
      const manager = new RegionManager('EU')
      expect(manager.getApiUrl()).toBe('https://track-eu.customer.io')
    })
  })

  describe('fromEnvironment', () => {
    it('should default to US when no environment variable is set', () => {
      delete process.env.CUSTOMERIO_REGION
      expect(RegionManager.fromEnvironment()).toBe('US')
    })

    it('should return EU when environment variable is set to EU', () => {
      process.env.CUSTOMERIO_REGION = 'EU'
      expect(RegionManager.fromEnvironment()).toBe('EU')
    })

    it('should return EU when environment variable is set to eu (lowercase)', () => {
      process.env.CUSTOMERIO_REGION = 'eu'
      expect(RegionManager.fromEnvironment()).toBe('EU')
    })

    it('should default to US for invalid environment variable', () => {
      process.env.CUSTOMERIO_REGION = 'INVALID'
      expect(RegionManager.fromEnvironment()).toBe('US')
    })

    it('should default to US when environment variable is empty', () => {
      process.env.CUSTOMERIO_REGION = ''
      expect(RegionManager.fromEnvironment()).toBe('US')
    })
  })
})
