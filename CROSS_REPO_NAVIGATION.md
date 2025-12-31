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

### Approach 4: Point main/types to Source (WORKED ✅)

Changed package.json to point `main` and `types` to source files instead of compiled output:

```json
{
  "main": "src/index.ts",
  "types": "src/index.ts",
  "files": ["src", "dist"]
}
```

**Theory:** When scip-typescript resolves dependencies, it follows the `main`/`types` fields. By pointing these to source files, both the defining repo and consuming repo generate identical symbol paths like `src/types.ts/ValidationResult#`.

**Result:** ✅ Cross-repo precise navigation works! "Go to Definition" and "Find References" now function correctly across all three repos.

---

## Why This Fix Works

The root cause is **symbol path mismatch** in SCIP indexes.

When `main`/`types` pointed to **dist** (compiled):
```
validator-core index:     src/types.ts/ValidationResult#
validator-schemas index:  node_modules/.../dist/types.d.ts/ValidationResult#
```
→ Paths don't match, Sourcegraph can't link them.

When `main`/`types` pointed to **src** (source):
```
validator-core index:     src/types.ts/ValidationResult#
validator-schemas index:  node_modules/.../src/types.ts/ValidationResult#
```
→ Paths match, cross-repo navigation works.

---

## ⚠️ Important: This is a Workaround, Not Best Practice

Shipping source files via `main`/`types` is **non-standard** and has drawbacks:

| Issue | Impact |
|-------|--------|
| Package size bloat | Source + compiled files both shipped |
| TypeScript version coupling | Consumers may need compatible TS versions |
| Node.js compatibility | Node can't run `.ts` directly without ts-node |
| Source exposure | Some organizations prefer not to ship source |

### Standard Production Approach

Most npm packages use:
```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

### Proper Solutions (Not Yet Fully Supported)

1. **Monorepo with local file: references** — Works because scip-typescript sees actual source during indexing, but requires all repos in same workspace

2. **Sourcegraph package host configuration** — Map npm packages to GitHub repos at the Sourcegraph level (requires admin configuration)

3. **Declaration map support in scip-typescript** — TypeScript's `declarationMap: true` creates `.d.ts.map` files that could theoretically link declarations back to source, but scip-typescript doesn't currently follow these maps

### Recommended Tooling Improvements

The underlying issue is that **scip-typescript generates different symbol identifiers for `.d.ts` files vs `.ts` source files**, even when they represent the same logical types. Potential fixes:

1. **scip-typescript enhancement**: Follow declaration maps (`.d.ts.map`) to resolve symbols back to their original source paths

2. **Sourcegraph symbol resolution**: Normalize symbols so `dist/types.d.ts/ValidationResult` and `src/types.ts/ValidationResult` are treated as equivalent

3. **npm package host intelligence**: Automatically map npm package symbols to their source repository counterparts using `repository` field in package.json

---

## Current Status

✅ Cross-repo precise navigation WORKING (with source-pointing workaround)  
✅ Same-repo precise navigation works  
✅ Search-based cross-repo navigation works (fallback)

---

## Summary of Approaches

| Approach | Result | Notes |
|----------|--------|-------|
| Declaration maps (`declarationMap: true`) | ❌ | scip-typescript doesn't follow .d.ts.map files |
| tsconfig.scip.json for dist | ❌ | Did not produce matching symbols |
| file: references with sibling checkout | ❌ | Complex setup, didn't work |
| **Point main/types to source** | ✅ | Works but non-standard |

---

## Reproduction

To reproduce this setup:

1. Configure all packages with source-pointing entries:
   ```json
   {
     "main": "src/index.ts",
     "types": "src/index.ts",
     "files": ["src", "dist"]
   }
   ```

2. Publish to npm in dependency order

3. Trigger SCIP indexing on tagged commits in dependency order:
   - validator-core first
   - validator-schemas second  
   - validator-service last

4. Verify in Sourcegraph that "Go to Definition" jumps across repos
