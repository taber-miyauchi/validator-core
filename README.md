# @taber-miyauchi/validator-core

Core validation interfaces and types for the cross-repository SCIP navigation demo.

## Installation

```bash
npm install @taber-miyauchi/validator-core
```

## Usage

```typescript
import { Validator, ValidationResult, ValidationError } from '@taber-miyauchi/validator-core';

// Implement the Validator interface
class MyValidator implements Validator<string> {
  validate(input: unknown): ValidationResult<string> {
    if (typeof input !== 'string') {
      return {
        valid: false,
        errors: [{ field: 'input', message: 'Must be a string', code: 'INVALID_TYPE' }]
      };
    }
    return { valid: true, value: input, errors: [] };
  }
}
```

## Exports

| Symbol | Type | Description |
|--------|------|-------------|
| `Validator<T>` | interface | Generic validator interface with `validate()` method |
| `ValidationResult<T>` | interface | Result of validation (valid, value, errors) |
| `ValidationError` | interface | Error details (field, message, code) |

## Testing Precise Code Navigation

After SCIP indexing, test these navigation features in Sourcegraph:

### Find Implementations
- Click on `Validator<T>` interface → should show implementations in `validator-schemas`

### Find References
- Click on `ValidationResult` → should show usages in `validator-schemas` and `validator-service`
- Click on `ValidationError` → should show usages across all repos

## Development

```bash
npm install
npm run build
```

## License

MIT
