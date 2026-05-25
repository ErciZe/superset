# Noway Table V1 Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `noway table v1` independently maintainable inside `plugin-chart-ag-grid-table-scheme` so upstream official AG Grid Table changes do not conflict with internal noway behavior.

**Architecture:** Copy the currently working AG Grid Table runtime into a scheme-local `src/table` namespace, then switch scheme imports to that local runtime. After the scheme plugin is self-contained, restore the official `plugin-chart-ag-grid-table` files by removing noway-only toolbar and cell-formatting extension points.

**Tech Stack:** Superset frontend, React, TypeScript, Jest, React Testing Library, ESLint, AG Grid through `@superset-ui/core/components/ThemedAgGridReact`.

---

## File Structure

Create under `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/`:

- `AgGridTableChart.tsx`: local chart shell currently provided by official AG Grid Table.
- `AgGridTable/index.tsx`: local AG Grid rendering wrapper with noway column-view toolbar support.
- `AgGridTable/components/*`: local table toolbar, filtering, pagination, and header components.
- `buildQuery.ts`: local base table query builder used by matrix mode.
- `controlPanel.tsx`: local base table controls used as the noway control-panel base.
- `transformProps.ts`: local base table transform used before matrix transformation.
- `types.ts`: local table form-data, transformed-prop, and column metadata types.
- `consts.ts`, `styles/index.tsx`, `utils/*`, `renderers/*`: local runtime support files.
- `images/Table.jpg`, `images/Table2.jpg`, `images/Table3.jpg`, `images/thumbnail.png`: local metadata assets.

Modify existing scheme files:

- `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/AgGridTableSchemeChart.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/controlPanel.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/index.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/transformProps.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/buildQuery.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/cellFormatter.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/matrixTransform.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/types.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/package.json`

Modify official AG Grid Table only after noway imports are local:

- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/AgGridTable/index.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/AgGridTableChart.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/renderers/NumericCellRenderer.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/renderers/TextCellRenderer.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/types.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/utils/getCellStyle.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/utils/useColDefs.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/images/thumbnail-dark.png`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/test/renderers/cellFormatterRenderers.test.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/test/utils/getCellStyle.test.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/test/utils/useColDefs.test.tsx`

## Task 1: Add Isolation Guard Test

**Files:**

- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/isolation.test.ts`

- [ ] **Step 1: Write the failing isolation test**

Create `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/isolation.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const sourceRoot = path.resolve(__dirname, '../src');

const disallowedImports = [
  '../../plugin-chart-ag-grid-table/src/',
  '../../../plugin-chart-ag-grid-table/src/',
  '@superset-ui/plugin-chart-ag-grid-table/src/',
];

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap(entry => {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return collectSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });

test('noway table v1 does not import official AG Grid Table internals', () => {
  const offenders = collectSourceFiles(sourceRoot).flatMap(file => {
    const source = readFileSync(file, 'utf8');
    return disallowedImports
      .filter(disallowedImport => source.includes(disallowedImport))
      .map(disallowedImport => ({
        file: path.relative(sourceRoot, file),
        disallowedImport,
      }));
  });

  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `superset-frontend`:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-ag-grid-table-scheme/test/isolation.test.ts \
  --runInBand
```

Expected: FAIL. The failure should list current imports from `plugin-chart-ag-grid-table/src`.

- [ ] **Step 3: Commit the failing guard test**

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/test/isolation.test.ts
git commit -m "test(noway-table): guard official table isolation"
```

## Task 2: Create Scheme-Local Table Runtime

**Files:**

- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/**`
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/images/**`

- [ ] **Step 1: Copy the current working runtime into the scheme plugin**

Run from `superset-frontend`:

```bash
mkdir -p plugins/plugin-chart-ag-grid-table-scheme/src/table
cp -R plugins/plugin-chart-ag-grid-table/src/AgGridTable \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTable
cp plugins/plugin-chart-ag-grid-table/src/AgGridTableChart.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTableChart.tsx
cp plugins/plugin-chart-ag-grid-table/src/buildQuery.ts \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/buildQuery.ts
cp plugins/plugin-chart-ag-grid-table/src/consts.ts \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/consts.ts
cp plugins/plugin-chart-ag-grid-table/src/controlPanel.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/controlPanel.tsx
cp -R plugins/plugin-chart-ag-grid-table/src/renderers \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/renderers
cp -R plugins/plugin-chart-ag-grid-table/src/styles \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/styles
cp plugins/plugin-chart-ag-grid-table/src/transformProps.ts \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/transformProps.ts
cp plugins/plugin-chart-ag-grid-table/src/types.ts \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts
cp -R plugins/plugin-chart-ag-grid-table/src/utils \
  plugins/plugin-chart-ag-grid-table-scheme/src/table/utils
mkdir -p plugins/plugin-chart-ag-grid-table-scheme/src/images
cp plugins/plugin-chart-ag-grid-table/src/images/Table.jpg \
  plugins/plugin-chart-ag-grid-table-scheme/src/images/Table.jpg
cp plugins/plugin-chart-ag-grid-table/src/images/Table2.jpg \
  plugins/plugin-chart-ag-grid-table-scheme/src/images/Table2.jpg
cp plugins/plugin-chart-ag-grid-table/src/images/Table3.jpg \
  plugins/plugin-chart-ag-grid-table-scheme/src/images/Table3.jpg
cp plugins/plugin-chart-ag-grid-table/src/images/thumbnail.png \
  plugins/plugin-chart-ag-grid-table-scheme/src/images/thumbnail.png
```

- [ ] **Step 2: Verify the copied runtime has no broken relative imports**

Run from `superset-frontend`:

```bash
rg -n "from ['\"]\\.\\./\\.\\./|from ['\"]\\.\\./\\.\\./\\.\\./" \
  plugins/plugin-chart-ag-grid-table-scheme/src/table
```

Expected: no output.

- [ ] **Step 3: Commit the copied runtime**

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/src/table \
  plugins/plugin-chart-ag-grid-table-scheme/src/images
git commit -m "feat(noway-table): add local table runtime"
```

## Task 3: Switch Noway Table Imports To Local Runtime

**Files:**

- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/AgGridTableSchemeChart.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/controlPanel.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/index.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/transformProps.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/buildQuery.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/cellFormatter.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/matrixTransform.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/types.ts`

- [ ] **Step 1: Rewrite import sources**

Apply these replacements:

```text
src/AgGridTableSchemeChart.tsx
- @superset-ui/plugin-chart-ag-grid-table/src/AgGridTableChart
+ ./table/AgGridTableChart
- @superset-ui/plugin-chart-ag-grid-table/src/types
+ ./table/types

src/controlPanel.tsx
- ../../plugin-chart-ag-grid-table/src/controlPanel
+ ./table/controlPanel

src/index.ts
- ../../plugin-chart-ag-grid-table/src/images/thumbnail.png
+ ./images/thumbnail.png
- ../../plugin-chart-ag-grid-table/src/images/Table.jpg
+ ./images/Table.jpg
- ../../plugin-chart-ag-grid-table/src/images/Table2.jpg
+ ./images/Table2.jpg
- ../../plugin-chart-ag-grid-table/src/images/Table3.jpg
+ ./images/Table3.jpg
- ../../plugin-chart-ag-grid-table/src/types
+ ./table/types

src/transformProps.ts
- ../../plugin-chart-ag-grid-table/src/transformProps
+ ./table/transformProps
- ../../plugin-chart-ag-grid-table/src/types
+ ./table/types
- ../../plugin-chart-ag-grid-table/src/utils/DateWithFormatter
+ ./table/utils/DateWithFormatter

src/matrix/buildQuery.ts
- ../../../plugin-chart-ag-grid-table/src/buildQuery
+ ../table/buildQuery
- ../../../plugin-chart-ag-grid-table/src/types
+ ../table/types

src/matrix/cellFormatter.ts
- ../../../plugin-chart-ag-grid-table/src/types
+ ../table/types

src/matrix/matrixTransform.ts
- ../../../plugin-chart-ag-grid-table/src/types
+ ../table/types

src/matrix/types.ts
- ../../../plugin-chart-ag-grid-table/src/types
+ ../table/types
```

- [ ] **Step 2: Keep local type re-exports in `src/index.ts`**

Ensure the bottom of the import/export block in `src/index.ts` uses the local table types:

```ts
import type { TableChartFormData, TableChartProps } from './table/types';
import controlPanel from './controlPanel';
import buildQuery from './matrix/buildQuery';
import transformProps from './transformProps';

export { default as __hack__ } from './table/types';
export * from './table/types';
```

- [ ] **Step 3: Run the isolation guard**

Run from `superset-frontend`:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-ag-grid-table-scheme/test/isolation.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run existing noway transform and matrix tests**

Run from `superset-frontend`:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-ag-grid-table-scheme/test/transformProps.test.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/matrix/buildQuery.test.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/matrix/cellFormatter.test.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/matrix/matrixTransform.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the import switch**

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/src
git commit -m "refactor(noway-table): use local table runtime"
```

## Task 4: Remove Package-Level Dependency On Official Table

**Files:**

- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/package.json`

- [ ] **Step 1: Remove the official table dependency**

Change the dependency block from:

```json
  "dependencies": {
    "@superset-ui/plugin-chart-ag-grid-table": "file:../plugin-chart-ag-grid-table",
    "react-sortable-hoc": "^2.0.0"
  },
```

to:

```json
  "dependencies": {
    "react-sortable-hoc": "^2.0.0"
  },
```

- [ ] **Step 2: Verify no scheme file imports the official package**

Run from `superset-frontend`:

```bash
rg -n "plugin-chart-ag-grid-table" \
  plugins/plugin-chart-ag-grid-table-scheme
```

Expected: no output.

- [ ] **Step 3: Run the package index test**

Run from `superset-frontend`:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-ag-grid-table-scheme/test/index.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 4: Commit the dependency removal**

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/package.json
git commit -m "chore(noway-table): remove official table dependency"
```

## Task 5: Move Noway Formatter Runtime Tests Into Scheme Plugin

**Files:**

- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/cellFormatterRenderers.test.tsx`
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/getCellStyle.test.ts`
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx`

- [ ] **Step 1: Copy noway-only official table tests into the scheme plugin**

Run from `superset-frontend`:

```bash
mkdir -p plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers
mkdir -p plugins/plugin-chart-ag-grid-table-scheme/test/table/utils
cp plugins/plugin-chart-ag-grid-table/test/renderers/cellFormatterRenderers.test.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/cellFormatterRenderers.test.tsx
cp plugins/plugin-chart-ag-grid-table/test/utils/getCellStyle.test.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/getCellStyle.test.ts
cp plugins/plugin-chart-ag-grid-table/test/utils/useColDefs.test.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx
```

- [ ] **Step 2: Rewrite copied test imports**

Use these import paths:

```text
test/table/renderers/cellFormatterRenderers.test.tsx
../../../src/table/renderers/NumericCellRenderer
../../../src/table/renderers/TextCellRenderer

test/table/utils/getCellStyle.test.ts
../../../src/table/utils/getCellStyle

test/table/utils/useColDefs.test.tsx
../../../src/table/utils/useColDefs
```

- [ ] **Step 3: Run the moved tests**

Run from `superset-frontend`:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/cellFormatterRenderers.test.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/getCellStyle.test.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx \
  --runInBand
```

Expected: PASS.

- [ ] **Step 4: Commit moved tests**

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/test/table
git commit -m "test(noway-table): cover local table formatter runtime"
```

## Task 6: Clean Official AG Grid Table Back To Non-Noway Shape

**Files:**

- Modify: official AG Grid Table source files listed in the file structure section.
- Delete: official noway-only tests listed in the file structure section.

- [ ] **Step 1: Restore official table source files to the branch base**

Run from repository root:

```bash
BASE="$(git merge-base HEAD origin/master)"
git restore --source="$BASE" -- \
  superset-frontend/plugins/plugin-chart-ag-grid-table/src/AgGridTable/index.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table/src/AgGridTableChart.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table/src/controlPanel.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table/src/renderers/NumericCellRenderer.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table/src/renderers/TextCellRenderer.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table/src/transformProps.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table/src/utils/getCellStyle.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table/src/utils/useColDefs.ts
rm -f superset-frontend/plugins/plugin-chart-ag-grid-table/src/images/thumbnail-dark.png
rm -f superset-frontend/plugins/plugin-chart-ag-grid-table/test/renderers/cellFormatterRenderers.test.tsx
rm -f superset-frontend/plugins/plugin-chart-ag-grid-table/test/utils/getCellStyle.test.ts
rm -f superset-frontend/plugins/plugin-chart-ag-grid-table/test/utils/useColDefs.test.tsx
```

- [ ] **Step 2: Verify no noway-only extension points remain in official table**

Run from repository root:

```bash
rg -n "renderColumnViewToolbar|columnViewToolbarHeight|additionalCellStyle|additionalCellFormatter" \
  superset-frontend/plugins/plugin-chart-ag-grid-table
```

Expected: no output.

- [ ] **Step 3: Verify noway table still owns those extension points locally**

Run from repository root:

```bash
rg -n "renderColumnViewToolbar|columnViewToolbarHeight|additionalCellStyle|additionalCellFormatter" \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src
```

Expected: matches only under `plugin-chart-ag-grid-table-scheme/src`.

- [ ] **Step 4: Run official table smoke tests**

Run from `superset-frontend`:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-ag-grid-table/test \
  --runInBand
```

Expected: PASS. If baseline official table tests unrelated to removed noway extensions fail, record the exact failing test names before continuing.

- [ ] **Step 5: Commit official table cleanup**

```bash
git add plugins/plugin-chart-ag-grid-table
git commit -m "refactor(ag-grid-table): remove noway-only extensions"
```

## Task 7: Focused Integration Validation

**Files:**

- No code changes.

- [ ] **Step 1: Run the full scheme plugin test suite**

Run from `superset-frontend`:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-ag-grid-table-scheme/test \
  --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run ESLint on changed noway table files**

Run from `superset-frontend`:

```bash
npx eslint \
  plugins/plugin-chart-ag-grid-table-scheme/src \
  plugins/plugin-chart-ag-grid-table-scheme/test \
  plugins/plugin-chart-ag-grid-table/src/AgGridTable/index.tsx \
  plugins/plugin-chart-ag-grid-table/src/AgGridTableChart.tsx \
  plugins/plugin-chart-ag-grid-table/src/renderers/NumericCellRenderer.tsx \
  plugins/plugin-chart-ag-grid-table/src/renderers/TextCellRenderer.tsx \
  plugins/plugin-chart-ag-grid-table/src/types.ts \
  plugins/plugin-chart-ag-grid-table/src/utils/getCellStyle.ts \
  plugins/plugin-chart-ag-grid-table/src/utils/useColDefs.ts
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript validation**

Run from `superset-frontend`:

```bash
npm run type
```

Expected: PASS, or report existing repository baseline failures separately from changed-file failures.

- [ ] **Step 4: Record validation result**

Create `docs/superpowers/reports/2026-05-25-noway-table-v1-isolation-validation.md` with:

```markdown
# Noway Table V1 Isolation Validation

## Scope

- `plugin-chart-ag-grid-table-scheme` is self-contained.
- Official `plugin-chart-ag-grid-table` no longer carries noway-only extension points.
- Crosstab and Chinese translations were not modified by this isolation work.

## Commands

- `BABEL_ENV=test npx jest plugins/plugin-chart-ag-grid-table-scheme/test --runInBand`
- `npx eslint plugins/plugin-chart-ag-grid-table-scheme/src plugins/plugin-chart-ag-grid-table-scheme/test plugins/plugin-chart-ag-grid-table/src/AgGridTable/index.tsx plugins/plugin-chart-ag-grid-table/src/AgGridTableChart.tsx plugins/plugin-chart-ag-grid-table/src/renderers/NumericCellRenderer.tsx plugins/plugin-chart-ag-grid-table/src/renderers/TextCellRenderer.tsx plugins/plugin-chart-ag-grid-table/src/types.ts plugins/plugin-chart-ag-grid-table/src/utils/getCellStyle.ts plugins/plugin-chart-ag-grid-table/src/utils/useColDefs.ts`
- `npm run type`

## Result

- Jest: PASS
- ESLint: PASS
- TypeScript: PASS

## Notes

- Baseline failures: none.
```

- [ ] **Step 5: Commit validation report**

```bash
git add docs/superpowers/reports/2026-05-25-noway-table-v1-isolation-validation.md
git commit -m "docs(noway-table): record isolation validation"
```

## Task 8: Final Diff Audit

**Files:**

- No code changes unless the audit finds a missed import.

- [ ] **Step 1: Audit official table diff**

Run from repository root:

```bash
git diff --name-status "$(git merge-base HEAD origin/master)"..HEAD -- \
  superset-frontend/plugins/plugin-chart-ag-grid-table
```

Expected: no noway-only formatter or toolbar files remain under official AG Grid Table. Remaining output should be either empty or explicitly justified in the validation report.

- [ ] **Step 2: Audit retained internal surfaces**

Run from repository root:

```bash
git diff --name-status "$(git merge-base HEAD origin/master)"..HEAD -- \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme \
  superset-frontend/plugins/plugin-chart-crosstab-table \
  superset/translations/zh/LC_MESSAGES/messages.po
```

Expected: output is limited to the retained internal product surfaces.

- [ ] **Step 3: Audit isolation guard**

Run from repository root:

```bash
rg -n "plugin-chart-ag-grid-table/src|@superset-ui/plugin-chart-ag-grid-table/src" \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme
```

Expected: no output.

- [ ] **Step 4: Commit audit correction after a missed import**

If Step 3 finds a missed import, replace it with the corresponding local `./table` or `../table` import, then run:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-ag-grid-table-scheme/test/isolation.test.ts \
  --runInBand
git add plugins/plugin-chart-ag-grid-table-scheme
git commit -m "fix(noway-table): complete table isolation"
```

Expected: the isolation test passes before committing.
