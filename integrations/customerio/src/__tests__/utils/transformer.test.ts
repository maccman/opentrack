import { describe, it, expect } from 'vitest';
import { CustomerioTransformer } from '../../utils/transformer';
import type {
  IdentifyPayload,
  TrackPayload,
  PagePayload,
  GroupPayload,
  AliasPayload,
} from '@app/spec';

describe('CustomerioTransformer', () => {
  describe('transformIdentify', () => {
    it('should transform basic identify call', () => {
      const payload: IdentifyPayload = {
        type: 'identify',
        userId: 'user123',
        traits: {
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      const result = CustomerioTransformer.transformIdentify(payload);
      expect(result).toEqual({
        id: 'user123',
        traits: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    });

    it('should add created_at timestamp when timestamp is provided', () => {
      const call: IdentifyCall = {
        userId: 'user123',
        traits: { email: 'test@example.com' },
        timestamp: '2023-01-01T00:00:00Z',
      };

      const result = CustomerioTransformer.transformIdentify(call);
      expect(result.traits.created_at).toBe(1672531200);
    });

    it('should throw error when userId is missing', () => {
      const call: IdentifyCall = {
        traits: { email: 'test@example.com' },
      } as IdentifyCall;

      expect(() => CustomerioTransformer.transformIdentify(call)).toThrow('User ID is required');
    });
  });

  describe('transformTrack', () => {
    it('should transform basic track call', () => {
      const call: TrackCall = {
        userId: 'user123',
        event: 'Purchase Completed',
        properties: {
          revenue: 99.99,
          currency: 'USD',
        },
      };

      const result = CustomerioTransformer.transformTrack(call);
      expect(result).toEqual({
        id: 'user123',
        event: 'Purchase Completed',
        properties: {
          revenue: 99.99,
          currency: 'USD',
        },
      });
    });

    it('should transform anonymous track call', () => {
      const call: TrackCall = {
        event: 'Page Viewed',
        properties: {
          url: '/home',
        },
      };

      const result = CustomerioTransformer.transformTrack(call);
      expect(result).toEqual({
        event: 'Page Viewed',
        properties: {
          url: '/home',
        },
      });
      expect(result.id).toBeUndefined();
    });

    it('should add timestamp when provided', () => {
      const call: TrackCall = {
        userId: 'user123',
        event: 'Purchase Completed',
        timestamp: 1672531200000, // milliseconds
      };

      const result = CustomerioTransformer.transformTrack(call);
      expect(result.properties.timestamp).toBe(1672531200); // seconds
    });

    it('should throw error when event name is missing', () => {
      const call: TrackCall = {
        userId: 'user123',
        properties: {},
      } as TrackCall;

      expect(() => CustomerioTransformer.transformTrack(call)).toThrow('Event name is required');
    });
  });

  describe('transformPage', () => {
    it('should transform page call with name and category', () => {
      const call: PageCall = {
        userId: 'user123',
        name: 'Home',
        category: 'Marketing',
        properties: {
          url: '/home',
        },
      };

      const result = CustomerioTransformer.transformPage(call);
      expect(result).toEqual({
        id: 'user123',
        event: 'page_viewed',
        properties: {
          url: '/home',
          page_title: 'Marketing Home',
          page_name: 'Home',
          page_category: 'Marketing',
        },
      });
    });

    it('should transform page call with only name', () => {
      const call: PageCall = {
        userId: 'user123',
        name: 'Home',
      };

      const result = CustomerioTransformer.transformPage(call);
      expect(result.properties.page_title).toBe('Home');
      expect(result.properties.page_name).toBe('Home');
    });

    it('should transform page call with only category', () => {
      const call: PageCall = {
        userId: 'user123',
        category: 'Marketing',
      };

      const result = CustomerioTransformer.transformPage(call);
      expect(result.properties.page_title).toBe('Marketing');
      expect(result.properties.page_category).toBe('Marketing');
    });

    it('should use default title when no name or category', () => {
      const call: PageCall = {
        userId: 'user123',
      };

      const result = CustomerioTransformer.transformPage(call);
      expect(result.properties.page_title).toBe('Page Viewed');
    });

    it('should transform anonymous page call', () => {
      const call: PageCall = {
        name: 'Home',
      };

      const result = CustomerioTransformer.transformPage(call);
      expect(result.id).toBeUndefined();
      expect(result.event).toBe('page_viewed');
    });
  });

  describe('transformGroup', () => {
    it('should transform basic group call', () => {
      const call: GroupCall = {
        userId: 'user123',
        groupId: 'company456',
        traits: {
          name: 'Acme Corp',
          industry: 'Technology',
        },
      };

      const result = CustomerioTransformer.transformGroup(call);
      expect(result).toEqual({
        id: 'user123',
        groupId: 'company456',
        traits: {
          name: 'Acme Corp',
          industry: 'Technology',
        },
      });
    });

    it('should throw error when userId is missing', () => {
      const call: GroupCall = {
        groupId: 'company456',
        traits: {},
      } as GroupCall;

      expect(() => CustomerioTransformer.transformGroup(call)).toThrow('User ID is required');
    });

    it('should throw error when groupId is missing', () => {
      const call: GroupCall = {
        userId: 'user123',
        traits: {},
      } as GroupCall;

      expect(() => CustomerioTransformer.transformGroup(call)).toThrow('Group ID is required');
    });
  });

  describe('transformAlias', () => {
    it('should transform basic alias call', () => {
      const call: AliasCall = {
        userId: 'user123',
        previousId: 'temp456',
      };

      const result = CustomerioTransformer.transformAlias(call);
      expect(result).toEqual({
        primaryType: 'id',
        primaryId: 'user123',
        secondaryType: 'id',
        secondaryId: 'temp456',
      });
    });

    it('should throw error when userId is missing', () => {
      const call: AliasCall = {
        previousId: 'temp456',
      } as AliasCall;

      expect(() => CustomerioTransformer.transformAlias(call)).toThrow('User ID is required');
    });

    it('should throw error when previousId is missing', () => {
      const call: AliasCall = {
        userId: 'user123',
      } as AliasCall;

      expect(() => CustomerioTransformer.transformAlias(call)).toThrow('Previous ID is required');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user+tag@domain.co.uk',
        'firstname.lastname@company.org',
      ];

      validEmails.forEach(email => {
        expect(CustomerioTransformer.isValidEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        '',
      ];

      invalidEmails.forEach(email => {
        expect(CustomerioTransformer.isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('sanitizeProperties', () => {
    it('should preserve valid primitive values', () => {
      const properties = {
        string: 'test',
        number: 123,
        boolean: true,
        null: null,
      };

      const result = CustomerioTransformer.sanitizeProperties(properties);
      expect(result).toEqual(properties);
    });

    it('should remove undefined values', () => {
      const properties = {
        defined: 'value',
        undefined: undefined,
      };

      const result = CustomerioTransformer.sanitizeProperties(properties);
      expect(result).toEqual({ defined: 'value' });
    });

    it('should convert dates to ISO strings', () => {
      const date = new Date('2023-01-01T00:00:00Z');
      const properties = {
        createdAt: date,
      };

      const result = CustomerioTransformer.sanitizeProperties(properties);
      expect(result.createdAt).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should sanitize nested objects', () => {
      const properties = {
        user: {
          name: 'Test',
          createdAt: new Date('2023-01-01T00:00:00Z'),
          undefined: undefined,
        },
      };

      const result = CustomerioTransformer.sanitizeProperties(properties);
      expect(result).toEqual({
        user: {
          name: 'Test',
          createdAt: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should sanitize arrays', () => {
      const properties = {
        tags: ['tag1', new Date('2023-01-01T00:00:00Z'), { name: 'object' }],
      };

      const result = CustomerioTransformer.sanitizeProperties(properties);
      expect(result.tags).toEqual([
        'tag1',
        '2023-01-01T00:00:00.000Z',
        { name: 'object' },
      ]);
    });

    it('should convert unknown types to strings', () => {
      const properties = {
        func: () => 'test',
        symbol: Symbol('test'),
      };

      const result = CustomerioTransformer.sanitizeProperties(properties);
      expect(typeof result.func).toBe('string');
      expect(typeof result.symbol).toBe('string');
    });
  });
});