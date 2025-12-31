# Cross-Repository Precise Code Navigation for TypeScript

This document summarizes findings from attempting to set up Sourcegraph Precise Code Navigation across multiple TypeScript npm packages.

## Architecture

```
validator-core          ← Interfaces + types (Validator<T>, ValidationResult, ValidationError)
    ↑
validator-schemas       ← Implementations (EmailValidator, PhoneValidator, URLValidator)
    ↑
validator-service       ← Consumer (Express API using validators)
```

## The Core Problem

When `scip-typescript` indexes a TypeScript project, it generates symbol identifiers like:

```
scip-typescript npm <package-name> <version> <file-path>/<symbol>
```

For cross-repo navigation to work, **the symbol identifiers must match exactly** between the repo that defines a symbol and the repo that references it.

### Symbol Mismatch Issue

| Source (validator-core) | Consumer (validator-schemas) |
|-------------------------|------------------------------|
| `src/types.ts/ValidationResult#` | `dist/types.d.ts/ValidationResult#` |

The file paths differ (`src/` vs `dist/`), so Sourcegraph can't match the symbols, and cross-repo navigation falls back to search-based.

---

## Approaches Tried

### Approach 1: Declaration Maps (Did NOT Work)

Added `declarationMap: true` to generate `.d.ts.map` files that map compiled declarations back to source.

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

**Result:** scip-typescript does NOT follow declaration maps when indexing external npm packages. Verified with `scip print index.scip` — consumers still reference `dist/*.d.ts` paths.

---

### Approach 2: tsconfig.scip.json (Did NOT Work)

Created a separate tsconfig for SCIP indexing that includes only `dist/**/*.d.ts`:

```json
{
  "compilerOptions": {
    "noEmit": true,
    "moduleResolution": "node"
  },
  "include": ["dist/**/*.d.ts"]
}
```

**Theory:** Make library repos index their `dist/` files so both definition and reference use `dist/` paths.

**Result:** Did not produce working cross-repo navigation.

---

### Approach 3: file: References with Sibling Checkout (Did NOT Work)

Changed package.json to use `file:` references instead of npm versions:

```json
{
  "dependencies": {
    "@taber-miyauchi/validator-core": "file:../validator-core"
  }
}
```

Updated SCIP workflow to checkout sibling repos:

```yaml
- uses: actions/checkout@v4
  with:
    path: validator-schemas

- uses: actions/checkout@v4
  with:
    repository: taber-miyauchi/validator-core
    path: validator-core
```

**Theory:** With repos as siblings, scip-typescript can resolve directly to source files, generating matching `src/` paths for both definition and reference.

**Result:** Did not produce working cross-repo navigation.

---

## Working Reference: acme-shop Repos

The following repos have working cross-repo navigation:
- `github.com/tm-acme-shop/acme-shop-shared-ts`
- `github.com/tm-acme-shop/acme-shop-frontend-web`

Key differences observed:
- Uses GitHub Package Registry (not npmjs.com)
- Uses `file:` references
- Has `tsconfig.scip.json` indexing `dist/**/*.d.ts`
- Has `declarationMap: true`
- Main/types point to source: `"main": "src/index.ts"`

Unclear which combination of these factors enables cross-repo navigation.

---

## Next Steps to Try

1. **Point main/types to source instead of dist**
   ```json
   {
     "main": "src/index.ts",
     "types": "src/index.ts"
   }
   ```

2. **Use GitHub Package Registry** instead of npmjs.com (matches working repos)

3. **Combine all acme-shop patterns**: file: refs + tsconfig.scip.json + declarationMap + src-pointing main/types

4. **Check Sourcegraph configuration** for npm package host mappings

5. **File an issue with scip-typescript** about cross-repo npm package navigation

---

## Current Status

❌ Cross-repo precise navigation NOT working  
✅ Same-repo precise navigation works  
✅ Search-based cross-repo navigation works (fallback)
