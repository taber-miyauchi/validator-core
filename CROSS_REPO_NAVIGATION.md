# Cross-Repository Precise Code Navigation for TypeScript

This document summarizes findings from setting up Sourcegraph Precise Code Navigation across multiple TypeScript npm packages.

## Architecture

```
validator-core          ← Interfaces + types (Validator<T>, ValidationResult, ValidationError)
    ↑
validator-schemas       ← Implementations (EmailValidator, PhoneValidator, URLValidator)
    ↑
validator-service       ← Consumer (Express API using validators)
```

## How SCIP Symbol Identifiers Work

When `scip-typescript` indexes a TypeScript project, it generates symbol identifiers in this format:

```
scip-typescript npm <package-name> <version> <file-path>/<symbol>
```

Example:
```
scip-typescript npm @taber-miyauchi/validator-core 0.2.0 src/`types.ts`/ValidationResult#
```

For cross-repo navigation to work, **the symbol identifiers must match exactly** between:
- The repo that **defines** the symbol
- The repo that **references** the symbol

## The Problem We Encountered

When indexing `validator-service`, scip-typescript saw types from `node_modules`:

| Source (validator-core) | Consumer (validator-service) |
|-------------------------|------------------------------|
| `src/types.ts/ValidationResult#` | `dist/types.d.ts/ValidationResult#` |

The file paths differ (`src/` vs `dist/`), so Sourcegraph couldn't match the symbols, and cross-repo navigation fell back to search-based.

## The Solution: Declaration Maps

Adding `declarationMap: true` to `tsconfig.json` generates `.d.ts.map` files that tell TypeScript (and scip-typescript) the original source location of each declaration.

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

With declaration maps, scip-typescript can trace:
```
dist/types.d.ts → src/types.ts
```

And generate matching symbol identifiers:
```
src/types.ts/ValidationResult#  (both repos)
```

## Role of npm Packages

The npm packages are **not indexed in Sourcegraph**. Only the GitHub repositories are indexed.

npm packages serve as:

1. **Symbol namespace** — The package name (`@taber-miyauchi/validator-core`) becomes part of every symbol identifier
2. **Distribution mechanism** — Delivers `.d.ts` and `.d.ts.map` files to consuming repos
3. **Version coordination** — Ensures all repos reference the same version for matching symbols

## Required Configuration

### tsconfig.json (all repos)
```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

### package.json (library repos)
Include both `dist` and optionally `src` in files:
```json
{
  "files": ["dist"]
}
```

Note: The `src` folder doesn't need to be published since declaration maps reference source files by path, not by actual file content. The important thing is that the `.d.ts.map` files are included in `dist/`.

## Publishing & Indexing Order

Must follow dependency order:

1. **Publish to npm**: core → schemas → service
2. **Push to GitHub and tag**: all repos with matching version (e.g., v0.2.0)
3. **Trigger SCIP indexing**: core → schemas → service (on tags, not main)

## Verifying It Works

After SCIP indexing completes, test in Sourcegraph:

### From validator-service
- Click `Validator<string>` → should show "Precise" and jump to validator-core
- Click `EmailValidator` → should show "Precise" and jump to validator-schemas

### From validator-core
- Click "Find Implementations" on `Validator<T>` → should list implementations in validator-schemas
- Click "Find References" on `ValidationResult` → should show usages in all three repos

## Key Lessons

1. **Symbol identifiers include file paths** — Source and consumer must generate the same path
2. **Declaration maps bridge the gap** — They let scip-typescript trace `.d.ts` back to `.ts`
3. **npm packages provide identity, not indexing** — The package name is the namespace for symbols
4. **Version alignment is critical** — Tagged commits must match the npm version that dependents reference
5. **Index in dependency order** — Base libraries first, consumers last
