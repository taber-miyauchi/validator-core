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

**Result:** When scip-typescript indexes a consumer repo, it resolves imports to the `.d.ts` files in `node_modules/` and does NOT follow declaration maps to trace back to original source paths. The generated symbol references point to `dist/*.d.ts` paths, which don't match the `src/*.ts` paths in the library's own SCIP index. (Note: Sourcegraph removed support for indexing npmjs.com packages directly, so cross-repo linking depends entirely on matching symbol paths between separately-indexed repos.)

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

2. Make dependencies resolvable:
   - **We used:** Publish to npm with source files included (`"files": ["src", "dist"]`), then reference by version
   - **Alternative (untested with this fix):** Use `file:../sibling-repo` references and checkout repos as siblings in CI. This was tried earlier (Approach 3) but without the source-pointing fix, so it may work if combined with step 1.

   > **Note:** Publishing to npm is NOT required for cross-repo navigation. What matters is that when scip-typescript runs, it can resolve imports to source files (not `.d.ts` files).

3. Verify repos are synced and up to date in Sourcegraph before triggering indexing.

4. Trigger SCIP indexing on tagged commits in dependency order:
   - validator-core first
   - validator-schemas second  
   - validator-service last

5. Verify in Sourcegraph that "Go to Definition" jumps across repos
