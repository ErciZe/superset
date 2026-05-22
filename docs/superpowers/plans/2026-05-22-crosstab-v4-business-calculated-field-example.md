# Crosstab V4 Business Calculated Field Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `pct(1,1)` production placeholder with a business-visible Crosstab V4 calculated-field example that edits and renders as a real gross-margin formula.

**Architecture:** Keep V4 calculated fields chart-local, but allow their `metric_ref` dependencies to resolve from datasource saved metrics without adding those dependency metrics to the visible crosstab metric list. Production slice 10 will display only the calculated metric chip, while the editor can still show numerator and denominator choices.

**Tech Stack:** Apache Superset 6 frontend plugin, React/TypeScript, Jest, production Docker image `apache-superset-doris:6.0.0-zh-column-scheme-matrix`, production host `agentops`.

---

## File Structure

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts`
  - Seed calculated-field SQL resolution with datasource saved metric SQL expressions.
  - Keep fail-fast behavior when a referenced metric has no SQL expression.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx`
  - Exclude calculated placeholder chips from dependency option resolution.
  - Fall back to datasource saved metrics only when no real selected metric options are available.
- Modify tests:
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
- Production metadata update:
  - Dataset 7 saved metrics: ensure `v4_gross_profit_sum` and `v4_sales_amount_sum`.
  - Slice 10 params: replace literal placeholder field with metric-ref formula.
- Create closeout report:
  - `docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-closeout.md`

---

### Task 1: Add Regression Tests For Hidden Saved-Metric Dependencies

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`

- [ ] **Step 1: Add a failing expansion test**

Add this test to `calcFields.test.ts` near the existing saved-metric expansion tests:

```ts
test('expands calculated fields from datasource saved metrics without visible dependency metrics', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData: {
      ...formData,
      datasourceMetrics: [
        {
          metric_name: 'v4_gross_profit_sum',
          verbose_name: 'V4毛利',
          expression: 'SUM(gross_profit)',
        },
        {
          metric_name: 'v4_sales_amount_sum',
          verbose_name: 'V4销售额',
          expression: 'SUM(sales_amount)',
        },
      ],
      crosstabCalculatedFields: [
        {
          id: 'calc_margin_pct_v4',
          name: 'V4示例毛利率',
          resultType: 'percent',
          formatString: '.2%',
          ast: {
            kind: 'pct',
            numerator: {
              kind: 'metric_ref',
              metricId: 'v4_gross_profit_sum',
            },
            denominator: {
              kind: 'metric_ref',
              metricId: 'v4_sales_amount_sum',
            },
          },
        },
      ],
    },
    metricConfigs: [
      {
        metric: 'V4示例毛利率',
        label: 'V4示例毛利率',
        calculatedFieldId: 'calc_margin_pct_v4',
      },
    ],
    parameterValues: { number: {}, text: {} },
  });

  expect(result.metricConfigs).toEqual([
    {
      metric: {
        expressionType: 'SQL',
        label: 'V4示例毛利率',
        sqlExpression:
          '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
      },
      label: 'V4示例毛利率',
      semantic: 'ratio',
      formatString: '.2%',
    },
  ]);
});
```

- [ ] **Step 2: Add a failing query-build test**

Add this test to `buildQuery.test.ts` near the existing calculated-field tests:

```ts
it('builds a visible calculated metric from hidden datasource saved metric dependencies', () => {
  const queryContext = buildQuery({
    datasource: '7__table',
    datasourceMetrics: [
      {
        metric_name: 'v4_gross_profit_sum',
        verbose_name: 'V4毛利',
        expression: 'SUM(gross_profit)',
      },
      {
        metric_name: 'v4_sales_amount_sum',
        verbose_name: 'V4销售额',
        expression: 'SUM(sales_amount)',
      },
    ],
    viz_type: 'crosstab-table',
    groupbyRows: ['metric_name_with_unit'],
    groupbyColumns: ['biz_date', 'shop_name'],
    crosstabFieldConfig: {
      rows: [{ field: 'metric_name_with_unit', label: '指标' }],
      columns: [
        { field: 'biz_date', label: '日期' },
        { field: 'shop_name', label: '店铺' },
      ],
      metrics: [
        {
          metric: 'V4示例毛利率',
          label: 'V4示例毛利率',
          calculatedFieldId: 'calc_margin_pct_v4',
          semantic: 'ratio',
          formatString: '.2%',
        },
      ],
    },
    crosstabCalculatedFields: [
      {
        id: 'calc_margin_pct_v4',
        name: 'V4示例毛利率',
        resultType: 'percent',
        formatString: '.2%',
        ast: {
          kind: 'pct',
          numerator: { kind: 'metric_ref', metricId: 'v4_gross_profit_sum' },
          denominator: { kind: 'metric_ref', metricId: 'v4_sales_amount_sum' },
        },
      },
    ],
  } as never);

  expect(queryContext.queries[0].metrics).toEqual([
    expect.objectContaining({
      expressionType: 'SQL',
      label: 'V4示例毛利率',
      sqlExpression:
        '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
    }),
  ]);
});
```

- [ ] **Step 3: Run tests and confirm they fail**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand
```

Expected: the two new tests fail with `ERR_CROSSTAB_CALC_METRIC` before implementation.

---

### Task 2: Resolve Calculated Metric Refs From Datasource Saved Metrics

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts`

- [ ] **Step 1: Add datasource saved metric SQL seeding**

In `calcFields.ts`, add this helper after `addMetricSql`:

```ts
function seedDatasourceMetricSql(
  formData: CrosstabFormData,
): Record<string, string> {
  return getDatasourceSavedMetrics(formData).reduce<Record<string, string>>(
    (metricSql, metric) => {
      const metricName = getSavedMetricName(metric);
      const sqlExpression = getSavedMetricExpression(metric);

      if (metricName === undefined || sqlExpression === undefined) {
        return metricSql;
      }

      const nextMetricSql = { ...metricSql };

      addMetricSql(nextMetricSql, metricName, sqlExpression);
      addMetricSql(nextMetricSql, nonEmptyString(metric.label), sqlExpression);
      addMetricSql(
        nextMetricSql,
        nonEmptyString(metric.verbose_name),
        sqlExpression,
      );

      return nextMetricSql;
    },
    {},
  );
}
```

- [ ] **Step 2: Use seeded SQL in `getMetricSqlMap`**

Change the `getMetricSqlMap` reducer initialization from:

```ts
return metricConfigs.reduce<Record<string, string>>((metricSql, config) => {
```

to:

```ts
return metricConfigs.reduce<Record<string, string>>((metricSql, config) => {
```

and change the reducer initial value from:

```ts
}, {});
```

to:

```ts
}, seedDatasourceMetricSql(formData));
```

Do not remove the existing metric-config resolution logic; selected SQL metrics and selected saved metric aliases must still override or add labels.

- [ ] **Step 3: Run the focused tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand
```

Expected: both test files pass.

---

### Task 3: Make The Editor Reopen Saved Metric-Ref Formulas

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`

- [ ] **Step 1: Add a failing editor fallback test**

Add this test to `controlPanel.test.ts` near `resolves calculated field metrics after selected chart metrics load`:

```ts
it('edits calculated fields that reference datasource saved metrics when only the calculated chip is visible', () => {
  const onChange = jest.fn();
  const onControlChange = jest.fn();

  render(
    createElement(CrosstabCalculatedFieldsControl, {
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          metrics: [
            {
              metric: 'V4示例毛利率',
              label: 'V4示例毛利率',
              calculatedFieldId: 'calc_margin_pct_v4',
              semantic: 'ratio',
              formatString: '.2%',
            },
          ],
        },
      },
      name: 'crosstabCalculatedFields',
      onControlChange,
      onChange,
      savedMetrics: [
        {
          metric_name: 'v4_gross_profit_sum',
          verbose_name: 'V4毛利',
          expression: 'SUM(gross_profit)',
        },
        {
          metric_name: 'v4_sales_amount_sum',
          verbose_name: 'V4销售额',
          expression: 'SUM(sales_amount)',
        },
      ],
      value: [
        {
          id: 'calc_margin_pct_v4',
          name: 'V4示例毛利率',
          resultType: 'percent',
          formatString: '.2%',
          ast: {
            kind: 'pct',
            numerator: {
              kind: 'metric_ref',
              metricId: 'v4_gross_profit_sum',
            },
            denominator: {
              kind: 'metric_ref',
              metricId: 'v4_sales_amount_sum',
            },
          },
        },
      ],
    }),
  );

  fireEvent.click(screen.getByText('Edit'));
  fireEvent.click(screen.getByText('Save calculated field'));

  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      id: 'calc_margin_pct_v4',
      name: 'V4示例毛利率',
      ast: {
        kind: 'pct',
        numerator: {
          kind: 'metric_ref',
          metricId: 'v4_gross_profit_sum',
        },
        denominator: {
          kind: 'metric_ref',
          metricId: 'v4_sales_amount_sum',
        },
      },
    }),
  ]);
});
```

- [ ] **Step 2: Filter calculated placeholder chips before option selection**

In `getMetricOptions`, replace the first branch:

```ts
if (fieldMetrics.length > 0) {
  return fieldMetrics
    .map(metricConfig =>
      metricOptionFromMetric(
        metricConfig.metric,
        metricConfig.label,
        savedMetricLookup,
      ),
    )
    .filter((option): option is MetricOption => option !== undefined);
}
```

with:

```ts
const fieldMetricOptions = fieldMetrics
  .filter(metricConfig => metricConfig.calculatedFieldId === undefined)
  .map(metricConfig =>
    metricOptionFromMetric(
      metricConfig.metric,
      metricConfig.label,
      savedMetricLookup,
    ),
  )
  .filter((option): option is MetricOption => option !== undefined);

if (fieldMetricOptions.length > 0) {
  return fieldMetricOptions;
}
```

This keeps the existing priority order for real selected metrics, but lets a calculated-only visible metric fall through to datasource saved metrics.

- [ ] **Step 3: Run the focused control test**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: all tests pass.

---

### Task 4: Full Local Verification And Source Commit

**Files:**
- Verify changed frontend files only.

- [ ] **Step 1: Run whitespace and focused Jest checks**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git diff --check -- \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts

cd superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  --runInBand
```

Expected: `git diff --check` prints nothing; Jest reports all selected suites passing.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm run type -- --pretty false
```

Expected: pass, or only report pre-existing unrelated baseline errors. Any error in changed crosstab files is blocking.

- [ ] **Step 3: Commit source changes**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts
git commit -m "fix(crosstab): resolve v4 calculated metric examples"
git push fork noway-release
```

Expected: commit and push succeed. Do not stage unrelated dirty files or old reports.

---

### Task 5: Production Metadata And Asset Release

**Files / Runtime:**
- Remote: `agentops:/home/ubuntu/superset-docker`
- Dataset: Superset datasource id `7`
- Slice: Superset slice id `10`

- [ ] **Step 1: Build frontend assets**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=testableProduction npm run build
```

Expected: frontend build succeeds and updates `superset/static/assets/`.

- [ ] **Step 2: Backup production assets and metadata**

Run:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops 'bash -s' <<'REMOTE'
set -euo pipefail
cd /home/ubuntu/superset-docker
ts="$(date +%Y%m%d%H%M%S)"
mkdir -p "backups/crosstab-v4-business-example-${ts}"
cp -a superset-source/superset/static/assets "backups/crosstab-v4-business-example-${ts}/assets"
docker exec apache-superset python - <<'PY' > "backups/crosstab-v4-business-example-${ts}/slice10-dataset7-before.json"
from __future__ import annotations
import json
from superset.app import create_app
app = create_app()
with app.app_context():
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice
    dataset = db.session.get(SqlaTable, 7)
    sl = db.session.get(Slice, 10)
    print(json.dumps({
        "dataset_metrics": [
            {
                "metric_name": metric.metric_name,
                "verbose_name": metric.verbose_name,
                "expression": metric.expression,
                "d3format": metric.d3format,
            }
            for metric in dataset.metrics
        ],
        "slice_params": json.loads(sl.params or "{}"),
    }, ensure_ascii=False, indent=2))
PY
printf 'BACKUP_DIR=%s\n' "backups/crosstab-v4-business-example-${ts}"
REMOTE
```

Expected: prints a `BACKUP_DIR` path; preserve it in the closeout report.

- [ ] **Step 3: Sync only frontend assets**

Run:

```bash
rsync -az --delete \
  /Volumes/extend/ecode-workspace/superset-source/superset/static/assets/ \
  agentops:/home/ubuntu/superset-docker/superset-source/superset/static/assets/
```

Expected: command exits `0`.

- [ ] **Step 4: Ensure production saved metrics and update slice 10**

Run:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops 'docker exec -i apache-superset python -' <<'PY'
from __future__ import annotations
import json

from superset.app import create_app

app = create_app()
with app.app_context():
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, SqlMetric
    from superset.models.slice import Slice

    dataset = db.session.get(SqlaTable, 7)
    if dataset is None:
        raise RuntimeError("Dataset 7 not found")

    desired_metrics = {
        "v4_gross_profit_sum": {
            "verbose_name": "V4毛利",
            "expression": "SUM(gross_profit)",
            "d3format": ",.2f",
        },
        "v4_sales_amount_sum": {
            "verbose_name": "V4销售额",
            "expression": "SUM(sales_amount)",
            "d3format": ",.2f",
        },
    }
    by_name = {metric.metric_name: metric for metric in dataset.metrics}
    for metric_name, values in desired_metrics.items():
        metric = by_name.get(metric_name)
        if metric is None:
            metric = SqlMetric(metric_name=metric_name, table=dataset)
            db.session.add(metric)
            dataset.metrics.append(metric)
        metric.verbose_name = values["verbose_name"]
        metric.expression = values["expression"]
        metric.d3format = values["d3format"]

    sl = db.session.get(Slice, 10)
    if sl is None:
        raise RuntimeError("Slice 10 not found")

    params = json.loads(sl.params or "{}")
    field_config = params.get("crosstabFieldConfig") or {}
    field_config["metrics"] = [
        {
            "metric": "V4示例毛利率",
            "label": "V4示例毛利率",
            "calculatedFieldId": "calc_margin_pct_v4",
            "semantic": "ratio",
            "formatString": ".2%",
        }
    ]
    params["crosstabFieldConfig"] = field_config
    params["crosstabCalculatedFields"] = [
        {
            "id": "calc_margin_pct_v4",
            "name": "V4示例毛利率",
            "description": "V4 business acceptance calculated field: SUM(gross_profit) / SUM(sales_amount).",
            "resultType": "percent",
            "formatString": ".2%",
            "ast": {
                "kind": "pct",
                "numerator": {
                    "kind": "metric_ref",
                    "metricId": "v4_gross_profit_sum",
                },
                "denominator": {
                    "kind": "metric_ref",
                    "metricId": "v4_sales_amount_sum",
                },
            },
        }
    ]
    sl.params = json.dumps(params, ensure_ascii=False, sort_keys=True)
    db.session.commit()

    print(json.dumps({
        "slice_id": sl.id,
        "slice_name": sl.slice_name,
        "metrics": field_config["metrics"],
        "calculated_fields": params["crosstabCalculatedFields"],
    }, ensure_ascii=False, indent=2))
PY
```

Expected: JSON shows one visible metric `V4示例毛利率` and metric refs to `v4_gross_profit_sum` / `v4_sales_amount_sum`.

- [ ] **Step 5: Rebuild image and restart service**

Run:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops 'bash -s' <<'REMOTE'
set -euo pipefail
cd /home/ubuntu/superset-docker
old_image="$(docker inspect -f '{{.Image}}' apache-superset)"
docker build -f Dockerfile.doris-zh -t apache-superset-doris:6.0.0-zh-column-scheme-matrix .
docker compose up -d superset
for i in $(seq 1 60); do
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' apache-superset)"
  printf 'health=%s\n' "$health"
  test "$health" = healthy && break
  sleep 5
done
new_image="$(docker inspect -f '{{.Image}}' apache-superset)"
printf 'OLD_IMAGE=%s\nNEW_IMAGE=%s\n' "$old_image" "$new_image"
test "$old_image" != "$new_image"
REMOTE
```

Expected: final health is `healthy`; `NEW_IMAGE` differs from `OLD_IMAGE`.

---

### Task 6: Production Acceptance And Closeout Report

**Files:**
- Create: `docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-closeout.md`
- Create screenshot files under `docs/superpowers/reports/`

- [ ] **Step 1: Run HTTP and log checks**

Run:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops 'bash -s' <<'REMOTE'
set -euo pipefail
printf 'CONTAINER\n'
docker inspect -f 'state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} image={{.Image}}' apache-superset
printf 'SERVER_HEALTH\n'
curl -fsS http://127.0.0.1:8088/health
printf '\nRECENT_ERRORS\n'
docker logs --since 15m apache-superset 2>&1 | grep -Ei 'ERR_CROSSTAB|error|exception|traceback|critical' | tail -n 20 || true
REMOTE
printf 'PUBLIC_HEALTH\n'
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
```

Expected: container is `running healthy`; both health checks return `OK`; no new crosstab, calculated-field, or chart-data traceback errors.

- [ ] **Step 2: Browser acceptance**

Use the in-app browser at:

```text
http://111.230.91.24:8088/explore/?dashboard_page_id=46-PPo9Im44OCNY7jp1J9&slice_id=10
```

Verify:

- Page does not redirect to `/login/`.
- `数据` tab metric chip shows `V4示例毛利率`.
- `定制化配置` tab `Calculated fields` list shows `V4示例毛利率`.
- Clicking `编辑` opens a drawer where:
  - id is `calc_margin_pct_v4`
  - name is `V4示例毛利率`
  - numerator resolves to `v4_gross_profit_sum` / `V4毛利`
  - denominator resolves to `v4_sales_amount_sum` / `V4销售额`
- `/api/v1/chart/data` returns HTTP `200`.
- Chart area is visible and not blank.
- Browser console has no V4 calculated-field, numeric-parameter, or dynamic-metric errors.

- [ ] **Step 3: Save screenshots**

Save at least two screenshots:

```text
docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-explore.png
docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-editor.png
```

- [ ] **Step 4: Write the closeout report**

Create `docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-closeout.md` with:

```markdown
# Crosstab V4 Business Calculated Field Example Closeout

## Verdict

complete

## Source Evidence

- Commit: `<source commit>`
- Push target: `fork/noway-release`
- Tests:
  - `BABEL_ENV=test npx jest ...calcFields.test.ts ...buildQuery.test.ts ...controlPanel.test.ts --runInBand`: PASS
  - `npm run type -- --pretty false`: PASS or documented unrelated baseline

## Production Evidence

- Backup directory: `<backup dir>`
- Old image: `<old image>`
- New image: `<new image>`
- Container: `running healthy`
- Server health: `OK`
- Public health: `OK`
- Recent crosstab/calculated-field errors: none

## Slice 10 Evidence

- Dataset 7 metrics include:
  - `v4_gross_profit_sum = SUM(gross_profit)`
  - `v4_sales_amount_sum = SUM(sales_amount)`
- Slice 10 calculated field:
  - id: `calc_margin_pct_v4`
  - name: `V4示例毛利率`
  - formula: `pct(v4_gross_profit_sum, v4_sales_amount_sum)`

## Browser Evidence

- Explore URL: `http://111.230.91.24:8088/explore/?dashboard_page_id=46-PPo9Im44OCNY7jp1J9&slice_id=10`
- Data tab shows `V4示例毛利率`.
- Customize tab editor reopens with numerator and denominator populated.
- `/api/v1/chart/data`: HTTP 200.
- Screenshots:
  - `2026-05-22-crosstab-v4-business-calculated-field-example-explore.png`
  - `2026-05-22-crosstab-v4-business-calculated-field-example-editor.png`

## Residual Risk

- This completes V4 business-example acceptance for one production slice.
- V4.1 conditional metrics and V4.2 time primitives remain out of scope.
```

- [ ] **Step 5: Commit the report**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-closeout.md \
  docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-explore.png \
  docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-editor.png
git commit -m "docs: close crosstab v4 business calculated field example"
git push fork noway-release
```

Expected: report commit and push succeed without staging unrelated existing dirty files.

---

## Assumptions

- Formal slice 10 may be updated directly, per user approval.
- Production example should be business-readable, so the final formula is gross margin: `SUM(gross_profit) / SUM(sales_amount)`.
- The crosstab visible metrics list should show only the calculated example, not the two dependency metrics.
- Dataset 7 saved metrics may be extended with two V4-prefixed helper metrics because they are required to make the example editable and traceable.
- Runtime-wide `superset/` sync remains out of scope; release is frontend asset-only plus image rebuild.
