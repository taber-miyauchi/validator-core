/**
 * Represents a validation error with details about what failed.
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Result of a validation operation.
 * Contains the validated value on success, or errors on failure.
 */
export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  errors: ValidationError[];
}
