# WHM Order Detail Advanced Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stable source-code based advanced filter row for the WHM order detail AG Grid table, with server-side filtering for both data and row-count queries.

**Architecture:** Add a standalone `AdvancedFilterBar` component rendered by the `ag-grid-table-scheme` chart container, outside the existing `AgGridDataTable` component. Store the selected column, operator, and value in chart `ownState`; `buildQuery` converts that state into Superset query filters when server pagination is enabled.

**Tech Stack:** Apache Superset 6, React 18, TypeScript, `@superset-ui/core/components`, `@apache-superset/core/translation`, Jest, Superset chart data API, Docker image release for production.

---

## Superset Component Classification

- Task type: visualization plugin change with a feature-local UI component.
- Recommended location: keep `AdvancedFilterBar` inside `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/components/`.
- Do not place this component under `superset-frontend/src/components/`; it is not a reusable Superset UI primitive.
- Do not implement this as a Superset Extension; the requirement changes an existing fork-local `viz_type` render/query path.
- Existing Superset UI primitives are sufficient: use `Button`, `Input`, and `Select` from `@superset-ui/core/components`.
- Storybook is not required for this component because it is chart-plugin-local and not exported for broad reuse. Validate the interaction through Jest/RTL and dashboard smoke checks instead.
- The work touches a chart plugin, so keep rendering, state, query mapping, styles, and tests separated.

---

## Implementation Boundaries

- Work directly in `E:\pyProject\superset`; do not create a worktree unless the user explicitly asks.
- This is a source-code implementation, not a chart-metadata patch. Do not write `matrix_cell_formatter_expression`.
- The new filter UI is a new component, but existing chart container, query builder, types, and styles must be connected.
- Use `@superset-ui/core/components` wrappers for `Button`, `Input`, and `Select`; do not import these directly from `antd` in the new component.
- Do not add JavaScript files. New frontend files must be `.ts` or `.tsx`.
- Do not add `any`; if an existing upstream/local type forces a cast, keep it localized and document it in the final verification notes.
- Keep the existing `AgGridDataTable` search box behavior unchanged.
- Keep code minimal and fail fast. Do not add defensive fallbacks beyond validating that an advanced filter has a column/operator and required value.
- Production upload is a separate phase after local tests and build pass. Remote asset sync alone is not a completed release; production requires Docker image rebuild and Superset service recreation.

## Target Production Context

- URL: `http://111.230.91.24:8088`
- Dashboard: ID `3`, slug `whm-order-detail`, title `物流全链路海外仓订单 / WHM 订单明细`
- Chart: ID `17`, title `WHM 订单明细表`, viz type `ag-grid-table-scheme`
- Dataset: ID `9`, `dws.dws_whm_multi_plat_order_item_wide_display`
- Remote SSH alias: `agentops`
- Remote deployment root: `/home/ubuntu/superset-docker`
- Production image tag: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`

## File Structure

- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts`
  - Add `AdvancedFilterOperator`, `AdvancedFilterState`.
  - Type `ServerPaginationData.advancedFilter`.
  - Type transformed `serverPaginationData` as `ServerPaginationData`.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/utils/externalAPIs.ts`
  - Allow `updateTableOwnState` to accept advanced filter state.
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/components/AdvancedFilterBar.tsx`
  - Standalone filter bar using Superset UI wrappers.
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/components/AdvancedFilterBar.test.tsx`
  - RTL behavior test for apply, clear, disabled, and valueless operators.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTableChart.tsx`
  - Render `AdvancedFilterBar` above the grid.
  - Write `advancedFilter` into `ownState`.
  - Reset `currentPage` to `0` on apply/clear.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTable/index.tsx`
  - Type `serverPaginationData` as `ServerPaginationData`.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/buildQuery.ts`
  - Convert `ownState.advancedFilter` to Superset filters.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/styles/index.tsx`
  - Add filter row layout styles.
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/buildQueryAdvancedFilter.test.ts`
  - Focused unit tests for filter mapping.

---

## Task 1: Preflight And Existing State

**Files:**
- Read: `docs/superpowers/plans/2026-06-18-whm-order-detail-advanced-filter.md`
- Read: `superset-frontend/.nvmrc`
- Read: current Git state

- [ ] **Step 1: Confirm branch and dirty worktree**

```powershell
cd E:\pyProject\superset
git status --short --branch
git rev-parse --abbrev-ref HEAD
```

Expected:
- Branch is `noway-release`.
- Existing partial changes in the advanced-filter files may exist. Do not revert them unless the user explicitly asks.

- [ ] **Step 2: Confirm Node version requirement**

```powershell
cd E:\pyProject\superset\superset-frontend
Get-Content .nvmrc
node --version
npm --version
```

Expected:
- `.nvmrc` prints `v22.22.0`.
- `node --version` must also print `v22.22.0` before running final frontend verification.

- [ ] **Step 3: Install dependencies if missing**

```powershell
cd E:\pyProject\superset\superset-frontend
Test-Path node_modules\.bin\cross-env.cmd
```

If it prints `False`, run:

```powershell
cd E:\pyProject\superset\superset-frontend
npm ci
```

Expected:
- `node_modules\.bin\cross-env.cmd` exists after install.

---

## Task 2: Add Types And Own State Contract

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/utils/externalAPIs.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTable/index.tsx`

- [ ] **Step 1: Add advanced filter types**

In `types.ts`, after `SearchOption`, add:

```ts
export type AdvancedFilterOperator =
  | 'equals'
  | 'notEqual'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'blank'
  | 'notBlank';

export type AdvancedFilterState = {
  column?: string;
  operator?: AdvancedFilterOperator;
  value?: string;
};
```

- [ ] **Step 2: Extend server pagination state**

In `types.ts`, make `ServerPaginationData`:

```ts
export interface ServerPaginationData {
  pageSize?: number;
  currentPage?: number;
  sortBy?: SortByItem[];
  searchText?: string;
  searchColumn?: string;
  advancedFilter?: AdvancedFilterState;
}
```

In `AgGridTableChartTransformedProps`, change:

```ts
serverPaginationData: JsonObject;
```

to:

```ts
serverPaginationData: ServerPaginationData;
```

Remove `JsonObject` from the `@superset-ui/core` import if it becomes unused.

- [ ] **Step 3: Type the external ownState API**

In `utils/externalAPIs.ts`, use:

```ts
import { SetDataMaskHook } from '@superset-ui/core';
import { AdvancedFilterState, SortByItem } from '../types';

interface TableOwnState {
  currentPage?: number;
  pageSize?: number;
  sortColumn?: string;
  sortOrder?: 'asc' | 'desc';
  searchText?: string;
  searchColumn?: string;
  sortBy?: SortByItem[];
  advancedFilter?: AdvancedFilterState;
}
```

- [ ] **Step 4: Type the table component prop**

In `AgGridTable/index.tsx`, replace the `JsonObject` prop type:

```ts
serverPaginationData: JsonObject;
```

with:

```ts
serverPaginationData: ServerPaginationData;
```

Import `ServerPaginationData` from `../types` or the existing relative type path used in that file. Remove the `JsonObject` import if it becomes unused.

---

## Task 3: Write Query Builder Tests First

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/buildQueryAdvancedFilter.test.ts`

- [ ] **Step 1: Create the failing tests**

Create `buildQueryAdvancedFilter.test.ts`:

```ts
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { QueryMode, VizType } from '@superset-ui/core';
import buildQuery from '../../src/table/buildQuery';
import { TableChartFormData } from '../../src/table/types';

const basicFormData: TableChartFormData = {
  viz_type: VizType.TableAgGridScheme,
  datasource: '11__table',
  query_mode: QueryMode.Raw,
  all_columns: ['platform_order_name', 'msku'],
  server_pagination: true,
  server_page_length: 50,
};

test('adds advanced equality filter to server pagination data and rowcount queries', () => {
  const queryContext = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'platform_order_name',
        operator: 'equals',
        value: '#5578',
      },
    },
  });

  expect(queryContext.queries[0].filters).toContainEqual({
    col: 'platform_order_name',
    op: '==',
    val: '#5578',
  });
  expect(queryContext.queries[1].filters).toContainEqual({
    col: 'platform_order_name',
    op: '==',
    val: '#5578',
  });
});

test('maps multi-value equality and inequality filters to IN and NOT IN', () => {
  const [inQuery] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'platform_order_name',
        operator: 'equals',
        value: '#5578\n#5579，#5580;#5581',
      },
    },
  }).queries;

  expect(inQuery.filters).toContainEqual({
    col: 'platform_order_name',
    op: 'IN',
    val: ['#5578', '#5579', '#5580', '#5581'],
  });

  const [notInQuery] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'platform_order_name',
        operator: 'notEqual',
        value: '#5578 #5579',
      },
    },
  }).queries;

  expect(notInQuery.filters).toContainEqual({
    col: 'platform_order_name',
    op: 'NOT IN',
    val: ['#5578', '#5579'],
  });
});

test('maps text pattern and blank filters', () => {
  const [containsQuery] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'msku',
        operator: 'contains',
        value: 'BK24',
      },
    },
  }).queries;

  expect(containsQuery.filters).toContainEqual({
    col: 'msku',
    op: 'ILIKE',
    val: '%BK24%',
  });

  const [blankQuery] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'msku',
        operator: 'blank',
        value: '',
      },
    },
  }).queries;

  expect(blankQuery.filters).toContainEqual({
    col: 'msku',
    op: 'IS NULL',
    val: null,
  });
});

test('ignores incomplete value-based advanced filters', () => {
  const [query] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'msku',
        operator: 'notEqual',
        value: '',
      },
    },
  }).queries;

  expect(query.filters || []).toEqual([]);
});
```

- [ ] **Step 2: Verify RED**

```powershell
cd E:\pyProject\superset\superset-frontend
.\node_modules\.bin\jest.cmd --silent --testRegex "plugins/plugin-chart-ag-grid-table-scheme/test/table/buildQueryAdvancedFilter.test.ts"
```

Expected before implementing `buildQuery` changes:
- The test file runs.
- At least one assertion fails because `advancedFilter` is not converted into query filters.
- If the command fails with `cross-env is not recognized`, run Task 1 Step 3 first.

---

## Task 4: Implement Advanced Filter Query Mapping

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/buildQuery.ts`

- [ ] **Step 1: Add imports**

Change the local type import to:

```ts
import {
  AdvancedFilterOperator,
  AdvancedFilterState,
  TableChartFormData,
} from './types';
```

- [ ] **Step 2: Add conversion helpers after `getQueryMode`**

```ts
const splitAdvancedFilterValues = (value: string): string[] => [
  ...new Set(
    value
      .split(/[\s,;\uFF0C\uFF1B]+/)
      .map(part => part.trim())
      .filter(Boolean),
  ),
];

const wrapAdvancedFilterValue = (
  operator: AdvancedFilterOperator,
  value: string,
) => {
  if (operator === 'contains' || operator === 'notContains') {
    return `%${value}%`;
  }
  if (operator === 'startsWith') {
    return `${value}%`;
  }
  if (operator === 'endsWith') {
    return `%${value}`;
  }
  return value;
};

const getAdvancedFilterOp = (operator: AdvancedFilterOperator) => {
  const opMap: Record<AdvancedFilterOperator, string> = {
    equals: '==',
    notEqual: '!=',
    contains: 'ILIKE',
    notContains: 'NOT ILIKE',
    startsWith: 'ILIKE',
    endsWith: 'ILIKE',
    lessThan: '<',
    lessThanOrEqual: '<=',
    greaterThan: '>',
    greaterThanOrEqual: '>=',
    blank: 'IS NULL',
    notBlank: 'IS NOT NULL',
  };
  return opMap[operator];
};

const buildAdvancedFilter = (advancedFilter?: AdvancedFilterState) => {
  const column = advancedFilter?.column;
  const operator = advancedFilter?.operator;
  if (!column || !operator) {
    return null;
  }

  if (operator === 'blank' || operator === 'notBlank') {
    return {
      col: column,
      op: getAdvancedFilterOp(operator),
      val: null,
    };
  }

  const value = String(advancedFilter.value || '').trim();
  if (!value) {
    return null;
  }

  const values = splitAdvancedFilterValues(value);
  if (values.length > 1 && operator === 'equals') {
    return {
      col: column,
      op: 'IN',
      val: values,
    };
  }
  if (values.length > 1 && operator === 'notEqual') {
    return {
      col: column,
      op: 'NOT IN',
      val: values,
    };
  }

  return {
    col: column,
    op: getAdvancedFilterOp(operator),
    val: wrapAdvancedFilterValue(operator, value),
  };
};
```

- [ ] **Step 3: Inject the advanced filter after existing search filter logic**

Inside `if (formData.server_pagination)`, after the existing `ownState.searchText` block, add:

```ts
const advancedFilter = buildAdvancedFilter(
  ownState.advancedFilter as AdvancedFilterState | undefined,
);
if (advancedFilter) {
  queryObject = {
    ...queryObject,
    filters: [...(queryObject.filters || []), advancedFilter],
  };
}
```

This must happen before the server-pagination return block so both the data query and rowcount query inherit the same filter.

- [ ] **Step 4: Fix touched-file lint blocker**

In the server-pagination rowcount query, replace the constant-nullish expression:

```ts
row_limit: Number(formData?.row_limit) ?? 0,
```

with:

```ts
row_limit: Number(formData?.row_limit ?? 0),
```

- [ ] **Step 5: Verify GREEN**

```powershell
cd E:\pyProject\superset\superset-frontend
.\node_modules\.bin\jest.cmd --silent --testRegex "plugins/plugin-chart-ag-grid-table-scheme/test/table/buildQueryAdvancedFilter.test.ts"
```

Expected:
- All tests in `buildQueryAdvancedFilter.test.ts` pass.

---

## Task 5: Add The Standalone Advanced Filter Component

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/components/AdvancedFilterBar.tsx`
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/table/components/AdvancedFilterBar.test.tsx`

- [ ] **Step 1: Create the component**

Create `AdvancedFilterBar.tsx`:

```tsx
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Button, Input, Select } from '@superset-ui/core/components';
import {
  AdvancedFilterOperator,
  AdvancedFilterState,
  SearchOption,
} from '../types';

const VALUELESS_OPERATORS = new Set<AdvancedFilterOperator>([
  'blank',
  'notBlank',
]);

const OPERATOR_OPTIONS: {
  value: AdvancedFilterOperator;
  label: string;
}[] = [
  { value: 'equals', label: '等于' },
  { value: 'notEqual', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'notContains', label: '不包含' },
  { value: 'startsWith', label: '开头是' },
  { value: 'endsWith', label: '结尾是' },
  { value: 'lessThan', label: '小于' },
  { value: 'lessThanOrEqual', label: '小于等于' },
  { value: 'greaterThan', label: '大于' },
  { value: 'greaterThanOrEqual', label: '大于等于' },
  { value: 'blank', label: '为空' },
  { value: 'notBlank', label: '不为空' },
];

type AdvancedFilterBarProps = {
  searchOptions: SearchOption[];
  value?: AdvancedFilterState;
  onApply: (filter: AdvancedFilterState) => void;
  onClear: () => void;
};

export default function AdvancedFilterBar({
  searchOptions,
  value,
  onApply,
  onClear,
}: AdvancedFilterBarProps) {
  const fallbackColumn = searchOptions[0]?.value ?? '';
  const [column, setColumn] = useState(value?.column || fallbackColumn);
  const [operator, setOperator] = useState<AdvancedFilterOperator>(
    value?.operator || 'equals',
  );
  const [filterValue, setFilterValue] = useState(value?.value || '');

  useEffect(() => {
    setColumn(value?.column || fallbackColumn);
    setOperator(value?.operator || 'equals');
    setFilterValue(value?.value || '');
  }, [value?.column, value?.operator, value?.value, fallbackColumn]);

  const needsValue = !VALUELESS_OPERATORS.has(operator);
  const selectedColumnExists = useMemo(
    () => searchOptions.some(option => option.value === column),
    [column, searchOptions],
  );
  const effectiveColumn = selectedColumnExists ? column : fallbackColumn;
  const applyDisabled = !effectiveColumn || (needsValue && !filterValue.trim());

  if (!searchOptions.length) {
    return null;
  }

  return (
    <div className="advanced-filter-container">
      <Select
        className="advanced-filter-column"
        value={effectiveColumn}
        options={searchOptions}
        onChange={nextColumn => setColumn(String(nextColumn))}
        ariaLabel={t('Filter column')}
      />
      <Select
        className="advanced-filter-operator"
        value={operator}
        options={OPERATOR_OPTIONS}
        onChange={nextOperator =>
          setOperator(nextOperator as AdvancedFilterOperator)
        }
        ariaLabel={t('Filter operator')}
      />
      <Input
        className="advanced-filter-value"
        value={filterValue}
        disabled={!needsValue}
        placeholder={needsValue ? '筛选值' : ''}
        onChange={event => setFilterValue(event.target.value)}
        onPressEnter={() => {
          if (!applyDisabled) {
            onApply({ column: effectiveColumn, operator, value: filterValue });
          }
        }}
        aria-label={t('Filter value')}
      />
      <Button
        buttonStyle="primary"
        disabled={applyDisabled}
        onClick={() =>
          onApply({ column: effectiveColumn, operator, value: filterValue })
        }
      >
        筛选
      </Button>
      <Button
        buttonStyle="secondary"
        onClick={() => {
          setFilterValue('');
          onClear();
        }}
      >
        清空
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create the component behavior test**

Create `AdvancedFilterBar.test.tsx`:

```tsx
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { render, screen, userEvent } from '@superset-ui/core/spec';
import AdvancedFilterBar from '../../../src/table/components/AdvancedFilterBar';

const searchOptions = [
  { value: 'platform_name', label: '平台' },
  { value: 'platform_order_name', label: '平台订单号' },
];

test('applies an advanced filter with the selected value', () => {
  const onApply = jest.fn();
  render(
    <AdvancedFilterBar
      searchOptions={searchOptions}
      onApply={onApply}
      onClear={jest.fn()}
    />,
  );

  userEvent.type(screen.getByLabelText('Filter value'), 'Amazon');
  userEvent.click(screen.getByRole('button', { name: /筛\s*选/ }));

  expect(onApply).toHaveBeenCalledWith({
    column: 'platform_name',
    operator: 'equals',
    value: 'Amazon',
  });
});

test('disables apply until value-based filters have a value', () => {
  render(
    <AdvancedFilterBar
      searchOptions={searchOptions}
      onApply={jest.fn()}
      onClear={jest.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: /筛\s*选/ })).toBeDisabled();
});

test('supports valueless blank filters', () => {
  const onApply = jest.fn();
  render(
    <AdvancedFilterBar
      searchOptions={searchOptions}
      value={{ column: 'platform_name', operator: 'blank' }}
      onApply={onApply}
      onClear={jest.fn()}
    />,
  );

  expect(screen.getByLabelText('Filter value')).toBeDisabled();
  userEvent.click(screen.getByRole('button', { name: /筛\s*选/ }));

  expect(onApply).toHaveBeenCalledWith({
    column: 'platform_name',
    operator: 'blank',
    value: '',
  });
});

test('clears the local value and notifies the container', () => {
  const onClear = jest.fn();
  render(
    <AdvancedFilterBar
      searchOptions={searchOptions}
      value={{ column: 'platform_name', operator: 'equals', value: 'Amazon' }}
      onApply={jest.fn()}
      onClear={onClear}
    />,
  );

  userEvent.click(screen.getByRole('button', { name: /清\s*空/ }));

  expect(screen.getByLabelText('Filter value')).toHaveValue('');
  expect(onClear).toHaveBeenCalledTimes(1);
});
```

---

## Task 6: Render The Filter In The Chart Container

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTableChart.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/table/styles/index.tsx`

- [ ] **Step 1: Import component and types**

In `AgGridTableChart.tsx`, update imports:

```ts
import {
  AgGridTableChartTransformedProps,
  AdvancedFilterState,
  InputColumn,
  SearchOption,
  SortByItem,
} from './types';
import AdvancedFilterBar from './components/AdvancedFilterBar';
```

- [ ] **Step 2: Reserve height for the filter row**

Change `getGridHeight` to:

```ts
const getGridHeight = (
  height: number,
  includeSearch: boolean | undefined,
  includeAdvancedFilter: boolean,
  columnViewToolbarHeight: number,
) => {
  let calculatedGridHeight = height;
  if (includeSearch) {
    calculatedGridHeight -= 16;
  }
  if (includeAdvancedFilter) {
    calculatedGridHeight -= 44;
  }
  return calculatedGridHeight - 80 - columnViewToolbarHeight;
};
```

- [ ] **Step 3: Keep existing search options and add all-column advanced options**

Keep native search string-only:

```ts
useEffect(() => {
  const options = columns
    .filter(col => col?.dataType === GenericDataType.String)
    .map(column => ({
      value: column.key,
      label: column.label,
    }));

  setSearchOptions(currentOptions =>
    isEqual(options, currentOptions) ? currentOptions : options || [],
  );
}, [columns]);
```

Add advanced options after that effect:

```ts
const advancedFilterOptions = useMemo(
  () =>
    columns
      .filter(column => column?.key)
      .map(column => ({
        value: column.key,
        label: column.label,
      })),
  [columns],
);
```

- [ ] **Step 4: Add visibility and handlers**

Before `gridHeight`, add:

```ts
const showAdvancedFilter = Boolean(
  serverPagination && advancedFilterOptions.length,
);
```

Update the `getGridHeight` call:

```ts
const gridHeight = getGridHeight(
  height,
  includeSearch,
  showAdvancedFilter,
  effectiveColumnViewToolbarHeight,
);
```

Near `handleSearch`, add:

```ts
const handleAdvancedFilterApply = useCallback(
  (advancedFilter: AdvancedFilterState) => {
    const modifiedOwnState = {
      ...(serverPaginationData || {}),
      advancedFilter,
      currentPage: 0,
    };
    updateTableOwnState(setDataMask, modifiedOwnState);
  },
  [setDataMask, serverPaginationData],
);

const handleAdvancedFilterClear = useCallback(() => {
  const restState = { ...(serverPaginationData || {}) };
  delete restState.advancedFilter;
  const modifiedOwnState = {
    ...restState,
    currentPage: 0,
  };
  updateTableOwnState(setDataMask, modifiedOwnState);
}, [setDataMask, serverPaginationData]);
```

- [ ] **Step 5: Render above `AgGridDataTable`**

Inside `<StyledChartContainer height={height}>`, before `<AgGridDataTable ...>`, add:

```tsx
{showAdvancedFilter && (
  <AdvancedFilterBar
    searchOptions={advancedFilterOptions}
    value={serverPaginationData?.advancedFilter}
    onApply={handleAdvancedFilterApply}
    onClear={handleAdvancedFilterClear}
  />
)}
```

- [ ] **Step 6: Add styles**

In `styles/index.tsx`, inside `StyledChartContainer` after `.search-container`, add:

```ts
.advanced-filter-container {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: ${theme.sizeUnit * 2}px;
  margin-bottom: ${theme.sizeUnit * 3}px;
  min-height: ${theme.sizeUnit * 8}px;
}

.advanced-filter-column {
  min-width: ${theme.sizeUnit * 38}px;
}

.advanced-filter-operator {
  min-width: ${theme.sizeUnit * 26}px;
}

.advanced-filter-value {
  width: ${theme.sizeUnit * 48}px;
}

.advanced-filter-container .superset-button {
  height: ${theme.sizeUnit * 8}px;
  padding: 0 ${theme.sizeUnit * 3}px;
}
```

---

## Task 7: Local Verification

**Files:**
- Read: all modified source and test files
- Generated by build: `superset/static/assets/`

- [ ] **Step 1: Run focused query-builder test**

```powershell
cd E:\pyProject\superset\superset-frontend
.\node_modules\.bin\jest.cmd --silent --testRegex "plugins/plugin-chart-ag-grid-table-scheme/test/table/buildQueryAdvancedFilter.test.ts"
```

Expected:
- PASS.

- [ ] **Step 2: Run focused component behavior test**

```powershell
cd E:\pyProject\superset\superset-frontend
.\node_modules\.bin\jest.cmd --silent --testRegex "plugins/plugin-chart-ag-grid-table-scheme/test/table/components/AdvancedFilterBar.test.tsx"
```

Expected:
- PASS.

- [ ] **Step 3: Run plugin test subset**

```powershell
cd E:\pyProject\superset\superset-frontend
.\node_modules\.bin\jest.cmd --silent --testRegex "plugins/plugin-chart-ag-grid-table-scheme/test/.*\.test\.[jt]sx?$"
```

Expected:
- PASS or only unrelated pre-existing failures. Any failure in advanced-filter tests is blocking.

- [ ] **Step 4: Run targeted lint check**

```powershell
cd E:\pyProject\superset\superset-frontend
.\node_modules\.bin\oxlint.cmd plugins/plugin-chart-ag-grid-table-scheme/src/table/components/AdvancedFilterBar.tsx plugins/plugin-chart-ag-grid-table-scheme/src/table/AgGridTableChart.tsx plugins/plugin-chart-ag-grid-table-scheme/src/table/buildQuery.ts plugins/plugin-chart-ag-grid-table-scheme/src/table/transformProps.ts plugins/plugin-chart-ag-grid-table-scheme/src/table/types.ts plugins/plugin-chart-ag-grid-table-scheme/test/table/buildQueryAdvancedFilter.test.ts plugins/plugin-chart-ag-grid-table-scheme/test/table/components/AdvancedFilterBar.test.tsx --config oxlint.json
```

Expected:
- Exit code `0`.
- Any warning must be checked and classified as new or pre-existing.

- [ ] **Step 5: Run TypeScript check**

```powershell
cd E:\pyProject\superset\superset-frontend
npm run type -- --pretty false
```

Expected:
- `tsc` exits `0`.
- If this is blocked by pre-existing repository declaration or plugin typing issues, record the first unrelated error and run the build gate before considering local verification sufficient.

- [ ] **Step 6: Run whitespace check**

```powershell
cd E:\pyProject\superset
git diff --check
```

Expected:
- No whitespace errors. Git line-ending warnings alone do not block unless file content churn is introduced.

- [ ] **Step 7: Build frontend assets**

```powershell
cd E:\pyProject\superset\superset-frontend
$env:BABEL_ENV = 'testableProduction'
npm run build
```

Expected:
- Build exits `0`.
- `E:\pyProject\superset\superset\static\assets\manifest.json` exists and is updated.

---

## Task 8: Local Runtime Smoke Check

**Files:**
- Read: local Superset runtime if available
- No source files changed in this task

- [ ] **Step 1: Check local health**

```powershell
curl.exe -f http://localhost:8088/health
```

Expected:
- `OK`.

If local Superset is not running, record this as local-environment unavailable and continue only if Task 7 passed. Do not treat missing local dev server as production readiness.

- [ ] **Step 2: Open local dashboard if available**

```text
http://localhost:8088/superset/dashboard/whm-order-detail/
```

Expected:
- `WHM 订单明细表` renders.
- Advanced filter row is visible above the grid when server pagination is enabled.
- Applying `平台` / `包含` / `Amazon` resets to the first page.
- Network request body contains the advanced filter in both data and rowcount queries.

---

## Task 9: Production Release Preconditions

**Files/Targets:**
- Local source tree: `E:\pyProject\superset`
- Remote deployment root: `/home/ubuntu/superset-docker`

- [ ] **Step 1: Confirm user approval for production release**

Production release changes the remote running Superset service. Do not run Task 10 without explicit user approval after local verification passes.

- [ ] **Step 2: Check production health before release**

```powershell
curl.exe -fsS --connect-timeout 10 http://111.230.91.24:8088/health
```

Expected:
- `OK`.

- [ ] **Step 3: Check SSH and Docker deployment shape**

Run from a shell with SSH access:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops 'cd /home/ubuntu/superset-docker && bash -s' <<'REMOTE'
set -u
printf 'PWD=%s\n' "$PWD"
printf 'COMPOSE_SERVICES\n'
docker compose config --services
printf 'COMPOSE_PS\n'
docker compose ps
printf 'SUPERSET_HEALTH\n'
curl -fsS http://127.0.0.1:8088/health
REMOTE
```

Expected:
- Services include `redis` and `superset`.
- Superset service is healthy.
- Server-local health returns `OK`.

- [ ] **Step 4: Dry-run asset sync**

From WSL/Git Bash:

```bash
rsync -ainc --delete \
  /e/pyProject/superset/superset/static/assets/ \
  agentops:/home/ubuntu/superset-docker/superset-source/superset/static/assets/
```

Expected:
- Output only reflects generated asset changes.
- If unexpected non-asset paths appear, stop and inspect the command/path.

---

## Task 10: Production Upload And Rebuild

**Files/Targets:**
- Remote source assets: `/home/ubuntu/superset-docker/superset-source/superset/static/assets/`
- Remote backup: `/home/ubuntu/superset-docker/backups/assets-<timestamp>`
- Remote image: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- Remote service: `superset`

- [ ] **Step 1: Back up remote assets**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && bash -s' <<'REMOTE'
set -euo pipefail
ts="$(date +%Y%m%d%H%M%S)"
mkdir -p backups
cp -a superset-source/superset/static/assets "backups/assets-$ts"
printf 'assets_backup=%s\n' "backups/assets-$ts"
REMOTE
```

Expected:
- Prints a concrete `assets_backup=backups/assets-...` path.

- [ ] **Step 2: Sync built assets**

```bash
rsync -az --delete \
  /e/pyProject/superset/superset/static/assets/ \
  agentops:/home/ubuntu/superset-docker/superset-source/superset/static/assets/
```

Expected:
- `rsync` exits `0`.

- [ ] **Step 3: Rebuild production image**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker build -f Dockerfile.doris-zh -t apache-superset-doris:6.0.0-zh-column-scheme-matrix .'
```

Expected:
- Docker build exits `0`.

- [ ] **Step 4: Recreate Superset service**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose up -d superset && docker ps --format "{{.Names}} {{.Status}}" | grep apache-superset'
```

Expected:
- `apache-superset` appears in Docker output.

- [ ] **Step 5: Wait for Docker health**

```bash
ssh agentops 'for i in $(seq 1 24); do status="$(docker inspect -f "{{.State.Health.Status}}" apache-superset 2>/dev/null || true)"; printf "%s\n" "$status"; test "$status" = healthy && exit 0; sleep 5; done; exit 1'
```

Expected:
- Prints `healthy` and exits `0`.

---

## Task 11: Production Verification

**Files/Targets:**
- Production dashboard: `http://111.230.91.24:8088/superset/dashboard/whm-order-detail/`
- Production chart data API
- Production Docker logs

- [ ] **Step 1: Verify HTTP health**

```bash
ssh agentops 'curl -fsS http://127.0.0.1:8088/health'
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
ssh agentops 'docker inspect -f "{{.Image}} {{.State.Status}} {{.State.Health.Status}}" apache-superset'
```

Expected:
- Both health checks print `OK`.
- Docker state is `running healthy`.

- [ ] **Step 2: Verify dashboard UI**

Open:

```text
http://111.230.91.24:8088/superset/dashboard/whm-order-detail/
```

Expected:
- Dashboard renders.
- `WHM 订单明细表` renders.
- A standalone filter row appears above the AG Grid table.
- Existing `Search by` row remains unchanged.

- [ ] **Step 3: Verify filter behavior**

Use the UI:

1. Select column `平台`.
2. Select operator `包含`.
3. Enter `Amazon`.
4. Click `筛选`.

Expected:
- Table refreshes to page `1`.
- Rows match `Amazon`.
- Data query and rowcount query both contain:

```json
{
  "col": "platform_name",
  "op": "ILIKE",
  "val": "%Amazon%"
}
```

Then click `清空`.

Expected:
- Filter is removed.
- Table returns to first page.

- [ ] **Step 4: Verify no new server errors**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose logs --tail=300 superset | egrep -i "advancedFilter|ag-grid-table-scheme|error|exception|traceback" || true'
```

Expected:
- No new traceback or asset 404 caused by this release.

---

## Rollback

Use rollback only if the dashboard fails to load, the chart data API fails, or the advanced filter causes production errors.

- [ ] **Step 1: Restore remote assets**

Replace `<backup-path>` with the `assets_backup` path printed in Task 10.

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && rm -rf superset-source/superset/static/assets && cp -a <backup-path> superset-source/superset/static/assets'
```

- [ ] **Step 2: Rebuild image and restart service**

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker build -f Dockerfile.doris-zh -t apache-superset-doris:6.0.0-zh-column-scheme-matrix .'
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose up -d superset'
ssh agentops 'for i in $(seq 1 24); do status="$(docker inspect -f "{{.State.Health.Status}}" apache-superset 2>/dev/null || true)"; printf "%s\n" "$status"; test "$status" = healthy && exit 0; sleep 5; done; exit 1'
```

- [ ] **Step 3: Verify rollback health**

```powershell
curl.exe -fsS --connect-timeout 10 http://111.230.91.24:8088/health
```

Expected:
- `OK`.

---

## Acceptance Checklist

- [ ] Task is classified as a visualization plugin change with a feature-local UI component.
- [ ] The new component is not placed under global `superset-frontend/src/components/`.
- [ ] `AdvancedFilterBar.tsx` exists and imports UI controls from `@superset-ui/core/components`.
- [ ] No new `any` types are introduced.
- [ ] No new JavaScript files are introduced.
- [ ] Storybook is intentionally not added because the component is chart-plugin-local and not broadly reusable.
- [ ] Existing `AgGridDataTable` search UI remains unchanged.
- [ ] Advanced filter state is stored in chart `ownState`, not chart metadata.
- [ ] Applying and clearing the filter reset `currentPage` to `0`.
- [ ] `buildQuery` maps:
  - `equals` -> `==`
  - multi-value `equals` -> `IN`
  - `notEqual` -> `!=`
  - multi-value `notEqual` -> `NOT IN`
  - `contains` -> `ILIKE %value%`
  - `notContains` -> `NOT ILIKE %value%`
  - `startsWith` -> `ILIKE value%`
  - `endsWith` -> `ILIKE %value`
  - `blank` -> `IS NULL`
  - `notBlank` -> `IS NOT NULL`
- [ ] Focused Jest test passes.
- [ ] `AdvancedFilterBar.test.tsx` verifies apply, clear, disabled state, and valueless operator behavior.
- [ ] Plugin test subset passes or unrelated failures are documented.
- [ ] Targeted lint exits `0`; warnings are classified as new or pre-existing.
- [ ] Type check passes.
- [ ] Production build passes.
- [ ] Production upload runs only after explicit user approval.
- [ ] Production image is rebuilt with `Dockerfile.doris-zh`.
- [ ] Production service is recreated and Docker health is `healthy`.
- [ ] Production dashboard shows the filter row.
- [ ] Production chart data request returns `200`.
- [ ] Production `/health` returns `OK`.
- [ ] Rollback backup path is recorded if production release is executed.

## Self-Review

- Placeholder scan: no placeholder markers or unspecified implementation steps remain.
- Component-guidance alignment: the task is classified before implementation, the component remains feature-local, and the plan avoids global component promotion.
- Project-rule alignment: direct `antd` import in the new component is forbidden and replaced with Superset UI wrappers.
- UI-library alignment: `Select` uses `ariaLabel`; `Button` uses `buttonStyle`; controls come from `@superset-ui/core/components`.
- Testing alignment: top-level `test()` is used for new focused tests.
- Storybook alignment: Storybook is explicitly skipped because this is not a reusable component.
- Runtime alignment: Node `v22.22.0`, `npm ci`, focused tests, type check, and production build are explicit gates.
- Production alignment: release uses asset backup, asset sync, `Dockerfile.doris-zh` image rebuild, `docker compose up -d superset`, Docker health, HTTP health, browser verification, and rollback.
