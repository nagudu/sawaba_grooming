export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_PATTERN = /^\+?[\d\s()-]{7,}$/

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export function validateField(
  _name: string,
  value: string,
  rules: { required?: boolean; email?: boolean; phone?: boolean; min?: number },
): string {
  const trimmed = value.trim()
  if (rules.required && (!trimmed || trimmed.length === 0)) {
    return 'This field is required.'
  }
  if (trimmed && rules.email && !EMAIL_PATTERN.test(trimmed)) {
    return 'Please enter a valid email address.'
  }
  if (trimmed && rules.phone && !PHONE_PATTERN.test(trimmed)) {
    return 'Please enter a valid phone number.'
  }
  if (rules.min && trimmed.length > 0 && trimmed.length < rules.min) {
    return `Please enter at least ${rules.min} characters.`
  }
  return ''
}