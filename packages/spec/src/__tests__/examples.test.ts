import { describe, expect, test } from 'vitest'

import { aliasEventSchema, groupEventSchema, identifyEventSchema, pageEventSchema, trackEventSchema } from '../index'

describe('Real-world Examples from Documentation', () => {
  describe('Track Event Examples', () => {
    test('should validate e-commerce purchase event', () => {
      const ecommercePurchase = {
        type: 'track',
        userId: 'user_12345',
        event: 'Product Purchased',
        properties: {
          productId: 'SKU-12345',
          productName: 'Premium Headphones',
          brand: 'AudioTech',
          category: 'Electronics',
          variant: 'Black',
          price: 199.99,
          currency: 'USD',
          quantity: 1,
          orderId: 'order_98765',
          cartId: 'cart_456',
          coupon: 'SAVE20',
          discount: 40.0,
          revenue: 159.99,
          tax: 12.8,
          shipping: 9.99,
          affiliation: 'Web Store',
          paymentMethod: 'credit_card',
        },
        context: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
          page: {
            url: 'https://store.example.com/checkout/complete',
            title: 'Order Complete - Store',
            referrer: 'https://store.example.com/checkout',
          },
          campaign: {
            name: 'summer_sale',
            source: 'google',
            medium: 'cpc',
            term: 'wireless headphones',
            content: 'ad_variant_a',
          },
        },
        timestamp: '2025-01-15T14:30:00.000Z',
        messageId: 'ajs-msg-12345',
      }

      expect(() => trackEventSchema.parse(ecommercePurchase)).not.toThrow()
    })

    test('should validate user signup event', () => {
      const userSignup = {
        type: 'track',
        userId: 'user_67890',
        event: 'User Signed Up',
        properties: {
          method: 'email',
          plan: 'free',
          referrer: 'friend_invite',
          utm_source: 'facebook',
          utm_medium: 'social',
          utm_campaign: 'growth_2025',
        },
        context: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          page: {
            url: 'https://app.example.com/signup',
            title: 'Sign Up - Example App',
          },
          library: {
            name: 'analytics.js',
            version: '4.1.0',
          },
        },
        timestamp: '2025-01-15T14:25:00.000Z',
      }

      expect(() => trackEventSchema.parse(userSignup)).not.toThrow()
    })

    test('should validate content interaction event', () => {
      const articleRead = {
        type: 'track',
        anonymousId: 'anon_abc123',
        event: 'Article Read',
        properties: {
          articleId: 'blog-post-456',
          title: 'Getting Started with Analytics',
          category: 'tutorials',
          author: 'Jane Smith',
          wordCount: 1200,
          readTime: 300,
          scrollDepth: 85,
          timeOnPage: 180,
        },
        context: {
          page: {
            url: 'https://blog.example.com/getting-started-analytics',
            title: 'Getting Started with Analytics | Example Blog',
            referrer: 'https://google.com',
          },
        },
        timestamp: '2025-01-15T14:20:00.000Z',
      }

      expect(() => trackEventSchema.parse(articleRead)).not.toThrow()
    })
  })

  describe('Identify Event Examples', () => {
    test('should validate new user registration', () => {
      const newUserRegistration = {
        type: 'identify',
        userId: 'user_12345',
        anonymousId: 'anon_abc123',
        traits: {
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1-555-123-4567',
          age: 32,
          plan: 'free',
          signupSource: 'organic_search',
          createdAt: '2025-01-15T14:30:00.000Z',
          address: {
            city: 'San Francisco',
            state: 'CA',
            country: 'USA',
          },
        },
        context: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
          page: {
            url: 'https://app.example.com/signup/complete',
            title: 'Welcome - Example App',
            referrer: 'https://app.example.com/signup',
          },
          campaign: {
            source: 'google',
            medium: 'organic',
            term: 'productivity app',
          },
        },
        timestamp: '2025-01-15T14:30:00.000Z',
        messageId: 'ajs-msg-67890',
      }

      expect(() => identifyEventSchema.parse(newUserRegistration)).not.toThrow()
    })

    test('should validate B2B user identification', () => {
      const b2bUser = {
        type: 'identify',
        userId: 'user_98765',
        traits: {
          email: 'sarah.smith@enterprise.com',
          firstName: 'Sarah',
          lastName: 'Smith',
          company: 'Enterprise Corp',
          industry: 'Financial Services',
          title: 'Product Manager',
          department: 'Product',
          employees: 5000,
          revenue: 500000000,
          plan: 'enterprise',
          accountId: 'account_567',
          role: 'admin',
          permissions: ['read', 'write', 'admin'],
        },
        timestamp: '2025-01-15T14:40:00.000Z',
      }

      expect(() => identifyEventSchema.parse(b2bUser)).not.toThrow()
    })
  })

  describe('Page Event Examples', () => {
    test('should validate website page view', () => {
      const websitePageView = {
        type: 'page',
        userId: 'user_12345',
        name: 'Product Detail',
        properties: {
          url: 'https://store.example.com/products/premium-widget',
          title: 'Premium Widget - Example Store',
          referrer: 'https://store.example.com/category/electronics',
          path: '/products/premium-widget',
          search: '?color=blue&size=large',
          productId: 'widget_12345',
          productName: 'Premium Widget',
          productCategory: 'Electronics',
          price: 99.99,
          inStock: true,
          utm_source: 'email',
          utm_medium: 'newsletter',
          utm_campaign: 'january_sale',
        },
        context: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
          page: {
            url: 'https://store.example.com/products/premium-widget',
            title: 'Premium Widget - Example Store',
            referrer: 'https://store.example.com/category/electronics',
          },
          screen: {
            width: 1920,
            height: 1080,
            density: 2,
          },
        },
        timestamp: '2025-01-15T14:30:00.000Z',
        messageId: 'ajs-page-12345',
      }

      expect(() => pageEventSchema.parse(websitePageView)).not.toThrow()
    })

    test('should validate mobile app screen view', () => {
      const mobileScreenView = {
        type: 'page',
        userId: 'user_67890',
        name: 'Dashboard',
        properties: {
          screenName: 'Dashboard',
          screenClass: 'DashboardViewController',
          previousScreen: 'Login',
          sessionId: 'session_xyz789',
          appVersion: '2.1.0',
          osVersion: 'iOS 17.2',
          deviceModel: 'iPhone 15 Pro',
          networkType: 'wifi',
          batteryLevel: 85,
        },
        context: {
          app: {
            name: 'Example App',
            version: '2.1.0',
            build: '123',
          },
          device: {
            type: 'mobile',
            manufacturer: 'Apple',
            model: 'iPhone 15 Pro',
            name: "John's iPhone",
          },
          os: {
            name: 'iOS',
            version: '17.2',
          },
          network: {
            wifi: true,
            carrier: 'Verizon',
          },
        },
        timestamp: '2025-01-15T14:35:00.000Z',
      }

      expect(() => pageEventSchema.parse(mobileScreenView)).not.toThrow()
    })
  })

  describe('Group Event Examples', () => {
    test('should validate B2B company association', () => {
      const companyAssociation = {
        type: 'group',
        userId: 'user_12345',
        groupId: 'company_enterprise_corp',
        traits: {
          name: 'Enterprise Corp',
          website: 'https://enterprise-corp.com',
          industry: 'Financial Services',
          employees: 5000,
          revenue: 500000000,
          plan: 'enterprise',
          tier: 'platinum',
          mrr: 50000,
          contractStart: '2024-01-01',
          contractEnd: '2025-12-31',
          address: {
            street: '123 Business Ave',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'USA',
          },
          phone: '+1-555-123-4567',
          accountManager: 'sarah.jones@segment.com',
          technicalContact: 'admin@enterprise-corp.com',
          billingContact: 'billing@enterprise-corp.com',
        },
        context: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          library: {
            name: 'analytics.js',
            version: '4.1.0',
          },
        },
        timestamp: '2025-01-15T14:30:00.000Z',
        messageId: 'ajs-group-12345',
      }

      expect(() => groupEventSchema.parse(companyAssociation)).not.toThrow()
    })

    test('should validate team assignment', () => {
      const teamAssignment = {
        type: 'group',
        userId: 'user_67890',
        groupId: 'team_engineering',
        traits: {
          name: 'Engineering Team',
          department: 'Technology',
          type: 'team',
          members: 25,
          manager: 'john.smith@company.com',
          budget: 2500000,
          location: 'San Francisco',
          technologies: ['React', 'Node.js', 'Python', 'AWS'],
          established: '2020-01-15',
          goals: ['Product Development', 'Platform Scaling'],
        },
        timestamp: '2025-01-15T14:25:00.000Z',
      }

      expect(() => groupEventSchema.parse(teamAssignment)).not.toThrow()
    })
  })

  describe('Alias Event Examples', () => {
    test('should validate post-registration alias', () => {
      const postRegistrationAlias = {
        type: 'alias',
        userId: 'user_12345',
        previousId: 'anon_abc123',
        context: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
          page: {
            url: 'https://app.example.com/signup/complete',
            title: 'Welcome - Example App',
            referrer: 'https://app.example.com/signup',
          },
          library: {
            name: 'analytics.js',
            version: '4.1.0',
          },
        },
        timestamp: '2025-01-15T14:30:00.000Z',
        messageId: 'ajs-alias-12345',
      }

      expect(() => aliasEventSchema.parse(postRegistrationAlias)).not.toThrow()
    })

    test('should validate cross-device merge', () => {
      const crossDeviceMerge = {
        type: 'alias',
        userId: 'user_authenticated',
        previousId: 'anon_mobile_device',
        context: {
          ip: '10.0.1.150',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)...',
          device: {
            type: 'mobile',
            manufacturer: 'Apple',
            model: 'iPhone 15',
          },
          app: {
            name: 'Example Mobile App',
            version: '3.1.2',
            build: '456',
          },
        },
        timestamp: '2025-01-15T14:45:00.000Z',
      }

      expect(() => aliasEventSchema.parse(crossDeviceMerge)).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    test('should handle minimal valid events', () => {
      // Minimal track event
      const minimalTrack = {
        type: 'track',
        event: 'Test',
        userId: 'user123',
      }
      expect(() => trackEventSchema.parse(minimalTrack)).not.toThrow()

      // Minimal identify event
      const minimalIdentify = {
        type: 'identify',
        anonymousId: 'anon123',
      }
      expect(() => identifyEventSchema.parse(minimalIdentify)).not.toThrow()

      // Minimal page event
      const minimalPage = {
        type: 'page',
        userId: 'user123',
      }
      expect(() => pageEventSchema.parse(minimalPage)).not.toThrow()

      // Minimal group event
      const minimalGroup = {
        type: 'group',
        userId: 'user123',
        groupId: 'group123',
      }
      expect(() => groupEventSchema.parse(minimalGroup)).not.toThrow()

      // Minimal alias event
      const minimalAlias = {
        type: 'alias',
        userId: 'user123',
        previousId: 'anon123',
      }
      expect(() => aliasEventSchema.parse(minimalAlias)).not.toThrow()
    })

    test('should handle events with empty optional objects', () => {
      const trackWithEmptyProperties = {
        type: 'track',
        event: 'Test Event',
        userId: 'user123',
        properties: {},
      }
      expect(() => trackEventSchema.parse(trackWithEmptyProperties)).not.toThrow()

      const identifyWithEmptyTraits = {
        type: 'identify',
        userId: 'user123',
        traits: {},
      }
      expect(() => identifyEventSchema.parse(identifyWithEmptyTraits)).not.toThrow()
    })

    test('should handle special characters in string fields', () => {
      const specialCharacters = {
        type: 'track',
        event: 'Test Event with Special Characters: ñáéíóú',
        userId: 'user_123-456_789',
        properties: {
          'special-property': 'value with émojis 🚀',
          unicode_test: '测试中文字符',
          symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        },
      }
      expect(() => trackEventSchema.parse(specialCharacters)).not.toThrow()
    })
  })
})
