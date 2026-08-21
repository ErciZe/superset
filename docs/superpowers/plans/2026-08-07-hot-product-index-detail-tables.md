# Hot Product Index Detail Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有“拉杆箱在售产品爆品指数看板”中生产交付按月展示的 `SPU维度`、`SKU维度` 两张经营明细表，并保持 FineBI 的字段顺序、层级、填色、中文表头和合计语义。

**Architecture:** 继续只读取两张 `ads_pdm` 爆品指数事实表；两个虚拟数据集在 Jinja SQL 内消费页面月份和维度筛选，先聚合到各自叶子粒度，再由 AG Grid Table Scheme 做服务端分页、排序、合计和页面内层级折叠。这样总计查询面对的是叶子行，`AVG(爆品指数)`、`AVG(评分)`、比率重算和库存去重都能保持批准口径，而不在 BI 层跨源关联。层级折叠是服务端分页下的“当前页层级”：每页首行完整显示祖先值，折叠只隐藏当前页后代；换页、排序或外部筛选后重置折叠状态，避免跨页孤儿行和不稳定状态。

**Tech Stack:** Apache Superset、React 18、TypeScript、AG Grid Community、Jest + React Testing Library、Python 3、Jinja SQL、Apache Doris、pytest、Superset assets ZIP。

## Global Constraints

- 权威规格为 `docs/superpowers/specs/2026-08-07-hot-product-index-detail-tables-design.md`；FineBI 只作为视觉和交互基线，不作为业务口径来源。
- 唯一业务服务源是 `ads.ads_pdm_lx_hot_product_index_sku_d` 与 `ads.ads_pdm_lx_hot_product_index_sku_m`；禁止 Superset 直连 FineBI 内部加工表、领星原始表、库存表或订单表补数。
- 必需 ADS 字段 `score`、`order_qty`、`actual_stock_qty` 任一缺失时快速失败，不生成缺列图表，不用 `0`、空字符串或其他字段回退。
- `product_level` 只来自 `dim.dim_product.product_level` 已下发到 ADS 的值；`spu_previous_month_sales_level` 固定按 `ym + spu` 使用，禁止随页面维度筛选重新评级。
- SPU 叶子粒度固定为 `ym + spu + spu_previous_month_sales_level + sku_level`；SKU 叶子粒度固定为 `ym + company_sku + sku + product_level + size + color`。
- 页面月份使用左闭右开完整自然月范围；当前月按全局数据水位截断；近 7/30/90 天指标以筛选有效结束日为锚点并读取完整 90 天 lookback。
- 全部物理字段必须有中文 `verbose_name`；UI 不得直接展示英文字段名。
- 全部小数最多显示 1 位；数据层原精度不因显示格式改变。
- 爆品指数单元格固定填色：`value <= 0` 为 `#DF7461`，`0 < value < 5` 为 `#FFC947`，`5 <= value < 10` 为 `#B7D2B6`，`value >= 10` 为 `#2978B5`，`NULL` 不填色并显示 `-`。
- 表头使用 `#8AA964` 和白字；明细行为约 5%/10% 绿色交替；合计行绿色实底并加粗；当前 Tab 使用蓝色下划线。
- 现有工作树存在无关改动；每次提交只暂存本任务列出的文件，不覆盖、不回滚、不顺带格式化其他文件。
- 新 TypeScript 禁止 `any`；前端组件从 `@superset-ui/core` 或其组件封装导入，不新增 Ant Design 直接依赖。
- 发布前必须在精确提交基线执行 `pre-commit run --all-files`；聚焦测试或构建通过不能替代生产浏览器与底层 SQL 验收。

---

## File Map

| File | Responsibility |
|---|---|
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/hierarchy.ts` | 纯函数生成当前页层级元数据并过滤折叠后代。 |
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/renderers/HierarchyCellRenderer.tsx` | 渲染层级缩进、展开/折叠按钮、重复祖先空白和 Tooltip。 |
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts` | 定义层级配置、折叠路径和固定列类型。 |
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTableChart.tsx` | 管理当前页层级视图与 own state，向列定义传递切换回调。 |
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/utils/useColDefs.ts` | 为层级列选择 renderer，并应用 `pinned` 配置。 |
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/controlPanel.tsx` | 暴露通用 `row_hierarchy_fields` 控件，仅聚合模式可用。 |
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/hierarchy.test.ts` | 验证重复祖先、折叠、页首祖先和空值路径。 |
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/HierarchyCellRenderer.test.tsx` | 验证按钮、缩进、空白重复值和切换事件。 |
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx` | 验证层级 renderer 与固定列配置。 |
| `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx` | 验证筛选、排序、分页时折叠状态重置。 |
| `scripts/hot_product_index_dashboard.py` | 生成两个叶子粒度虚拟数据集、两个明细图表、双 Tab 布局、筛选范围和 CSS。 |
| `tests/unit_tests/scripts/hot_product_index_dashboard_test.py` | 锁定数据门禁、SQL、指标、列顺序、填色、格式、UUID、布局和筛选目标。 |
| `docs/superpowers/specs/2026-08-07-hot-product-index-detail-tables-design.md` | 若执行中发现实现契约与已批准规格不一致，只记录经用户批准的规格变更；否则不修改。 |

### Task 1: Verify The ADS Contract Before Frontend Work

**Files:**
- Read: `/Users/zewe/code-workspace/etl/ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql`
- Read: `/Users/zewe/code-workspace/etl/ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql`
- Read: `/Users/zewe/code-workspace/etl/docs/reports/2026-08-07-hot-product-index-march-reconciliation.md`
- Modify: none

**Interfaces:**
- Consumes: production Doris connection already used by the accepted hot-product dashboard release.
- Produces: a pass/fail gate proving both ADS tables expose the required columns and accepted data windows; later tasks must not start on a failed gate.

- [ ] **Step 1: Confirm the implementation commit exists and did not only update documentation**

Run:

```bash
git -C /Users/zewe/code-workspace/etl log --oneline --all -- \
  ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql \
  ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql \
  include/sql/ads/pdm/hot_product_index
git -C /Users/zewe/code-workspace/etl diff --check
```

Expected: the latest implementation commit contains executable DDL/SQL changes for `score`, `order_qty`, and `actual_stock_qty`; documentation-only evidence is not sufficient.

- [ ] **Step 2: Run a read-only production schema gate**

Use the existing Doris SQL execution path from the accepted ETL release and run:

```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'ads'
  AND table_name IN (
    'ads_pdm_lx_hot_product_index_sku_d',
    'ads_pdm_lx_hot_product_index_sku_m'
  )
  AND column_name IN (
    'score',
    'order_qty',
    'actual_stock_qty',
    'product_level',
    'spu_previous_month_sales_level',
    'theoretical_stock_qty',
    'data_through_date'
  )
ORDER BY table_name, column_name;
```

Expected: both tables return all seven columns; `score` and both stock fields are decimal-compatible, `order_qty` is integer-compatible, and no field is supplied only through a view outside `ads`.

- [ ] **Step 3: Run value and lookback gates**

```sql
SELECT
  ym,
  COUNT(*) AS row_count,
  SUM(CASE WHEN order_qty < 0 THEN 1 ELSE 0 END) AS negative_order_rows,
  SUM(CASE WHEN score IS NULL THEN 1 ELSE 0 END) AS null_score_rows,
  SUM(CASE WHEN actual_stock_qty IS NULL THEN 1 ELSE 0 END) AS null_stock_rows,
  MIN(data_through_date) AS min_data_through_date,
  MAX(data_through_date) AS max_data_through_date
FROM ads.ads_pdm_lx_hot_product_index_sku_d
WHERE sales_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 120 DAY)
GROUP BY ym
ORDER BY ym DESC;
```

Expected: `negative_order_rows = 0`; the accepted report explains any nullable score/stock population; daily coverage contains at least the complete 90-day lookback before the latest `data_through_date`.

- [ ] **Step 4: Stop on a failed gate**

If any schema or data assertion fails, record the exact table, column, query, and observed result in the ETL task. Do not modify the Superset generator or plugin and do not create a fallback formula.

### Task 2: Add A Pure Page-Local Hierarchy Engine

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/hierarchy.ts`
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/hierarchy.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts`

**Interfaces:**
- Consumes: `DataRecord[]`, ordered `rowHierarchyFields: string[]`, and `collapsedHierarchyPaths: string[]`.
- Produces: `buildHierarchyView(records, fields, collapsedPaths): HierarchyView`, where `HierarchyView` contains `records: HierarchyRecord[]` and `metadataKey: typeof HIERARCHY_META_KEY`.

- [ ] **Step 1: Write failing hierarchy tests**

Add tests covering these exact cases:

```ts
const rows = [
  { spu: '8010S', ym: '2026-03', spu_level: 'S', sku_level: 'A', sales: 12 },
  { spu: '8010S', ym: '2026-03', spu_level: 'S', sku_level: 'B', sales: 8 },
  { spu: '8010S', ym: '2026-02', spu_level: 'A', sku_level: 'B', sales: 5 },
  { spu: '8012S', ym: '2026-03', spu_level: 'B', sku_level: 'C', sales: 3 },
];

expect(buildHierarchyView(rows, ['spu', 'ym', 'spu_level', 'sku_level'], []))
  .toMatchObject({ records: expect.any(Array) });
expect(
  buildHierarchyView(rows, ['spu', 'ym', 'spu_level', 'sku_level'], [
    encodeHierarchyPath(['8010S', '2026-03']),
  ]).records,
).toHaveLength(2);
```

Also assert:

- the first row of an arbitrary page marks every ancestor as `firstInGroup: true`;
- the second `8010S/2026-03` row blanks repeated `spu`, `ym`, and `spu_level` cells but keeps `sku_level` visible;
- `null` and the literal string `'NULL'` produce different encoded paths;
- collapsing `8010S/2026-03` keeps the group header row and hides only later descendants;
- empty `fields` returns the original records unchanged.

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-ag-grid-table-scheme/test/table/hierarchy.test.ts --runInBand
```

Expected: FAIL because `hierarchy.ts` and its exported types do not exist.

- [ ] **Step 3: Add exact hierarchy types**

Extend `types.ts` without widening existing `any` usage:

```ts
export type HierarchyCellMeta = {
  depth: number;
  path: string;
  firstInGroup: boolean;
  hasDescendants: boolean;
  expanded: boolean;
};

export type HierarchyRowMeta = Record<string, HierarchyCellMeta>;

export type HierarchyRecord = DataRecord & {
  [HIERARCHY_META_KEY]?: HierarchyRowMeta;
};

export type HierarchyView = {
  records: HierarchyRecord[];
};
```

Add to existing contracts:

```ts
export type TableColumnConfig = {
  // existing fields remain unchanged
  pinned?: 'left' | 'right' | null;
};

export type TableChartFormData = QueryFormData & {
  // existing fields remain unchanged
  row_hierarchy_fields?: string[];
};

export interface ServerPaginationData {
  // existing fields remain unchanged
  collapsedHierarchyPaths?: string[];
}
```

- [ ] **Step 4: Implement deterministic path encoding and view construction**

Use a JSON tuple instead of delimiter concatenation so values containing `/`, `|`, or commas remain unambiguous:

```ts
export const HIERARCHY_META_KEY = '__hierarchyMeta' as const;

export const encodeHierarchyPath = (
  values: DataRecordValue[],
): string =>
  JSON.stringify(
    values.map(value =>
      typeof value === 'bigint'
        ? { type: 'bigint', value: value.toString() }
        : value === undefined
          ? { type: 'undefined' }
          : { type: typeof value, value },
    ),
  );

export function buildHierarchyView(
  records: DataRecord[],
  fields: string[],
  collapsedPaths: string[],
): HierarchyView {
  if (fields.length === 0 || records.length === 0) {
    return { records };
  }
  const missing = fields.filter(
    field =>
      !records.some(record =>
        Object.prototype.hasOwnProperty.call(record, field),
      ),
  );
  if (missing.length > 0) {
    throw new Error(`Missing hierarchy fields: ${missing.join(', ')}`);
  }

  const collapsed = new Set(collapsedPaths);
  let previousValues: DataRecordValue[] | undefined;
  const visible: HierarchyRecord[] = [];

  records.forEach((record, rowIndex) => {
    const values = fields.map(field => record[field]);
    const firstAtDepth = fields.map(
      (_, depth) =>
        !previousValues ||
        encodeHierarchyPath(values.slice(0, depth + 1)) !==
          encodeHierarchyPath(previousValues.slice(0, depth + 1)),
    );
    const hidden = fields.some((_, depth) => {
      const path = encodeHierarchyPath(values.slice(0, depth + 1));
      return collapsed.has(path) && !firstAtDepth[depth];
    });

    if (!hidden) {
      const metadata = Object.fromEntries(
        fields.map((field, depth) => {
          const pathValues = values.slice(0, depth + 1);
          const path = encodeHierarchyPath(pathValues);
          const next = records[rowIndex + 1];
          const hasDescendants = Boolean(
            next &&
              depth < fields.length - 1 &&
              encodeHierarchyPath(
                fields.slice(0, depth + 1).map(name => next[name]),
              ) === path,
          );
          return [
            field,
            {
              depth,
              path,
              firstInGroup: firstAtDepth[depth],
              hasDescendants,
              expanded: !collapsed.has(path),
            },
          ];
        }),
      );
      visible.push({ ...record, [HIERARCHY_META_KEY]: metadata });
    }
    previousValues = values;
  });
  return { records: visible };
}
```

The implementation must fail fast when a configured hierarchy field is absent from every record, because silently rendering a flat table would hide a broken chart contract.

- [ ] **Step 5: Run the hierarchy suite and type check**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-ag-grid-table-scheme/test/table/hierarchy.test.ts --runInBand
npx tsc --noEmit --pretty false -p plugins/plugin-chart-ag-grid-table-scheme/tsconfig.json
```

Expected: both commands PASS.

- [ ] **Step 6: Commit the pure engine**

```bash
git add \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/hierarchy.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/hierarchy.test.ts
git commit -m "feat(ag-grid-table): add page hierarchy model"
```

### Task 3: Render Hierarchy Cells And Persist Collapse State

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/renderers/HierarchyCellRenderer.tsx`
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/HierarchyCellRenderer.test.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTableChart.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/utils/useColDefs.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx`

**Interfaces:**
- Consumes: Task 2 `HierarchyRecord`, `HierarchyCellMeta`, `HIERARCHY_META_KEY`, and `buildHierarchyView`.
- Produces: `HierarchyCellRendererProps` and `onToggleHierarchyPath(path: string): void`; `useColDefs` receives `rowHierarchyFields` and `onToggleHierarchyPath`.

- [ ] **Step 1: Write renderer and state tests first**

Assert the renderer contract with React Testing Library:

```tsx
render(
  <HierarchyCellRenderer
    value="8010S"
    valueFormatted="8010S"
    meta={{
      depth: 0,
      path: '["8010S"]',
      firstInGroup: true,
      hasDescendants: true,
      expanded: true,
    }}
    onToggle={onToggle}
  />,
);
expect(screen.getByRole('button', { name: 'Collapse 8010S' })).toBeVisible();
await userEvent.click(screen.getByRole('button', { name: 'Collapse 8010S' }));
expect(onToggle).toHaveBeenCalledWith('["8010S"]');
```

Add tests that repeated cells render no text/button, leaf cells render text without a button, and a collapsed group exposes `展开 8010S`.

In `AgGridTableChart.test.tsx`, assert `updateTableOwnState` receives a toggled `collapsedHierarchyPaths` list and that pagination, page size, sorting, search, advanced filtering, and changed external filters clear it.

- [ ] **Step 2: Run focused tests and verify red**

```bash
cd superset-frontend
npm run test -- \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/HierarchyCellRenderer.test.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx \
  --runInBand
```

Expected: FAIL because the renderer and callback props are absent.

- [ ] **Step 3: Implement the accessible renderer**

Use Superset icons and an icon-only button with tooltip/ARIA label:

```tsx
export type HierarchyCellRendererProps = {
  value: DataRecordValue;
  valueFormatted?: DataRecordValue;
  meta?: HierarchyCellMeta;
  onToggle: (path: string) => void;
};

export default function HierarchyCellRenderer({
  value,
  valueFormatted,
  meta,
  onToggle,
}: HierarchyCellRendererProps) {
  if (!meta?.firstInGroup) return null;
  const text = String(valueFormatted ?? value ?? '-');
  const action = meta.expanded ? t('Collapse %s', text) : t('Expand %s', text);
  return (
    <span css={{ display: 'flex', alignItems: 'center', paddingLeft: meta.depth * 16 }}>
      <span css={{ display: 'inline-flex', width: 24 }}>
        {meta.hasDescendants && (
          <Tooltip title={action}>
            <button
              type="button"
              aria-label={action}
              onClick={event => {
                event.stopPropagation();
                onToggle(meta.path);
              }}
              css={{ border: 0, background: 'transparent', padding: 0 }}
            >
              {meta.expanded ? (
                <Icons.CaretDownOutlined iconSize="s" />
              ) : (
                <Icons.CaretRightOutlined iconSize="s" />
              )}
            </button>
          </Tooltip>
        )}
      </span>
      <Tooltip title={text}><span>{text}</span></Tooltip>
    </span>
  );
}
```

Do not use textual `+`/`-` controls and do not import icons from `@ant-design/icons` in the new component.

- [ ] **Step 4: Build hierarchy view and own-state toggling in `AgGridTableChart.tsx`**

Derive the view before `useColDefs`:

```ts
const rowHierarchyFields = props.formData.row_hierarchy_fields ?? [];
const collapsedHierarchyPaths =
  serverPaginationData.collapsedHierarchyPaths ?? [];
const hierarchyView = useMemo(
  () => buildHierarchyView(data, rowHierarchyFields, collapsedHierarchyPaths),
  [collapsedHierarchyPaths, data, rowHierarchyFields],
);

const handleToggleHierarchyPath = useCallback((path: string) => {
  const next = collapsedHierarchyPaths.includes(path)
    ? collapsedHierarchyPaths.filter(item => item !== path)
    : [...collapsedHierarchyPaths, path];
  updateTableOwnState(setDataMask, {
    ...serverPaginationData,
    collapsedHierarchyPaths: next,
  });
}, [collapsedHierarchyPaths, serverPaginationData, setDataMask]);
```

Pass `hierarchyView.records` to both `useColDefs` and `AgGridDataTable`. Every handler that changes the server result set must set `collapsedHierarchyPaths: []` together with `currentPage: 0` where applicable.

- [ ] **Step 5: Select the renderer and pin configured columns in `useColDefs.ts`**

For fields included in `rowHierarchyFields`, provide a `cellRenderer` that reads `params.data?.[HIERARCHY_META_KEY]?.[column.key]`. Apply `pinned: column.config?.pinned ?? undefined` to every generated `ColDef`. Do not enable AG Grid Enterprise row grouping or register an unlicensed module.

- [ ] **Step 6: Run tests and the plugin build**

```bash
cd superset-frontend
npm run test -- \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/hierarchy.test.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/HierarchyCellRenderer.test.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx \
  --runInBand
npm run build --workspace=@superset-ui/plugin-chart-ag-grid-table-scheme
```

Expected: all focused tests and the workspace build PASS.

- [ ] **Step 7: Commit the renderer integration**

```bash
git add \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTableChart.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/renderers/HierarchyCellRenderer.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/utils/useColDefs.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/HierarchyCellRenderer.test.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx
git commit -m "feat(ag-grid-table): render collapsible page hierarchy"
```

### Task 4: Expose The Generic Hierarchy Control

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/controlPanel.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx`

**Interfaces:**
- Consumes: `TableChartFormData.row_hierarchy_fields` from Task 2.
- Produces: a saved Explore form-data field whose values must be a prefix of aggregate-mode group-by columns.

- [ ] **Step 1: Add failing control-contract assertions**

Add a test that passes `row_hierarchy_fields: ['spu', 'ym']` and verifies both fields reach the hierarchy view in order. Add a negative test for a hierarchy field absent from `groupby`.

- [ ] **Step 2: Run the focused test and verify red**

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx --runInBand
```

Expected: FAIL because the control has no validation and invalid form data is accepted.

- [ ] **Step 3: Add `row_hierarchy_fields` to the Query section**

Configure a multi-select column control with this behavior:

```ts
row_hierarchy_fields: {
  type: 'SelectControl',
  label: t('Row hierarchy'),
  multi: true,
  description: t('Ordered leading group-by fields shown as a collapsible hierarchy.'),
  mapStateToProps: ({ controls }) => ({
    choices: (controls.groupby?.value ?? []).map((value: string) => [value, value]),
  }),
  visibility: ({ controls }) => getQueryMode(controls) === QueryMode.Aggregate,
},
```

The validation function must reject duplicates and reject any hierarchy sequence that is not an exact prefix of `groupby`. Empty selection remains the flat-table default, preserving existing charts.

- [ ] **Step 4: Re-run test and type check**

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx --runInBand
npx tsc --noEmit --pretty false -p plugins/plugin-chart-ag-grid-table-scheme/tsconfig.json
```

Expected: PASS with no `any` introduced by this task.

- [ ] **Step 5: Commit the control**

```bash
git add \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/controlPanel.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx
git commit -m "feat(ag-grid-table): configure row hierarchy"
```

### Task 5: Generate Leaf-Grain Detail Datasets With Exact Totals

**Files:**
- Modify: `scripts/hot_product_index_dashboard.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`

**Interfaces:**
- Consumes: accepted ADS columns from Task 1 and existing month-range/status SQL helpers in `hot_product_index_dashboard.py`.
- Produces: deterministic assets `爆品指数-SPU月度经营明细` and `爆品指数-SKU月度经营明细`, each returning one row per approved leaf grain after consuming native filters.

- [ ] **Step 1: Write failing asset-count and schema tests**

Change expected counts from `(3 datasets, 13 charts, 2 dashboards)` to `(5, 15, 2)` and UUID count from `18` to `22`. Assert the two new dataset names and exact Chinese labels:

```python
assert set(detail_datasets) == {
    "爆品指数-SPU月度经营明细",
    "爆品指数-SKU月度经营明细",
}
assert spu_labels == {
    "spu": "SPU",
    "ym": "年月",
    "spu_previous_month_sales_level": "SPU评级",
    "sku_level": "最终评级",
    "hot_product_index": "爆品指数",
    "score": "评分",
    "sales_amount_usd": "销售额",
    "sales_qty": "销量",
    "avg_daily_sales_qty": "日均销量",
    "gross_profit_usd": "毛利润",
    "gross_margin": "毛利率",
    "return_goods_qty": "退货量",
    "return_rate": "退货率",
    "order_qty": "订单量",
    "avg_sales_qty_7d": "近7天日均销量",
    "avg_sales_qty_30d": "近30天日均销量",
    "avg_sales_qty_90d": "近90天日均销量",
}
```

Assert SKU adds `company_sku`, `sku`, `product_level`, `size`, `color`, `theoretical_stock_qty`, and `actual_stock_qty` with the approved Chinese names.

- [ ] **Step 2: Write failing SQL-contract tests**

For each detail SQL assert:

- `get_time_filter(..., default="Current month", target_type="DATE", remove_filter=True)`;
- a `DATE_SUB(effective_end_exclusive_date, INTERVAL 90 DAY)` lookback;
- `WHERE coverage_complete = 1` and `is_eligible = 1`;
- Jinja `get_filters(column_name, remove_filter=True)` for all 12 non-month native filter fields;
- exact leaf-grain `GROUP BY` columns;
- `COUNT(DISTINCT sales_date, sku)` for effective SKU-day denominator;
- `NULLIF` around every divisor;
- `MAX(theoretical_stock_qty)` and `MAX(actual_stock_qty)` at SKU grain before any total sum;
- direct references to `score`, `order_qty`, `actual_stock_qty` and no literal alias such as `0 AS score`.

- [ ] **Step 3: Run pytest and verify red**

```bash
python3 -m pytest \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  -q
```

Expected: FAIL on missing datasets, counts, fields, and SQL contracts.

- [ ] **Step 4: Add fixed UUIDs and a strict source-column preflight**

Add four stable UUID5-derived values to `UUIDS`:

```python
"dataset_spu_detail": "de2f3527-4fb7-51df-a1ef-067567348ee6",
"dataset_sku_detail": "baea3900-76bf-5de9-8f10-aad2cc5e4b60",
"chart_spu_detail": "4454d29b-3161-5d51-9e7b-7c1a9e96db06",
"chart_sku_detail": "76d38770-7b51-5f9e-b9df-d1b48113b8a3",
```

Extend source column definitions with `score`, `order_qty`, and `actual_stock_qty`. The generator validation must compare an explicit required set and raise:

```python
raise ValueError(
    "hot-product detail datasets require ADS columns: "
    + ", ".join(sorted(missing_columns))
)
```

Do not silently omit a column based on schema availability.

- [ ] **Step 5: Add one reusable native-filter Jinja fragment**

Define the exact supported equality operators used by native select filters:

```jinja
{% for filter in get_filters('channel', remove_filter=True) %}
  {% if filter.get('op') == 'IN' %}
    AND d.channel IN {{ filter.get('val') | where_in }}
  {% elif filter.get('op') == 'NOT IN' %}
    AND d.channel NOT IN {{ filter.get('val') | where_in }}
  {% else %}
    {{ raise('Unsupported channel filter operator: ' ~ filter.get('op')) }}
  {% endif %}
{% endfor %}
```

Generate the same block for `product_line`, `spu`, `country`, `company_sku`, `sku`, `size`, `color`, `developer`, `model`, `sku_level`, and `product_level`. This fragment is applied to the source CTE before leaf aggregation, so page filters never change the fixed `spu_previous_month_sales_level` value.

- [ ] **Step 6: Build SPU and SKU leaf SQL**

Both SQL strings must define CTEs in this exact order: `selected_bounds` reads the left-closed/right-open month range and global waterline; `quality` reuses the existing daily/monthly coverage assertions; `filtered_daily` reads from 90 days before the effective end and applies all consumed native dimensions; `selected_period` limits additive metrics to the selected month range; `leaf_additive` calculates range sums and effective SKU-day denominators; `rolling` calculates the three anchored window numerators; `stock_by_sku` takes one `MAX` snapshot per `ym + sku`; `leaf_rows` joins those results at the approved table grain. The final `SELECT` reads only from `leaf_rows` and includes `WHERE coverage_complete = 1`.

Use these exact date predicates rather than deriving bounds from fact rows:

```sql
d.sales_date >= DATE_SUB(b.effective_end_exclusive_date, INTERVAL 90 DAY)
AND d.sales_date < b.effective_end_exclusive_date
AND p.sales_date >= b.selected_start_date
AND p.sales_date < b.effective_end_exclusive_date
```

SPU `leaf_rows` groups by `ym, spu, spu_previous_month_sales_level, sku_level`. SKU `leaf_rows` groups by `ym, company_sku, sku, product_level, size, color`. Use `AVG(score)` for the leaf score, `SUM(order_qty)` for order quantity, and these exact derived expressions:

```sql
SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date, sku), 0)
SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)
SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)
```

The virtual dataset metrics then operate on already unique leaf rows:

```python
DETAIL_METRICS = {
    "hot_product_index": "AVG(hot_product_index)",
    "score": "AVG(score)",
    "sales_amount_usd": "SUM(sales_amount_usd)",
    "sales_qty": "SUM(sales_qty)",
    "avg_daily_sales_qty": (
        "SUM(sales_qty) / NULLIF(SUM(effective_sku_days), 0)"
    ),
    "gross_profit_usd": "SUM(gross_profit_usd)",
    "gross_margin": (
        "SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)"
    ),
    "return_goods_qty": "SUM(return_goods_qty)",
    "return_rate": (
        "SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)"
    ),
    "order_qty": "SUM(order_qty)",
    "avg_sales_qty_7d": "SUM(sales_qty_7d) / NULLIF(MAX(days_7d), 0)",
    "avg_sales_qty_30d": "SUM(sales_qty_30d) / NULLIF(MAX(days_30d), 0)",
    "avg_sales_qty_90d": "SUM(sales_qty_90d) / NULLIF(MAX(days_90d), 0)",
    "theoretical_stock_qty": "SUM(theoretical_stock_qty)",
    "actual_stock_qty": "SUM(actual_stock_qty)",
}
```

Keep numerator/denominator helper columns hidden through `column_config.visible = false`; do not average already formatted percentages.

- [ ] **Step 7: Re-run generator tests**

```bash
python3 -m pytest \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  -q
```

Expected: dataset/count/SQL tests PASS; chart/layout tests may remain red until Tasks 6 and 7.

- [ ] **Step 8: Commit the dataset layer**

```bash
git add \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py
git commit -m "feat(dashboard): add hot product detail datasets"
```

### Task 6: Generate Both Detail Charts And Exact Formatting

**Files:**
- Modify: `scripts/hot_product_index_dashboard.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`

**Interfaces:**
- Consumes: Task 5 dataset UUIDs/metrics and Task 4 `row_hierarchy_fields` form-data contract.
- Produces: `AG Grid Table Scheme` assets `SPU维度` and `SKU维度` with stable query contexts.

- [ ] **Step 1: Add failing chart-contract tests**

Assert exact group-by order:

```python
assert spu_chart["params"]["groupby"] == [
    "spu",
    "ym",
    "spu_previous_month_sales_level",
    "sku_level",
]
assert spu_chart["params"]["row_hierarchy_fields"] == spu_chart["params"]["groupby"]
assert sku_chart["params"]["groupby"] == [
    "company_sku",
    "sku",
    "ym",
    "product_level",
    "size",
    "color",
]
assert sku_chart["params"]["row_hierarchy_fields"] == []
```

Assert `server_pagination is True`, `server_page_length == 50`, `show_totals is True`, stable sort `ym DESC`, `sales_qty DESC`, then identifier ASC, and exact displayed field sequences from the approved spec.

- [ ] **Step 2: Add failing number and color-format tests**

Assert:

```python
assert column_config["hot_product_index"]["d3NumberFormat"] == ",.1~f"
assert column_config["gross_margin"]["d3NumberFormat"] == ".1~%"
assert column_config["sales_amount_usd"]["currencyFormat"]["symbol"] == "USD"
assert column_config["spu"]["pinned"] == "left"
```

Verify the conditional format array contains exactly these four solid rules and no rule for `NULL`:

```python
[
    {"column": "hot_product_index", "operator": "≤", "targetValue": 0,
     "colorScheme": "#DF7461", "useGradient": False},
    {"column": "hot_product_index", "operator": "< x <", "targetValueLeft": 0,
     "targetValueRight": 5, "colorScheme": "#FFC947", "useGradient": False},
    {"column": "hot_product_index", "operator": "≤ x <", "targetValueLeft": 5,
     "targetValueRight": 10, "colorScheme": "#B7D2B6", "useGradient": False},
    {"column": "hot_product_index", "operator": "≥", "targetValue": 10,
     "colorScheme": "#2978B5", "useGradient": False},
]
```

- [ ] **Step 3: Run pytest and verify red**

```bash
python3 -m pytest tests/unit_tests/scripts/hot_product_index_dashboard_test.py -q
```

Expected: FAIL on missing charts and formatting.

- [ ] **Step 4: Add one table query-context builder**

Extend the existing query-context helper with an `ag_grid_table` branch. For server pagination it must emit base, row-count, and total queries in the same order as `buildQuery.ts`; every query uses datasource `0__table`, JSON/full result mode, and the total query has empty `columns` while retaining the detail metrics.

Do not handcraft a fourth totals query or calculate totals in dashboard JavaScript.

- [ ] **Step 5: Add both chart assets**

Use the approved display order, generic hierarchy configuration, and column settings:

```python
detail_params = {
    "viz_type": "ag-grid-table-scheme",
    "query_mode": "aggregate",
    "server_pagination": True,
    "server_page_length": 50,
    "show_totals": True,
    "include_search": True,
    "allow_rearrange_columns": True,
    "emit_filter": False,
    "row_limit": 100000,
}
```

Pin the four SPU hierarchy columns and the first two SKU identifier columns left. Set identifier columns left-aligned, numeric columns right-aligned, `truncateLongCells: true`, and fixed `columnWidth` values sufficient for their Chinese headers. Use only these D3 formats: `,.1~f` for numeric values, `.1~%` for rates, and USD currency plus `,.1~f` for money.

- [ ] **Step 6: Re-run generator tests**

```bash
python3 -m pytest tests/unit_tests/scripts/hot_product_index_dashboard_test.py -q
```

Expected: chart, formatting, color-boundary, UUID, and query-context tests PASS.

- [ ] **Step 7: Commit the chart assets**

```bash
git add \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py
git commit -m "feat(dashboard): add hot product detail charts"
```

### Task 7: Add Double Tabs, Filter Scopes, And FineBI Styling

**Files:**
- Modify: `scripts/hot_product_index_dashboard.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`

**Interfaces:**
- Consumes: Task 6 chart UUIDs and the existing dashboard position/metadata builders.
- Produces: a dashboard `TABS-DETAIL` node after the funnel row, defaulting to `SPU维度`, with both charts targeted by all 13 native filters.

- [ ] **Step 1: Add failing layout and filter tests**

Assert:

- `TABS-DETAIL` exists after the overview/funnel section;
- child tabs are exactly `TAB-SPU-DETAIL` and `TAB-SKU-DETAIL` in that order;
- only the SPU chart is in the default active tab;
- the generator invariant accepts exactly 14 main-dashboard charts and rejects any missing detail chart UUID;
- each select filter keeps the existing daily dataset first and adds both detail dataset targets using the same physical column;
- month filter targets daily, monthly, status, SPU detail, and SKU detail datasets;
- chart scope excludes only the existing status chart where already required, not either detail chart.

Add CSS substring assertions for `#8AA964`, `#2978B5`, AG Grid header, odd/even rows, pinned columns, and pinned bottom totals.

- [ ] **Step 2: Run pytest and verify red**

```bash
python3 -m pytest tests/unit_tests/scripts/hot_product_index_dashboard_test.py -q
```

Expected: FAIL on layout, filter targets, and CSS.

- [ ] **Step 3: Build the Tab layout**

Add a full-width title band `爆品指数&经营指标报表`, followed by a `TABS` component. Use a stable height that shows at least 10 rows at 50-row server page size without overlapping the next dashboard section. Do not create nested decorative cards around the table charts.

- [ ] **Step 4: Extend native filter targets without changing filter-source behavior**

Keep the daily dataset as the first target so option lists still come from the accepted broad dataset. Add the SPU/SKU detail dataset targets after existing targets. The detail virtual SQL from Task 5 consumes these filters before leaf aggregation.

- [ ] **Step 5: Add narrowly scoped dashboard CSS**

Target only the two detail chart component IDs:

```css
#CHART-SPU-DETAIL .ag-header,
#CHART-SKU-DETAIL .ag-header { background: #8AA964; color: #fff; }
#CHART-SPU-DETAIL .ag-row-even:not(.ag-row-pinned),
#CHART-SKU-DETAIL .ag-row-even:not(.ag-row-pinned) { background: rgba(138,169,100,.05); }
#CHART-SPU-DETAIL .ag-row-odd:not(.ag-row-pinned),
#CHART-SKU-DETAIL .ag-row-odd:not(.ag-row-pinned) { background: rgba(138,169,100,.10); }
#CHART-SPU-DETAIL .ag-row-pinned,
#CHART-SKU-DETAIL .ag-row-pinned { background: #8AA964; font-weight: 700; }
```

Add the active tab blue underline using the actual Superset Tabs DOM selector observed in the generated dashboard. Do not recolor unrelated dashboard tabs or global AG Grid instances.

- [ ] **Step 6: Re-run all generator tests and inspect the generated ZIP**

```bash
python3 -m pytest tests/unit_tests/scripts/hot_product_index_dashboard_test.py -q
python3 scripts/hot_product_index_dashboard.py \
  --output /tmp/hot_product_index_detail_assets.zip
unzip -l /tmp/hot_product_index_detail_assets.zip
```

Expected: pytest PASS; ZIP contains 5 datasets, 15 charts, 2 dashboards, and no database credential asset.

- [ ] **Step 7: Commit dashboard integration**

```bash
git add \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py
git commit -m "feat(dashboard): place hot product detail tabs"
```

### Task 8: Run Independent Local Verification

**Files:**
- Verify: all files changed in Tasks 2-7
- Modify: only files auto-fixed by approved linters within the task file list

**Interfaces:**
- Consumes: complete local implementation commits.
- Produces: a clean, reproducible candidate commit and test evidence; no production mutation.

- [ ] **Step 1: Review scope and accidental changes**

```bash
git status --short
git diff --check HEAD~4..HEAD
git diff --stat HEAD~4..HEAD
git diff --name-only HEAD~4..HEAD
```

Expected: only the mapped plugin, generator, tests, and approved spec/plan files appear. Any unrelated dirty work remains unstaged and outside the commit range.

- [ ] **Step 2: Run focused backend and frontend tests**

```bash
python3 -m pytest tests/unit_tests/scripts/hot_product_index_dashboard_test.py -q
cd superset-frontend
npm run test -- \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/hierarchy.test.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/HierarchyCellRenderer.test.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx \
  --runInBand
```

Expected: all tests PASS.

- [ ] **Step 3: Run production builds**

```bash
cd superset-frontend
npm run build --workspace=@superset-ui/plugin-chart-ag-grid-table-scheme
npm run build
```

Expected: both builds complete with exit code 0 and no new TypeScript or bundle errors.

- [ ] **Step 4: Run the mandatory full pre-commit gate in a clean detached verifier**

First commit every mapped task change in the main worktree, record the candidate commit, and create a detached verification worktree solely to protect the user's unrelated dirty files from all-files auto-fixes:

```bash
candidate_commit="$(git rev-parse HEAD)"
verifier=/tmp/superset-hot-product-precommit
test ! -e "$verifier"
git worktree add --detach "$verifier" "$candidate_commit"
test ! -d /Volumes/extend/ecode-workspace/superset-source/superset-frontend/node_modules || \
  ln -s /Volumes/extend/ecode-workspace/superset-source/superset-frontend/node_modules \
  "$verifier/superset-frontend/node_modules"
cd /tmp/superset-hot-product-precommit
uvx pre-commit run --all-files
```

Expected: all hooks PASS. If a hook modifies files, inspect `git diff` in the detached verifier, reproduce only mapped-file fixes in the main worktree with `apply_patch`, commit them, remove/recreate the verifier at the new commit, and rerun. Never copy or commit changes to unrelated files.

- [ ] **Step 5: Commit verification fixes only when needed**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/hierarchy.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/renderers/HierarchyCellRenderer.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTableChart.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/utils/useColDefs.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/controlPanel.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/hierarchy.test.ts \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/renderers/HierarchyCellRenderer.test.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/AgGridTableChart.test.tsx \
  superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/utils/useColDefs.test.tsx
git diff --cached --check
git commit -m "test(dashboard): verify hot product detail tables"
```

Skip this commit when the verification gate produces no code change.

- [ ] **Step 6: Remove the detached verifier after a clean pass**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git worktree remove /tmp/superset-hot-product-precommit
```

Expected: the main worktree still contains the user's original unrelated dirty changes and no verification-only modifications.

### Task 9: Back Up, Import, And Accept In Production

**Files:**
- Generate: `/tmp/hot_product_index_detail_assets.zip`
- Generate: timestamped production metadata/static/config backup outside the repository
- Modify: production Superset metadata through the approved asset import path only

**Interfaces:**
- Consumes: exact verified commit from Task 8 and the existing `superset-production-ops` release procedure.
- Produces: imported detail datasets/charts/dashboard plus rollback evidence and browser/SQL acceptance results.

- [ ] **Step 1: Load the production operations skill and audit before mutation**

Read `.agents/skills/superset-production-ops/SKILL.md`, record the candidate commit, `git status`, service health, active image/container identifiers, and existing dashboard UUID/title/slug. Do not import while the local candidate contains uncommitted task changes.

- [ ] **Step 2: Create rollback artifacts**

Back up all assets referenced by the main dashboard plus current production config and the deployed static bundle. Verify the backup archive can be listed and contains the main dashboard, 3 existing datasets, and 13 existing charts before proceeding.

- [ ] **Step 3: Generate and import the exact candidate bundle**

```bash
python3 scripts/hot_product_index_dashboard.py \
  --output /tmp/hot_product_index_detail_assets.zip
sha256sum /tmp/hot_product_index_detail_assets.zip
```

Import with the production skill's sparse/overwrite policy for this existing UUID-owned dashboard. Any duplicate UUID/title/slug outside the expected assets, schema error, template error, or plugin loading error aborts the release and leaves the old dashboard active.

- [ ] **Step 4: Rebuild and verify service health**

Rebuild/restart only the services required by the verified deployment procedure. Confirm `/health` returns HTTP 200, the Superset web and worker containers are healthy, and logs contain no new frontend asset, Jinja template, Doris SQL, or chart-data exceptions.

- [ ] **Step 5: Run API and SQL reconciliation**

For one accepted complete month and the current month:

- query both detail charts through the chart-data API;
- verify response columns are Chinese-facing through metadata and contain no missing required field;
- compare 5 SPU groups and 10 SKU leaf rows against direct Doris SQL;
- verify sales/profit/returns/order totals, recomputed rates, average hot index/score, 7/30/90 windows, and de-duplicated stocks;
- run explicit boundary samples for `0`, `0.1`, `4.9`, `5`, `9.9`, `10`, and `NULL` hot-index values.

Expected: every sampled value agrees within source decimal precision; display rounding is at most one digit and does not alter API precision.

- [ ] **Step 6: Run Chrome acceptance against FineBI and OpenBI**

Use the authenticated local Chrome session to compare:

- FineBI reference: `http://bi.wbkjgr.com/webroot/decision/v5/conf/subject/page/edit/32438f1801904a4e83f833ddd5e53adc/report/b4d575c74907450fa4d1f8ea7177d394`
- OpenBI target: `https://openbi.wbkjgr.com/dashboard/hot-product-index/`

Verify default SPU tab, SKU tab switch, every column and Chinese header, hierarchy toggles, fixed columns, server pagination, sorting, all 13 filters, totals, four fill boundaries, header/zebra/total styling, Tooltip, horizontal scroll, no overlap at common desktop widths, and no browser console/request errors.

- [ ] **Step 7: Exercise fail-closed behavior and rollback readiness**

Select an incomplete month and confirm the existing status component reports the gap while detail tables do not show partial business rows. Record the production asset IDs, bundle hash, screenshots, reconciliation query IDs, and backup path. If acceptance fails, restore the backup assets/static/config using the production skill and confirm the original dashboard health before ending the release.

## Final Acceptance Checklist

- [ ] ADS schema/value/lookback gate passed with current production evidence.
- [ ] Five datasets, fifteen charts, and two dashboards generate deterministically with stable UUIDs.
- [ ] SPU hierarchy is page-local, accessible, and resets on any result-set change.
- [ ] SPU/SKU tables preserve the approved field order, Chinese headers, monthly grain, sorting, server pagination, and totals.
- [ ] Hot-index boundaries and all number formats match the exact approved values.
- [ ] Every native filter targets both detail datasets without recalculating SPU rating.
- [ ] Focused pytest/Jest, plugin build, full frontend build, and `uvx pre-commit run --all-files` passed.
- [ ] Production backup, import, health, SQL reconciliation, Chrome comparison, fail-closed check, and rollback evidence completed.
