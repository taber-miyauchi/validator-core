# validator-core

## Project Structure

```
├── validator-core/           ← The foundation (you are here)
│   ├── package.json
│   ├── src/
│   │   ├── index.ts          ← Re-exports all types
│   │   ├── types.ts          ← ValidationResult, ValidationError
│   │   └── validator.ts      ← Validator<T> interface
│   └── README.md
│
├── validator-schemas/        ← Implementation
│   ├── package.json          ← depends on validator-core
│   ├── src/
│   │   ├── email-validator.ts    ← EmailValidator implements Validator
│   │   ├── phone-validator.ts    ← PhoneValidator implements Validator
│   │   └── url-validator.ts      ← URLValidator implements Validator
│   └── README.md
│
└── validator-service/        ← Consumer/API
    ├── package.json          ← depends on both
    ├── src/
    │   ├── index.ts          ← Express server using validators
    │   └── middleware.ts     ← Generic validation middleware
    └── README.md
```

## Overview

Core TypeScript library defining the `Validator<T>` interface and shared types for the validation system.

## Types

- **`Validator<T>`** - Generic interface that all validator implementations must satisfy
- **`ValidationResult<T>`** - Result object containing success status, validated value, and errors
- **`ValidationError`** - Error details with field name, message, and error code

## Usage

This package is imported by:
- `validator-schemas` - Implements the `Validator` interface for email, phone, and URL validation
- `validator-service` - Uses the interface and types in Express middleware to validate API requests

## Testing Precise Code Navigation

Open this repo in Sourcegraph and try the following:

### 1. Find Implementations (cross-repo interface)

Discover all implementations of an interface across separate repositories.

- In `validator.ts`, click on `validate` method (line 14) → **Find Implementations**
- → Highlights `validate` (line 9) in `validator-schemas/src/email-validator.ts`
- → Highlights `validate` (line 9) in `validator-schemas/src/phone-validator.ts`
- → Highlights `validate` (line 7) in `validator-schemas/src/url-validator.ts`

**Benefit:** Instantly see which repos provide concrete implementations of your interface—critical for understanding the full scope of a plugin or adapter pattern across a microservices architecture.

### 2. Find References (cross-repo type)

Locate all usages of a shared type across multiple repositories.

- In `types.ts`, click on `ValidationResult` interface (line 14) → **Find References**
- → Highlights usage in 14 places which includes:
- → Highlights `ValidationResult` (line 14) in `validator-core/src/validator.ts`
- → Highlights `ValidationResult` (line 9) in `validator-schemas/src/email-validator.ts`
- → Highlights `ValidationResult` (line 13) in `validator-service/src/middleware.ts`

**Benefit:** Understand the impact radius of changing a shared data structure—see every repo and every call site that would be affected before making breaking changes.
