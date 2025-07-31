import { describe, expect, it } from 'vitest'

import { flattenObject } from '../object-flattener'

describe('flattenObject', () => {
  it('should flatten simple nested objects', () => {
    const input = {
      user: {
        firstName: 'John',
        lastName: 'Doe',
      },
    }
    const expected = {
      user_first_name: 'John',
      user_last_name: 'Doe',
    }
    expect(flattenObject(input)).toEqual(expected)
  })

  it('should handle deeply nested objects', () => {
    const input = {
      context: {
        device: {
          type: 'mobile',
          info: {
            brand: 'Apple',
            model: 'iPhone',
          },
        },
      },
    }
    const expected = {
      context_device_type: 'mobile',
      context_device_info_brand: 'Apple',
      context_device_info_model: 'iPhone',
    }
    expect(flattenObject(input)).toEqual(expected)
  })

  it('should convert arrays to JSON strings', () => {
    const input = {
      tags: ['mobile', 'phone', 'apple'],
      features: ['camera', 'gps'],
    }
    const expected = {
      tags: '["mobile","phone","apple"]',
      features: '["camera","gps"]',
    }
    expect(flattenObject(input)).toEqual(expected)
  })

  it('should handle arrays within nested objects', () => {
    const input = {
      product: {
        name: 'iPhone',
        categories: ['electronics', 'phones'],
        specs: {
          colors: ['black', 'white'],
          storage: [64, 128, 256],
        },
      },
    }
    const expected = {
      product_name: 'iPhone',
      product_categories: '["electronics","phones"]',
      product_specs_colors: '["black","white"]',
      product_specs_storage: '[64,128,256]',
    }
    expect(flattenObject(input)).toEqual(expected)
  })

  it('should handle primitive values', () => {
    const input = {
      name: 'John',
      age: 30,
      isActive: true,
      score: 95.5,
      description: null,
      undefined: undefined,
    }
    const expected = {
      name: 'John',
      age: 30,
      is_active: true,
      score: 95.5,
      description: null,
      undefined: undefined,
    }
    expect(flattenObject(input)).toEqual(expected)
  })

  it('should handle Date objects', () => {
    const date = new Date('2023-01-01T00:00:00Z')
    const input = {
      createdAt: date,
      user: {
        lastLogin: date,
      },
    }
    const expected = {
      created_at: date,
      user_last_login: date,
    }
    expect(flattenObject(input)).toEqual(expected)
  })

  it('should handle empty objects', () => {
    expect(flattenObject({})).toEqual({})
    expect(flattenObject({ empty: {} })).toEqual({})
  })

  it('should handle mixed content', () => {
    const input = {
      userId: 'user123',
      properties: {
        productName: 'iPhone',
        price: 999,
        inStock: true,
        tags: ['electronics', 'mobile'],
        metadata: {
          source: 'api',
          version: 2,
        },
      },
    }
    const expected = {
      user_id: 'user123',
      properties_product_name: 'iPhone',
      properties_price: 999,
      properties_in_stock: true,
      properties_tags: '["electronics","mobile"]',
      properties_metadata_source: 'api',
      properties_metadata_version: 2,
    }
    expect(flattenObject(input)).toEqual(expected)
  })

  it('should work with prefixes', () => {
    const input = {
      deviceType: 'mobile',
      screenSize: 'large',
    }
    const expected = {
      context_device_type: 'mobile',
      context_screen_size: 'large',
    }
    expect(flattenObject(input, 'context')).toEqual(expected)
  })

  it('should handle camelCase to snake_case conversion', () => {
    const input = {
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '+1234567890',
      homeAddress: {
        streetAddress: '123 Main St',
        zipCode: '12345',
      },
    }
    const expected = {
      first_name: 'John',
      last_name: 'Doe',
      phone_number: '+1234567890',
      home_address_street_address: '123 Main St',
      home_address_zip_code: '12345',
    }
    expect(flattenObject(input)).toEqual(expected)
  })

  it('should handle complex Segment-like context object', () => {
    const input = {
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      device: {
        type: 'mobile',
        brand: 'Apple',
        model: 'iPhone',
      },
      screen: {
        width: 375,
        height: 812,
        density: 3,
      },
      app: {
        name: 'MyApp',
        version: '1.0.0',
        build: '123',
      },
    }
    const expected = {
      ip: '192.168.1.1',
      user_agent: 'Mozilla/5.0...',
      device_type: 'mobile',
      device_brand: 'Apple',
      device_model: 'iPhone',
      screen_width: 375,
      screen_height: 812,
      screen_density: 3,
      app_name: 'MyApp',
      app_version: '1.0.0',
      app_build: '123',
    }
    expect(flattenObject(input)).toEqual(expected)
  })
})
