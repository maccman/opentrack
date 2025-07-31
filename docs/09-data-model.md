// User previously identified and grouped
analytics.identify('user_12345', {})
analytics.group('company_acme', {})

// Subsequent events automatically attributed
analytics.track('Feature Used'); // Attributed to user and group
