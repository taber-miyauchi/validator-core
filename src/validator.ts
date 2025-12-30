import { ValidationResult } from './types';

/**
 * Generic validator interface.
 * Implementations must provide a validate method that checks input
 * and returns a ValidationResult.
 */
export interface Validator<T> {
  /**
   * Validates the input value.
   * @param input - The value to validate
   * @returns ValidationResult containing success/failure and any errors
   */
  validate(input: unknown): ValidationResult<T>;
}
