# Crosstab v3 Dynamic Group-By Feasibility

Date: 2026-05-20
Workspace: `/Volumes/extend/ecode-workspace/superset-source`
Branch: `noway-release`

## Verdict

Repo-side status: PASS.

Browser feasibility: BLOCKED by local runtime unavailable. `curl -f http://localhost:8088/health` failed with exit code 7 because nothing was listening on localhost port 8088. No service was started and no browser acceptance was fabricated.

Candidate production dynamic group-by fields still require dataset verification before enabling in production chart config:

- `shop_name`
- `country`
- `msku`
- `parent_asin`

## Evidence

### Focused Jest Regression

Command:

```bash
cd superset-frontend && npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Result: PASS, exit code 0.

Observed result:

- Test Suites: 5 passed, 5 total
- Tests: 64 passed, 64 total
- Snapshots: 0 total
- Time: 7.527 s

Observed non-blocking environment warnings:

- Duplicate manual mock warnings for `mockExportObject`, `mockExportString`, and `svgrMock`.
- Browserslist `caniuse-lite` age warning.
- Node `punycode` deprecation warning.

### Focused ESLint

Command:

```bash
cd superset-frontend && npx eslint plugins/plugin-chart-crosstab-table/src/types.ts plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx
```

Result: PASS, exit code 0.

Observed result:

- `✔ Lint done.`

Observed non-blocking environment warning:

- Multiple TypeScript projects found; ESLint suggested using project references or `noWarnOnMultipleProjects`.

### Frontend Type Check

Command:

```bash
cd superset-frontend && npm run type -- --pretty false
```

Result: PASS, exit code 0.

Observed result:

```text
> superset@6.0.0 type
> tsc --noEmit --pretty false
```

### Runtime Health

Command:

```bash
curl -f http://localhost:8088/health
```

Result: FAIL, exit code 7.

Observed result:

```text
curl: (7) Failed to connect to localhost port 8088 after 0 ms: Couldn't connect to server
```

## Self-Review

- The exact focused Jest command requested for Task 6 was run with `npx jest` and `--runInBand`.
- The exact focused ESLint file list requested for Task 6 was run with `npx eslint`.
- The requested frontend type command was run.
- Runtime health was checked without starting services.
- Browser feasibility remains blocked only because the local Superset runtime is unavailable.
- Existing unrelated untracked `.superpowers/` content and crosstab V2 reports were not modified or staged.
