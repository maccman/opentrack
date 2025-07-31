import { describe, expect, it } from 'vitest'
import { convertToSnakeCase, eventNameToTableName } from '../case-converter'

describe('convertToSnakeCase', () => {
  it('should convert camelCase to snake_case', () => {
    expect(convertToSnakeCase('camelCase')).toBe('camel_case')
    expect(convertToSnakeCase('firstName')).toBe('first_name')
    expect(convertToSnakeCase('userID')).toBe('user_id')
  })

  it('should convert PascalCase to snake_case', () => {
    expect(convertToSnakeCase('PascalCase')).toBe('pascal_case')
    expect(convertToSnakeCase('FirstName')).toBe('first_name')
    expect(convertToSnakeCase('UserProfile')).toBe('user_profile')
  })

  it('should handle strings that are already snake_case', () => {
    expect(convertToSnakeCase('snake_case')).toBe('snake_case')
    expect(convertToSnakeCase('user_id')).toBe('user_id')
    expect(convertToSnakeCase('first_name')).toBe('first_name')
  })

  it('should handle single words', () => {
    expect(convertToSnakeCase('user')).toBe('user')
    expect(convertToSnakeCase('ID')).toBe('id')
    expect(convertToSnakeCase('a')).toBe('a')
  })

  it('should handle empty strings', () => {
    expect(convertToSnakeCase('')).toBe('')
  })

  it('should handle strings with numbers', () => {
    expect(convertToSnakeCase('user123')).toBe('user_123')
    expect(convertToSnakeCase('userId2')).toBe('user_id_2')
    expect(convertToSnakeCase('API2Version')).toBe('api_2_version')
  })

  it('should handle consecutive uppercase letters', () => {
    expect(convertToSnakeCase('XMLParser')).toBe('xml_parser')
    expect(convertToSnakeCase('HTTPSConnection')).toBe('https_connection')
    expect(convertToSnakeCase('URLPath')).toBe('url_path')
  })
})

describe('eventNameToTableName', () => {
  it('should convert simple event names', () => {
    expect(eventNameToTableName('Order Completed')).toBe('order_completed')
    expect(eventNameToTableName('Page Viewed')).toBe('page_viewed')
    expect(eventNameToTableName('User Signed Up')).toBe('user_signed_up')
  })

  it('should handle special characters', () => {
    expect(eventNameToTableName('Product-Added!')).toBe('product_added')
    expect(eventNameToTableName('Cart & Checkout')).toBe('cart_checkout')
    expect(eventNameToTableName('Email@Sent')).toBe('email_sent')
  })

  it('should handle numbers and mixed case', () => {
    expect(eventNameToTableName('Level 5 Completed')).toBe('level_5_completed')
    expect(eventNameToTableName('API_Call_Success')).toBe('api_call_success')
    expect(eventNameToTableName('HTTPSRedirect')).toBe('httpsredirect')
  })

  it('should handle multiple spaces and underscores', () => {
    expect(eventNameToTableName('Multiple   Spaces')).toBe('multiple_spaces')
    expect(eventNameToTableName('__Leading__Trailing__')).toBe('leading_trailing')
    expect(eventNameToTableName('Mixed _ _ Separators')).toBe('mixed_separators')
  })

  it('should handle edge cases', () => {
    expect(eventNameToTableName('')).toBe('')
    expect(eventNameToTableName('___')).toBe('')
    expect(eventNameToTableName('123')).toBe('123')
    expect(eventNameToTableName('A')).toBe('a')
  })

  it('should handle real-world event names', () => {
    expect(eventNameToTableName('Product Purchased')).toBe('product_purchased')
    expect(eventNameToTableName('Email Link Clicked')).toBe('email_link_clicked')
    expect(eventNameToTableName('Account Created')).toBe('account_created')
    expect(eventNameToTableName('Form Submitted')).toBe('form_submitted')
    expect(eventNameToTableName('Video Played')).toBe('video_played')
  })

  it('should handle event names with punctuation', () => {
    expect(eventNameToTableName("User's Profile Updated")).toBe('user_s_profile_updated')
    expect(eventNameToTableName('Order #12345 Completed')).toBe('order_12345_completed')
    expect(eventNameToTableName('Item (Sale) Added')).toBe('item_sale_added')
  })
})
