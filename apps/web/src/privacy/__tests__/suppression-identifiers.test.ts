import { describe, expect, it } from 'vitest'

import { getSuppressionIdentifiers } from '../suppression-identifiers'

describe('getSuppressionIdentifiers', () => {
  it('checks both identified and anonymous identities before delivery', () => {
    expect(
      getSuppressionIdentifiers({
        type: 'track',
        event: 'Viewed',
        userId: 'user-123',
        anonymousId: 'anonymous-123',
      })
    ).toEqual(['user-123', 'anonymous-123'])
  })

  it('checks both sides of an alias edge', () => {
    expect(
      getSuppressionIdentifiers({
        type: 'alias',
        userId: 'canonical-user',
        previousId: 'previous-user',
      })
    ).toEqual(['canonical-user', 'previous-user'])
  })
})
