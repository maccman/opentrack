# Test Suite for @app/spec

This directory contains comprehensive tests for the Segment event validation schemas, comparing the current implementation against the full specification documented in `@docs/`.

## Test Files

### `validation.test.ts`

Basic validation tests for the current implementation:

- Tests required fields and identity validation
- Validates event type literals
- Checks optional fields acceptance

### `constraints.test.ts`

Tests for specification constraints that are **NOT** enforced in the current implementation:

- String length limits (255 chars for IDs, 200 for event names)
- Property constraints (max 255 properties, max 3 levels nesting)
- Reserved name validation ($ prefix rejection)
- Array length limits (max 255 elements)

**Note**: These tests are marked as "EXPECTED TO FAIL" because they document the gap between the current implementation and the specification.

### `enhanced.test.ts`

Tests for the **enhanced schemas** that fully implement the Segment specification:

- ✅ All string length limits enforced
- ✅ Reserved name validation ($ prefix rejection)
- ✅ Property and trait constraints
- ✅ Nested object depth limits (max 3 levels)
- ✅ Array length limits
- ✅ Proper error messages

### `examples.test.ts`

Real-world examples from the documentation:

- E-commerce events (purchases, signups)
- B2B scenarios (company association, team assignment)
- Content interaction events
- Mobile app screen views
- Cross-device identity merging

### `integration.test.ts`

Tests for the Integration interface:

- Method signature validation
- Payload type acceptance
- Error handling scenarios
- Complex integration workflows

## Schema Comparison

### Current Implementation (`trackEventSchema`, `identifyEventSchema`, etc.)

- ✅ Basic type validation
- ✅ Required field enforcement
- ✅ Identity requirements (userId OR anonymousId)
- ❌ No string length limits
- ❌ No property constraints
- ❌ No reserved name validation
- ❌ No nesting depth limits

### Enhanced Implementation (`enhancedTrackEventSchema`, etc.)

- ✅ All features from current implementation
- ✅ String length limits per specification
- ✅ Property constraints (255 max, 255 char names)
- ✅ Reserved name validation ($ prefix rejection)
- ✅ Nesting depth limits (3 levels max)
- ✅ Array length limits (255 elements max)
- ✅ Proper error messages with detailed validation

## Usage

```typescript
import {
  // Current implementation (basic validation)
  trackEventSchema,
  identifyEventSchema,

  // Enhanced implementation (full spec compliance)
  enhancedTrackEventSchema,
  enhancedIdentifyEventSchema,
} from '@app/spec'

// Basic validation
const basicResult = trackEventSchema.parse(event)

// Full specification validation
const enhancedResult = enhancedTrackEventSchema.parse(event)
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/__tests__/enhanced.test.ts

# Run with coverage
pnpm test --coverage
```

## Key Findings

1. **Implementation Gaps**: The current implementation lacks many constraints specified in the documentation
2. **Specification Compliance**: The enhanced schemas provide full compliance with Segment's documented constraints
3. **Backward Compatibility**: Enhanced schemas are strict supersets - valid events for current schemas remain valid
4. **Error Quality**: Enhanced schemas provide more descriptive error messages for constraint violations

## Recommendations

1. **Migration Path**: Consider migrating to enhanced schemas for production use
2. **Validation Strategy**: Use enhanced schemas for client-side validation and current schemas for basic type checking
3. **Documentation**: Update API documentation to reflect actual validation constraints
4. **Monitoring**: Implement logging for constraint violations to understand real-world impact
