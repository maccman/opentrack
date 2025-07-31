# Group Method

## Overview

The `group` method associates users with groups, companies, organizations, or accounts. It's essential for B2B analytics, enabling analysis at the account level rather than just individual users.

## Endpoint

```
POST /v1/group
```

## When to Use Group

Use `group` to:

- **B2B Account Tracking**: Associate users with their companies or organizations
- **Team Management**: Link users to teams, departments, or projects
- **Multi-tenant Applications**: Connect users to their tenant/workspace
- **Organization Analytics**: Enable account-level reporting and analysis
- **Access Control**: Track user permissions within organizational contexts

## Required Fields

| Field                     | Type   | Description                             |
| ------------------------- | ------ | --------------------------------------- |
| `userId` OR `anonymousId` | String | User identifier (at least one required) |
| `groupId`                 | String | Unique identifier for the group         |

## Payload Structure

```json
{
  "type": "group",
  "userId": "string",
  "anonymousId": "string",
  "groupId": "string",
  "traits": {
    "name": "string",
    "industry": "string",
    "employees": 100,
    "plan": "string",
    "website": "string"
  },
  "context": {
    "ip": "string",
    "userAgent": "string",
    "library": {
      "name": "string",
      "version": "string"
    }
  },
  "timestamp": "2025-01-15T10:30:00.000Z",
  "messageId": "string",
  "integrations": {
    "destination": true|false
  }
}
```

## Field Specifications

### Core Fields

#### groupId (required)

- **Type**: String
- **Description**: Unique identifier for the group in your database
- **Constraints**: Max 255 characters
- **Examples**: `"company_12345"`, `"team_engineering"`, `"account_enterprise_corp"`

#### traits (optional but recommended)

- **Type**: Object
- **Description**: Group attributes and characteristics
- **Constraints**:
  - Max 255 traits per group
  - Trait names max 255 characters
  - Nested objects max 3 levels deep

### Group Traits

#### Company/Organization Traits

```json
{
  "traits": {
    // Identity
    "name": "Enterprise Corp",
    "website": "https://enterprise-corp.com",
    "industry": "Financial Services",
    "description": "Leading financial services provider",

    // Size & Scale
    "employees": 5000,
    "revenue": 500000000,
    "founded": 1995,
    "locations": ["New York", "London", "Tokyo"],

    // Business Details
    "plan": "enterprise",
    "tier": "platinum",
    "mrr": 50000,
    "arr": 600000,
    "contractValue": 1200000,
    "renewalDate": "2025-12-31",

    // Contact Information
    "address": {
      "street": "123 Business Ave",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "USA"
    },
    "phone": "+1-555-123-4567",
    "timezone": "America/New_York"
  }
}
```

#### Team/Department Traits

```json
{
  "traits": {
    "name": "Engineering Team",
    "department": "Technology",
    "type": "team",
    "members": 25,
    "manager": "john.smith@company.com",
    "budget": 2500000,
    "location": "San Francisco",
    "established": "2020-01-15"
  }
}
```

#### Project/Workspace Traits

```json
{
  "traits": {
    "name": "Mobile App Redesign",
    "type": "project",
    "status": "active",
    "startDate": "2025-01-01",
    "endDate": "2025-06-30",
    "budget": 500000,
    "teamSize": 8,
    "priority": "high"
  }
}
```

## Complete Examples

### B2B Company Association

```json
{
  "type": "group",
  "userId": "user_12345",
  "groupId": "company_enterprise_corp",
  "traits": {
    "name": "Enterprise Corp",
    "website": "https://enterprise-corp.com",
    "industry": "Financial Services",
    "employees": 5000,
    "revenue": 500000000,
    "plan": "enterprise",
    "tier": "platinum",
    "mrr": 50000,
    "contractStart": "2024-01-01",
    "contractEnd": "2025-12-31",
    "address": {
      "street": "123 Business Ave",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "USA"
    },
    "phone": "+1-555-123-4567",
    "accountManager": "sarah.jones@segment.com",
    "technicalContact": "admin@enterprise-corp.com",
    "billingContact": "billing@enterprise-corp.com"
  },
  "context": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "library": {
      "name": "analytics.js",
      "version": "4.1.0"
    }
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "messageId": "ajs-group-12345"
}
```

### Team Assignment

```json
{
  "type": "group",
  "userId": "user_67890",
  "groupId": "team_engineering",
  "traits": {
    "name": "Engineering Team",
    "department": "Technology",
    "type": "team",
    "members": 25,
    "manager": "john.smith@company.com",
    "budget": 2500000,
    "location": "San Francisco",
    "technologies": ["React", "Node.js", "Python", "AWS"],
    "established": "2020-01-15",
    "goals": ["Product Development", "Platform Scaling"]
  },
  "timestamp": "2025-01-15T14:25:00.000Z"
}
```

### Workspace/Tenant Association

```json
{
  "type": "group",
  "userId": "user_11111",
  "groupId": "workspace_acme_marketing",
  "traits": {
    "name": "ACME Marketing Workspace",
    "type": "workspace",
    "plan": "pro",
    "seats": 15,
    "storageUsed": "2.5GB",
    "storageLimit": "100GB",
    "features": ["advanced_analytics", "custom_integrations"],
    "createdAt": "2024-06-15T10:00:00.000Z",
    "lastActive": "2025-01-15T14:00:00.000Z"
  },
  "timestamp": "2025-01-15T14:35:00.000Z"
}
```

### Educational Institution

```json
{
  "type": "group",
  "userId": "student_98765",
  "groupId": "university_stanford",
  "traits": {
    "name": "Stanford University",
    "type": "educational_institution",
    "industry": "Education",
    "students": 17000,
    "faculty": 2300,
    "established": 1885,
    "location": "Stanford, CA",
    "website": "https://stanford.edu",
    "accreditation": "WASC",
    "ranking": 3
  },
  "timestamp": "2025-01-15T14:40:00.000Z"
}
```

## Reserved Traits

Segment reserves certain trait names for special processing:

### Identity Traits

- `id`: Unique group identifier (automatically set to groupId)
- `name`: Group's display name
- `email`: Group's primary email address
- `website`: Group's website URL
- `phone`: Group's phone number

### Business Traits

- `industry`: Industry classification
- `employees`: Number of employees (integer)
- `revenue`: Annual revenue (number)
- `plan`: Subscription or service plan
- `address`: Address object with street, city, state, etc.

### Descriptive Traits

- `description`: Group description or mission
- `avatar`: URL to group logo or image
- `createdAt`: When the group was created (ISO 8601)
- `updatedAt`: When the group was last updated (ISO 8601)

### Custom Traits

```json
{
  "traits": {
    // Custom business metrics
    "mrr": 50000,
    "churnRisk": "low",
    "nps": 72,
    "csat": 4.2,

    // Custom categorization
    "segment": "enterprise",
    "vertical": "fintech",
    "region": "north_america",

    // Custom metadata
    "tags": ["vip", "early_adopter"],
    "integrations": ["salesforce", "hubspot"],
    "features": ["sso", "api_access"]
  }
}
```

## HTTP Examples

### cURL Request

```bash
curl -X POST https://api.segment.io/v1/group \
  -H "Authorization: Basic $(echo -n 'YOUR_WRITE_KEY:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "groupId": "company_acme",
    "traits": {
      "name": "ACME Corp",
      "industry": "Technology",
      "employees": 500,
      "plan": "enterprise"
    }
  }'
```

### JavaScript SDK

```javascript
// Associate user with company
analytics.group('company_acme', {
  name: 'ACME Corp',
  industry: 'Technology',
  employees: 500,
  plan: 'enterprise',
  website: 'https://acme.com',
})

// Team assignment
analytics.group('team_engineering', {
  name: 'Engineering Team',
  department: 'Technology',
  members: 25,
  budget: 2500000,
})
```

### Node.js SDK

```javascript
analytics.group({
  userId: 'user123',
  groupId: 'company_acme',
  traits: {
    name: 'ACME Corp',
    industry: 'Technology',
    employees: 500,
    plan: 'enterprise',
    revenue: 10000000,
    website: 'https://acme.com',
  },
})
```

### Python SDK

```python
analytics.group(
    user_id='user123',
    group_id='company_acme',
    traits={
        'name': 'ACME Corp',
        'industry': 'Technology',
        'employees': 500,
        'plan': 'enterprise',
        'revenue': 10000000,
        'website': 'https://acme.com'
    }
)
```

## Group Management Patterns

### User Onboarding

```javascript
// When user joins a company
function onUserJoinCompany(userId, companyData) {
  // Associate user with company
  analytics.group(companyData.id, {
    name: companyData.name,
    industry: companyData.industry,
    employees: companyData.employeeCount,
    plan: companyData.subscriptionPlan,
  })

  // Track the event
  analytics.track('User Joined Company', {
    companyId: companyData.id,
    companyName: companyData.name,
    userRole: 'member',
  })
}
```

### Group Updates

```javascript
// When company information changes
function updateCompanyInfo(groupId, updates) {
  analytics.group(groupId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  })

  analytics.track('Company Information Updated', {
    groupId: groupId,
    fieldsUpdated: Object.keys(updates),
  })
}
```

### Multi-Group Associations

```javascript
// User can belong to multiple groups
function assignUserToGroups(userId, groups) {
  groups.forEach((group) => {
    analytics.group(group.id, group.traits)
  })

  analytics.track('User Assigned to Groups', {
    groupIds: groups.map((g) => g.id),
    groupCount: groups.length,
  })
}
```

## B2B Analytics Use Cases

### Account-Based Marketing (ABM)

```javascript
// Track company-level events
analytics.group('company_target_account', {
  name: 'Target Account Inc',
  industry: 'Manufacturing',
  employees: 10000,
  revenue: 1000000000,
  abm_tier: 'tier_1',
  sales_owner: 'jane.doe@company.com',
  marketing_qualified: true,
})

// Track account engagement
analytics.track('Account Engaged', {
  groupId: 'company_target_account',
  engagement_type: 'demo_request',
  touchpoint: 'website',
})
```

### Customer Success Management

```javascript
// Track account health metrics
analytics.group('company_customer', {
  name: 'Customer Corp',
  plan: 'enterprise',
  mrr: 25000,
  health_score: 85,
  renewal_date: '2025-12-31',
  csm_assigned: 'customer.success@company.com',
  risk_level: 'low',
})

// Track customer success events
analytics.track('Health Score Updated', {
  groupId: 'company_customer',
  previous_score: 78,
  current_score: 85,
  improvement: 7,
})
```

### Team Collaboration Analytics

```javascript
// Track team performance
analytics.group('team_product', {
  name: 'Product Team',
  members: 12,
  active_projects: 4,
  sprint_velocity: 45,
  team_lead: 'product.lead@company.com',
})

// Track team activities
analytics.track('Sprint Completed', {
  groupId: 'team_product',
  sprint_number: 23,
  story_points_completed: 48,
  velocity: 45,
})
```

## Identity Resolution with Groups

### Group Event Attribution

```javascript
// Events automatically attributed to user's groups
analytics.identify('user123', {
  email: 'john@acme.com',
  role: 'manager',
})

analytics.group('company_acme', {
  name: 'ACME Corp',
  plan: 'enterprise',
})

// This event will be attributed to both user and company
analytics.track('Feature Used', {
  feature: 'advanced_reports',
  duration: 300,
})
```

### Cross-Device Group Tracking

```javascript
// User logs in on different device
analytics.identify('user123', {
  email: 'john@acme.com',
  lastLogin: new Date().toISOString(),
})

// Group association persists across devices
analytics.group('company_acme', {
  name: 'ACME Corp',
  lastUserActivity: new Date().toISOString(),
})
```

## Privacy and Compliance

### Data Minimization

```javascript
// Only collect necessary group data
analytics.group('company_client', {
  // ✓ Business relevant
  name: 'Client Corp',
  industry: 'Healthcare',
  plan: 'enterprise',

  // ✗ Avoid sensitive data
  // internal_notes: 'Difficult client',
  // contract_details: {...}

  // ✓ Aggregated metrics OK
  employee_range: '1000-5000',
  revenue_range: '100M-500M',
})
```

### GDPR Considerations

```javascript
// Support data portability
function exportGroupData(groupId) {
  return {
    groupId: groupId,
    traits: getGroupTraits(groupId),
    users: getGroupUsers(groupId),
    events: getGroupEvents(groupId),
  }
}

// Support right to deletion
function deleteGroupData(groupId) {
  // Remove group and all associated data
  analytics.track('Group Data Deleted', {
    groupId: groupId,
    deletedAt: new Date().toISOString(),
  })
}
```

## Validation and Errors

### Common Validation Errors

#### Missing Group ID

```json
{
  "error": {
    "type": "validation_error",
    "message": "Missing required field: groupId"
  }
}
```

#### Invalid Group ID Format

```json
{
  "error": {
    "type": "validation_error",
    "message": "Group ID cannot contain spaces or special characters"
  }
}
```

### Pre-send Validation

```javascript
function validateGroupCall(groupId, traits) {
  if (!groupId || groupId.length === 0) {
    throw new Error('Group ID is required')
  }

  if (groupId.length > 255) {
    throw new Error('Group ID too long (max 255 characters)')
  }

  if (traits && Object.keys(traits).length > 255) {
    throw new Error('Too many traits (max 255)')
  }
}
```

## Performance Considerations

### Batching Group Updates

```javascript
// Batch group updates for efficiency
const groupUpdates = [
  {
    groupId: 'company_a',
    traits: { employees: 150, plan: 'pro' },
  },
  {
    groupId: 'company_b',
    traits: { revenue: 5000000, industry: 'retail' },
  },
]

groupUpdates.forEach((update) => {
  analytics.group(update.groupId, update.traits)
})
```

### Conditional Group Updates

```javascript
// Only update when traits change
function updateGroupIfChanged(groupId, newTraits, currentTraits) {
  const changes = {}

  for (const [key, value] of Object.entries(newTraits)) {
    if (currentTraits[key] !== value) {
      changes[key] = value
    }
  }

  if (Object.keys(changes).length > 0) {
    analytics.group(groupId, {
      ...changes,
      updatedAt: new Date().toISOString(),
    })
  }
}
```

## Best Practices

### Group Identification

- Use consistent, descriptive group IDs
- Include group type in ID when managing multiple group types
- Document your group ID schema and naming conventions

### Trait Management

- Set comprehensive traits at group creation
- Update traits when group information changes
- Use reserved traits for their intended purpose

### Data Quality

- Validate group data before sending
- Normalize group attributes (industry names, etc.)
- Maintain referential integrity between users and groups

### Analytics

- Design group structure to support your analysis needs
- Include relevant business metrics as traits
- Track group lifecycle events (created, updated, deleted)

## Next Steps

- Explore [Alias method](./07-alias.md) for identity management
- Review [Common Fields](./08-common-fields.md) for payload structure
- Understand [Data Model](./09-data-model.md) for relationship mapping
