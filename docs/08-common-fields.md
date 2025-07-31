// Valid property structure
const validProperties = {
"productId": "12345", // ✓ String
"price": 99.99, // ✓ Number
"inStock": true, // ✓ Boolean
"categories": ["electronics", "mobile"], // ✓ Array
"details": { // ✓ Object (level 1)
"specs": { // ✓ Object (level 2)
"storage": "128GB", // ✓ Object (level 3)
"nested": { // ✗ Too deep (level 4)
"tooDeep": "value"
}
}
}
};

// Invalid examples
const invalidProperties = {
"": "value", // ✗ Empty property name
"very".repeat(100), "value", // ✗ Property name too long
"undefined": undefined, // ✗ Undefined value
"function": () => {}, // ✗ Function value
"date": new Date() as any // ✗ Date object (use ISO string)
};
