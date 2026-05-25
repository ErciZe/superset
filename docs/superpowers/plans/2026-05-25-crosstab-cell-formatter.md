# Crosstab Dynamic Cell Formatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Crosstab-local JavaScript cell formatter for generated matrix value cells without changing query behavior, row dimension rendering, sorting, totals, or export output.

**Architecture:** Keep the formatter entirely inside `plugin-chart-crosstab-table`: a focused formatter module compiles, validates, formats, and normalizes callback results; the control panel exposes one JavaScript text area; `CrosstabTable` applies the formatter only in generated value column definitions. Runtime errors propagate so invalid callback code fails fast instead of silently falling back.

**Tech Stack:** TypeScript, React, Superset chart controls, AG Grid column definitions, Jest, React Testing Library, Prettier standalone, `sanitizeHtml` from `@superset-ui/core`.

---

## Reference

Approved spec:
`docs/superpowers/specs/2026-05-25-crosstab-cell-formatter-design.md`

Primary plugin:
`superset-frontend/plugins/plugin-chart-crosstab-table`

Do not open a worktree. Work directly in
`/Volumes/extend/ecode-workspace/superset-source`, preserving unrelated dirty files.

## File Map

- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/cellFormatter.ts`
  - Own the default commented callback, comment stripping, callback compilation, result normalization, style whitelist, validation, Prettier formatting, and runtime formatter factory.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  - Add `crosstabCellFormatterExpression?: string` to `CrosstabFormData`.
  - Add local callback context/result types if they are reused outside the formatter module.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
  - Import formatter helpers.
  - Add one `TextAreaControl` named `crosstabCellFormatterExpression` in the `Crosstab` section near `conditionalFormatting`.
  - Wire validation, formatting hotkeys, default commented example, and `resetOnHide: false`.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
  - Import `sanitizeHtml` and `createCrosstabCellFormatter`.
  - Create the formatter from `formData.crosstabCellFormatterExpression`.
  - Pass the formatter to generated leaf columns only.
  - Merge formatter style last, override display with `text` or sanitized `html`, and apply `tooltip` and `className`.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/cellFormatter.test.ts`
  - Cover disabled inputs, compilation, primitive/object normalization, supported fields, unsupported fields, unsupported style fields, non-function source, and formatting.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
  - Extend the mocked AG Grid renderer so React nodes, `title`, `className`, and `dangerouslySetInnerHTML` can be asserted.
  - Add rendering tests for text, sanitized HTML, style/tooltip/className, conditional-style override, and row dimension exclusion.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
  - Assert the new control exists and validate valid/invalid callback behavior.

## Task 1: Build the Formatter Module with Failing Tests

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/cellFormatter.test.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/cellFormatter.ts`

- [ ] **Step 1: Write the failing formatter tests**

Create `test/crosstab/cellFormatter.test.ts`:

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
import type { ColDef } from '@superset-ui/core/components/ThemedAgGridReact';
import {
  CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT,
  createCrosstabCellFormatter,
  formatCrosstabCellFormatterCallback,
  validateCrosstabCellFormatterCallback,
  validateCrosstabCellFormatterExpression,
} from '../../src/crosstab/cellFormatter';

const baseParams = {
  value: 12,
  valueFormatted: '12.0',
  data: { contract_type: 'A', metric_name: 'Sales', amount: 12 },
  rowIndex: 3,
  colDef: {
    field: '__crosstab_col__string:4:Cash__metric__amount',
    headerName: 'Cash amount',
  } as ColDef,
  api: undefined,
  column: undefined,
  context: undefined,
  node: undefined,
} as never;

describe('crosstab cellFormatter', () => {
  it.each([undefined, null, '', '   ', '/* comment only */', '// comment only'])(
    'disables formatting for empty expression %p',
    expression => {
      expect(createCrosstabCellFormatter(expression)).toBeUndefined();
      expect(validateCrosstabCellFormatterCallback(expression)).toBe(false);
    },
  );

  it('exposes a commented default expression that is disabled', () => {
    expect(CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT).toContain('回调示例');
    expect(createCrosstabCellFormatter(CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT)).toBeUndefined();
  });

  it('compiles function and arrow-function callbacks', () => {
    expect(validateCrosstabCellFormatterExpression('({ value }) => value')).toBe(false);
    expect(validateCrosstabCellFormatterExpression('function formatter({ value }) { return value; }')).toBe(false);
  });

  it('normalizes primitive callback returns to text', () => {
    const formatter = createCrosstabCellFormatter('({ rawValue }) => rawValue > 10 ? "high" : "low"');

    expect(formatter?.(baseParams)).toEqual({ text: 'high' });
  });

  it('supports text, html, tooltip, className, and whitelisted style fields', () => {
    const formatter = createCrosstabCellFormatter(`({ value, rawValue, cell, column, rowIndex }) => ({
      text: String(value),
      html: '<strong>' + rawValue + '</strong>',
      tooltip: cell.field + ':' + column.metric + ':' + rowIndex,
      className: 'is-highlighted',
      style: {
        backgroundColor: '#fff1b8',
        color: '#1f1f1f',
        fontWeight: 600,
        fontStyle: 'italic',
        textAlign: 'right',
        textDecoration: 'underline',
        opacity: 0.9,
      },
    })`);

    expect(formatter?.(baseParams)).toEqual({
      text: '12.0',
      html: '<strong>12</strong>',
      tooltip: '__crosstab_col__string:4:Cash__metric__amount:amount:3',
      className: 'is-highlighted',
      style: {
        backgroundColor: '#fff1b8',
        color: '#1f1f1f',
        fontWeight: 600,
        fontStyle: 'italic',
        textAlign: 'right',
        textDecoration: 'underline',
        opacity: 0.9,
      },
    });
  });

  it('throws for unsupported result fields', () => {
    expect(() =>
      createCrosstabCellFormatter('() => ({ unknownField: true })')?.(baseParams),
    ).toThrow('unsupported result field "unknownField"');
  });

  it('throws for unsupported style fields', () => {
    expect(() =>
      createCrosstabCellFormatter('() => ({ style: { border: "1px solid red" } })')?.(baseParams),
    ).toThrow('unsupported style field "border"');
  });

  it('throws for non-function source', () => {
    expect(() => validateCrosstabCellFormatterCallback('({ text: "x" })')).toThrow(
      'Crosstab cell formatter callback must be a function.',
    );
  });

  it('formats valid callback source with Prettier', async () => {
    await expect(
      formatCrosstabCellFormatterCallback('({value})=>({text:value})'),
    ).resolves.toContain('({ value }) => ({ text: value })');
  });
});
```

- [ ] **Step 2: Run the formatter tests to verify they fail**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/crosstab/cellFormatter.test.ts --runInBand
```

Expected: fail because `../../src/crosstab/cellFormatter` does not exist.

- [ ] **Step 3: Implement the formatter module**

Create `src/crosstab/cellFormatter.ts`:

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
import type { CSSProperties } from 'react';
import type { DataRecord, DataRecordValue } from '@superset-ui/core';
import type {
  ColDef,
  CustomCellRendererProps,
} from '@superset-ui/core/components/ThemedAgGridReact';

const STYLE_WHITELIST = new Set([
  'backgroundColor',
  'color',
  'fontWeight',
  'fontStyle',
  'textAlign',
  'textDecoration',
  'opacity',
]);

const FORMATTER_RESULT_WHITELIST = new Set([
  'style',
  'text',
  'html',
  'tooltip',
  'className',
]);

export type CrosstabCellFormatterResult = {
  text?: DataRecordValue;
  html?: string;
  tooltip?: string;
  className?: string;
  style?: Partial<CSSProperties>;
};

type CrosstabCellFormatterContext = {
  row: DataRecord;
  cell: {
    field: string;
    value: DataRecordValue;
    formattedValue?: DataRecordValue;
    rawValue: DataRecordValue;
  };
  value: DataRecordValue;
  rawValue: DataRecordValue;
  column: {
    key: string;
    label: string;
    metric?: string;
  };
  rowIndex: number | null | undefined;
  colDef: ColDef;
};

type CrosstabCellFormatterCallback = (
  context: CrosstabCellFormatterContext,
) => unknown;

export const CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT = `/*
 * 回调示例：
 * ({ row, cell, value, rawValue, column, rowIndex, colDef }) => {
 *   if (typeof rawValue === "number" && rawValue > 1000) {
 *     return {
 *       text: value,
 *       style: {
 *         backgroundColor: "#fff1b8",
 *         color: "#1f1f1f",
 *         fontWeight: "bold",
 *       },
 *       tooltip: column.label + " 超过 1000",
 *     };
 *   }
 *
 *   return undefined;
 * }
 */`;

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .trim();

const sanitizeStyle = (style: unknown): Partial<CSSProperties> | undefined => {
  if (!style || typeof style !== 'object' || Array.isArray(style)) {
    return undefined;
  }
  const rawStyle = style as Record<string, unknown>;
  const unsupportedStyleField = Object.keys(rawStyle).find(
    key => !STYLE_WHITELIST.has(key),
  );

  if (unsupportedStyleField) {
    throw new Error(
      `Crosstab cell formatter callback returned unsupported style field "${unsupportedStyleField}".`,
    );
  }

  return Object.fromEntries(
    Object.entries(rawStyle).filter(
      ([_key, value]) =>
        typeof value === 'string' || typeof value === 'number',
    ),
  ) as Partial<CSSProperties>;
};

const normalizeFormatterResult = (
  result: unknown,
): CrosstabCellFormatterResult | undefined => {
  if (result === undefined || result === null) {
    return undefined;
  }
  if (['string', 'number', 'boolean'].includes(typeof result)) {
    return { text: result as DataRecordValue };
  }
  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Crosstab cell formatter callback must return an object.');
  }

  const rawResult = result as Record<string, unknown>;
  const unsupportedResultField = Object.keys(rawResult).find(
    key => !FORMATTER_RESULT_WHITELIST.has(key),
  );

  if (unsupportedResultField) {
    throw new Error(
      `Crosstab cell formatter callback returned unsupported result field "${unsupportedResultField}".`,
    );
  }

  return {
    ...('text' in rawResult
      ? { text: rawResult.text as DataRecordValue }
      : undefined),
    ...(typeof rawResult.html === 'string' ? { html: rawResult.html } : {}),
    ...(typeof rawResult.className === 'string'
      ? { className: rawResult.className }
      : {}),
    ...(typeof rawResult.tooltip === 'string'
      ? { tooltip: rawResult.tooltip }
      : {}),
    ...(rawResult.style ? { style: sanitizeStyle(rawResult.style) } : {}),
  };
};

const compileCrosstabCellFormatterCallback = (
  source: string,
): CrosstabCellFormatterCallback => {
  if (!/=>|\bfunction\b/.test(source)) {
    throw new Error('Crosstab cell formatter callback must be a function.');
  }
  // eslint-disable-next-line no-new-func
  const callback = new Function(`"use strict"; return ${source};`)();

  if (typeof callback !== 'function') {
    throw new Error('Crosstab cell formatter callback must be a function.');
  }

  return callback as CrosstabCellFormatterCallback;
};

const createSampleFormatterContext = (): CrosstabCellFormatterContext => ({
  row: {
    metric_name_with_unit: '销售额（元）',
  },
  cell: {
    field: '__crosstab_col__sample__metric__amount',
    value: 100,
    formattedValue: '100',
    rawValue: 100,
  },
  value: '100',
  rawValue: 100,
  column: {
    key: '__crosstab_col__sample__metric__amount',
    label: '示例列',
    metric: 'amount',
  },
  rowIndex: 0,
  colDef: {
    field: '__crosstab_col__sample__metric__amount',
    headerName: '示例列',
  },
});

export const validateCrosstabCellFormatterCallback = (
  expression: string | null | undefined,
) => {
  const source = expression?.trim();

  if (!source || !stripComments(source)) {
    return false;
  }

  const callback = compileCrosstabCellFormatterCallback(source);
  normalizeFormatterResult(callback(createSampleFormatterContext()));
  return false;
};

export const validateCrosstabCellFormatterExpression =
  validateCrosstabCellFormatterCallback;

export const formatCrosstabCellFormatterCallback = async (
  expression: string | null | undefined,
): Promise<string> => {
  const source = expression?.trim();

  if (!source || !stripComments(source)) {
    return expression ?? '';
  }

  validateCrosstabCellFormatterCallback(source);
  const [prettier, babelPlugin, estreePlugin] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);

  return prettier.format(source, {
    parser: 'babel',
    plugins: [
      babelPlugin.default ?? babelPlugin,
      estreePlugin.default ?? estreePlugin,
    ],
  });
};

export const createCrosstabCellFormatter = (
  expression: string | null | undefined,
) => {
  const source = expression?.trim();

  if (!source || !stripComments(source)) {
    return undefined;
  }

  const callback = compileCrosstabCellFormatterCallback(source);

  return (
    params: CustomCellRendererProps,
    columnInfo: { key: string; label: string; metric?: string },
  ) => {
    const field = String(params.colDef?.field ?? columnInfo.key);
    const rawValue = params.value as DataRecordValue;
    const formattedValue = params.valueFormatted as DataRecordValue | undefined;
    const cell = {
      field,
      value: rawValue,
      formattedValue,
      rawValue,
    };

    return normalizeFormatterResult(
      callback({
        row: (params.data ?? {}) as DataRecord,
        cell,
        value: formattedValue ?? rawValue,
        rawValue,
        column: columnInfo,
        rowIndex: params.rowIndex,
        colDef: params.colDef,
      }),
    );
  };
};
```

- [ ] **Step 4: Run formatter tests to verify they pass**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/crosstab/cellFormatter.test.ts --runInBand
```

Expected: all tests pass.

- [ ] **Step 5: Commit formatter module**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/cellFormatter.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/cellFormatter.test.ts
git commit -m "feat(crosstab): add cell formatter module"
```

## Task 2: Add Form Data Type and Control Panel Entry

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`

- [ ] **Step 1: Add failing control-panel tests**

In `test/plugin/controlPanel.test.ts`, add `crosstabCellFormatterExpression` to the `arrayContaining` assertion in `exposes the crosstab field entry with totals, formatting, and display controls`.

Append these tests inside `describe('crosstab controlPanel', () => { ... })`:

```ts
it('exposes crosstab cell formatter as a JavaScript TextAreaControl', () => {
  expect(getControlConfig('crosstabCellFormatterExpression')).toEqual(
    expect.objectContaining({
      type: 'TextAreaControl',
      label: 'Crosstab 单元格 JS 回调函数',
      renderTrigger: true,
      resetOnHide: false,
      language: 'javascript',
    }),
  );
});

it('validates crosstab cell formatter callback source', () => {
  const config = getControlConfig('crosstabCellFormatterExpression') as {
    validators?: ((value: string) => false | string)[];
  };
  const [validator] = config.validators ?? [];

  expect(validator?.('({ value }) => ({ text: value })')).toBe(false);
  expect(validator?.('({ unsupported: true })')).toContain(
    'Crosstab cell formatter callback must be a function.',
  );
  expect(validator?.('() => ({ unsupported: true })')).toContain(
    'unsupported result field "unsupported"',
  );
});
```

- [ ] **Step 2: Run the control-panel tests to verify they fail**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: fail because the control is not present.

- [ ] **Step 3: Extend `CrosstabFormData`**

In `src/types.ts`, add this field to `CrosstabFormData` near `conditionalFormatting`:

```ts
crosstabCellFormatterExpression?: string;
```

- [ ] **Step 4: Add control-panel imports and helpers**

In `src/plugin/controlPanel.tsx`, add imports:

```ts
import {
  CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT,
  formatCrosstabCellFormatterCallback,
  validateCrosstabCellFormatterCallback,
} from '../crosstab/cellFormatter';
```

Add helper functions above `const config`:

```ts
const validateCrosstabCellFormatterCallbackControl = (value: string) => {
  try {
    validateCrosstabCellFormatterCallback(value);
    return false;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const formatCrosstabCellFormatterEditor = (editor: {
  getValue: () => string;
  setValue: (value: string, cursorPosition?: number) => void;
}) => {
  const source = editor.getValue();

  return formatCrosstabCellFormatterCallback(source)
    .then(formattedValue => {
      if (editor.getValue() === source && formattedValue !== source) {
        editor.setValue(formattedValue, -1);
      }
    })
    .catch(() => {});
};
```

- [ ] **Step 5: Add the `TextAreaControl` in the Crosstab section**

In the `Crosstab` section, insert this row immediately after `conditionalFormatting`:

```ts
[
  {
    name: 'crosstabCellFormatterExpression',
    config: {
      type: 'TextAreaControl',
      label: t('Crosstab 单元格 JS 回调函数'),
      default: CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT,
      renderTrigger: true,
      resetOnHide: false,
      language: 'javascript',
      validators: [validateCrosstabCellFormatterCallbackControl],
      formatValue: formatCrosstabCellFormatterCallback,
      description: t(
        'Use a JavaScript callback to format Crosstab matrix value cells. Return undefined/null to keep the default rendering, or return text/html/tooltip/className/style.',
      ),
      aboveEditorSection: (
        <div>
          <p>
            {t(
              'Callback signature: ({ row, cell, value, rawValue, column, rowIndex, colDef }) => { ... }',
            )}
          </p>
          <p>
            {t(
              'Allowed style fields: backgroundColor, color, fontWeight, fontStyle, textAlign, textDecoration, opacity.',
            )}
          </p>
        </div>
      ),
      hotkeys: [
        {
          name: 'formatCrosstabCellFormatterCallback',
          key: 'Ctrl-Shift-F',
          func: formatCrosstabCellFormatterEditor,
        },
        {
          name: 'formatCrosstabCellFormatterCallbackMac',
          key: 'Command-Shift-F',
          func: formatCrosstabCellFormatterEditor,
        },
      ],
    },
  },
],
```

- [ ] **Step 6: Run control-panel tests to verify they pass**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: all tests pass.

- [ ] **Step 7: Commit control-panel wiring**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts
git commit -m "feat(crosstab): expose cell formatter control"
```

## Task 3: Apply Formatter to Matrix Value Cells

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`

- [ ] **Step 1: Upgrade the AG Grid mock for formatter assertions**

In `test/CrosstabTable.test.tsx`, update the `MockAgGridReact` cell render block so it passes `valueFormatted`, `rowIndex`, `className`, and `title` through. Replace the `<td>` return inside `leaves.map(columnDef => { ... })` with:

```tsx
const cellClass =
  typeof columnDef.cellClass === 'function'
    ? columnDef.cellClass({
        value,
        data: row,
        node: undefined,
        column: undefined,
        colDef: columnDef,
        api: undefined,
        context: undefined,
      } as never)
    : columnDef.cellClass;
const rendered =
  typeof columnDef.cellRenderer === 'function'
    ? columnDef.cellRenderer({
        value,
        valueFormatted: formatted,
        data: row,
        rowIndex,
        node: undefined,
        colDef: columnDef,
        api: undefined,
        context: undefined,
      } as never)
    : undefined;
const title =
  typeof columnDef.tooltipValueGetter === 'function'
    ? columnDef.tooltipValueGetter({
        value,
        valueFormatted: formatted,
        data: row,
        node: undefined,
        column: undefined,
        colDef: columnDef,
        api: undefined,
        context: undefined,
      } as never)
    : undefined;

return (
  <td
    className={cellClass as string | undefined}
    key={columnDef.colId}
    style={style as never}
    title={title as string | undefined}
  >
    {rendered ?? formatted}
  </td>
);
```

- [ ] **Step 2: Add failing rendering tests**

Append these tests near the existing `renders row dimension values and formatted generated cells` and `renders conditional arrows and total row styling` tests:

```tsx
it('uses crosstab cell formatter text for generated matrix value cells', () => {
  const props = baseHierarchicalProps(1);

  renderChart({
    ...props,
    formData: {
      ...props.formData,
      crosstabCellFormatterExpression:
        '({ rawValue, column }) => ({ text: column.metric + ":" + rawValue })',
    },
  });

  expect(getByText('amount:12')).toBeInTheDocument();
  expect(getByText('A')).toBeInTheDocument();
});

it('renders sanitized crosstab cell formatter html', () => {
  const props = baseHierarchicalProps(1);

  renderChart({
    ...props,
    formData: {
      ...props.formData,
      crosstabCellFormatterExpression:
        '() => ({ html: "<strong>safe</strong><script>alert(1)</script>" })',
    },
  });

  const cell = getByText('safe').closest('td');

  expect(cell?.innerHTML).toContain('<strong>safe</strong>');
  expect(cell?.innerHTML).not.toContain('<script>');
});

it('applies crosstab cell formatter style tooltip and className', () => {
  const props = baseHierarchicalProps(1);

  renderChart({
    ...props,
    formData: {
      ...props.formData,
      crosstabCellFormatterExpression: `() => ({
        text: "styled",
        tooltip: "formatter tooltip",
        className: "formatter-class",
        style: { backgroundColor: "rgb(255, 241, 184)", color: "rgb(0, 0, 0)", fontWeight: 600 }
      })`,
    },
  });

  const cell = getByText('styled').closest('td');

  expect(cell).toHaveClass('formatter-class');
  expect(cell).toHaveAttribute('title', 'formatter tooltip');
  expect(cell).toHaveStyle({
    backgroundColor: 'rgb(255, 241, 184)',
    color: 'rgb(0, 0, 0)',
    fontWeight: '600',
  });
});

it('lets crosstab cell formatter style override conditional formatting colors', () => {
  const props = baseHierarchicalProps(1);

  renderChart({
    ...props,
    formData: {
      ...props.formData,
      conditionalFormatting: [
        {
          metric: 'amount',
          operator: '>=',
          value: 10,
          color: 'green',
          backgroundColor: 'white',
        },
      ],
      crosstabCellFormatterExpression:
        '() => ({ text: "override", style: { backgroundColor: "black", color: "white" } })',
    },
  });

  expect(getByText('override').closest('td')).toHaveStyle({
    backgroundColor: 'black',
    color: 'white',
  });
});

it('does not apply crosstab cell formatter to row dimension cells', () => {
  const props = baseHierarchicalProps(1);

  renderChart({
    ...props,
    formData: {
      ...props.formData,
      crosstabCellFormatterExpression: '() => ({ text: "formatted-value-cell" })',
    },
  });

  expect(getByText('A')).toBeInTheDocument();
  expect(container.querySelectorAll('td')).toHaveLength(4);
  expect(Array.from(container.querySelectorAll('td')).filter(td => td.textContent === 'formatted-value-cell')).toHaveLength(3);
});
```

- [ ] **Step 3: Run the rendering tests to verify they fail**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: fail because `CrosstabTable` does not create or apply the formatter yet.

- [ ] **Step 4: Import formatter helpers and sanitizer**

In `src/CrosstabTable.tsx`, update imports:

```ts
import {
  sanitizeHtml,
  t,
  useTheme,
  type DataRecord,
  type DataRecordValue,
} from '@superset-ui/core';
import {
  createCrosstabCellFormatter,
  type CrosstabCellFormatterResult,
} from './crosstab/cellFormatter';
```

- [ ] **Step 5: Add renderer helpers**

Add these helpers above `buildLeafColumnDef`:

```tsx
type CrosstabCellFormatter = ReturnType<typeof createCrosstabCellFormatter>;

function renderFormatterResult(
  formatterResult: CrosstabCellFormatterResult | undefined,
  defaultContent: DataRecordValue,
) {
  if (!formatterResult) {
    return defaultContent;
  }

  if (formatterResult.html !== undefined) {
    return (
      <span
        dangerouslySetInnerHTML={{
          __html: sanitizeHtml(formatterResult.html),
        }}
      />
    );
  }

  return formatterResult.text ?? defaultContent;
}
```

- [ ] **Step 6: Thread formatter through generated leaf columns**

Change `buildLeafColumnDef` signature:

```ts
function buildLeafColumnDef(
  columnId: string,
  headerName: string,
  rules: CrosstabConditionalRule[],
  totalBackgroundColor: string,
  columnWidth: number,
  numberFormat?: string,
  metric?: string,
  cellFormatter?: CrosstabCellFormatter,
): ColDef {
```

Inside the returned column definition, replace `cellRenderer`, `cellStyle`, and `cellClass` with:

```ts
cellRenderer: (params: CustomCellRendererProps) => {
  const defaultContent = renderFormattedCell(params, rules, numberFormat);
  const formatterResult = cellFormatter?.(params, {
    key: columnId,
    label: headerName,
    metric,
  });

  return renderFormatterResult(formatterResult, defaultContent);
},
cellStyle: params => {
  const { value, data } = params;
  const style = resolveConditionalStyle(value as DataRecordValue, rules);
  const isTotalRow =
    data?.[CROSSTAB_ROW_TYPE] === 'subtotal' ||
    data?.[CROSSTAB_ROW_TYPE] === 'grand_total';
  const formatterResult = cellFormatter?.(params as CustomCellRendererProps, {
    key: columnId,
    label: headerName,
    metric,
  });

  return {
    color: style.color ?? '',
    backgroundColor:
      style.backgroundColor ?? (isTotalRow ? totalBackgroundColor : ''),
    ...(isTotalRow ? { fontWeight: 600 } : {}),
    ...(formatterResult?.style ?? {}),
  };
},
cellClass: params => {
  const baseClassName = cellClassName(params.data as DataRecord | undefined);
  const formatterResult = cellFormatter?.(
    params as CustomCellRendererProps,
    {
      key: columnId,
      label: headerName,
      metric,
    },
  );

  return [baseClassName, formatterResult?.className]
    .filter(Boolean)
    .join(' ');
},
tooltipValueGetter: params => {
  const formatterResult = cellFormatter?.(
    params as CustomCellRendererProps,
    {
      key: columnId,
      label: headerName,
      metric,
    },
  );

  return formatterResult?.tooltip;
},
```

Update `buildColumnDefsFromTree` to accept and pass `cellFormatter`, and pass `node.metric` into `buildLeafColumnDef`:

```ts
function buildColumnDefsFromTree(
  nodes: CrosstabColumnNode[],
  rulesByMetric: (metric?: string) => CrosstabConditionalRule[],
  totalBackgroundColor: string,
  columnWidth: number,
  numberFormat?: string,
  cellFormatter?: CrosstabCellFormatter,
): ColDef[] {
  return nodes.map(node => {
    if (node.field) {
      return buildLeafColumnDef(
        node.field,
        node.label,
        rulesByMetric(node.metric),
        totalBackgroundColor,
        columnWidth,
        numberFormat,
        node.metric,
        cellFormatter,
      );
    }
```

Also pass `cellFormatter` in the recursive `children` call.

- [ ] **Step 7: Create formatter in `CrosstabTable`**

After `conditionalFormatting`, add:

```ts
const cellFormatter = useMemo(
  () =>
    createCrosstabCellFormatter(formData.crosstabCellFormatterExpression),
  [formData.crosstabCellFormatterExpression],
);
```

Pass `cellFormatter` to `buildColumnDefsFromTree` and the total-column `buildLeafColumnDef`. Add it to the `columnDefs` dependency list.

- [ ] **Step 8: Run rendering tests to verify they pass**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: all tests pass.

- [ ] **Step 9: Commit rendering integration**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx
git commit -m "feat(crosstab): render formatted matrix cells"
```

## Task 4: Tighten Runtime Contract and Avoid Query Regressions

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
- Modify only if tests expose a gap: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Modify only if tests expose a gap: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`

- [ ] **Step 1: Add query non-regression test**

In `test/plugin/buildQuery.test.ts`, add a test that uses existing local helpers for a minimal Crosstab query and asserts the new field is not sent to query extras:

```ts
it('does not send crosstab cell formatter expression to chart data query payloads', () => {
  const queries = buildQuery({
    datasource: '1__table',
    viz_type: 'crosstab_table',
    groupbyRows: ['contract_type'],
    groupbyColumns: ['payment_method'],
    metrics: ['amount'],
    row_limit: 100,
    crosstabCellFormatterExpression: '({ value }) => ({ text: value })',
  } as never);

  expect(JSON.stringify(queries)).not.toContain('crosstabCellFormatterExpression');
  expect(JSON.stringify(queries)).not.toContain('({ value }) => ({ text: value })');
});
```

If this file uses a different helper shape, keep the assertion body exactly the same and adapt only the existing `buildQuery` invocation style.

- [ ] **Step 2: Add transform-props pass-through test**

In `test/plugin/transformProps.test.ts`, add a test that uses the existing transform fixture style and asserts `formData.crosstabCellFormatterExpression` reaches `CrosstabTable` props unchanged:

```ts
it('preserves crosstab cell formatter expression in chart props formData', () => {
  const chartProps = transformProps({
    width: 800,
    height: 400,
    formData: {
      datasource: '1__table',
      viz_type: 'crosstab_table',
      groupbyRows: ['contract_type'],
      groupbyColumns: ['payment_method'],
      metrics: ['amount'],
      crosstabCellFormatterExpression: '({ value }) => ({ text: value })',
    },
    queriesData: [
      {
        data: [
          {
            contract_type: 'A',
            payment_method: 'Cash',
            amount: 12,
          },
        ],
      },
    ],
  } as never);

  expect(chartProps.formData.crosstabCellFormatterExpression).toBe(
    '({ value }) => ({ text: value })',
  );
});
```

If the existing transform fixture requires more fields, copy the smallest passing fixture from the nearest existing test and add only `crosstabCellFormatterExpression`.

- [ ] **Step 3: Run query and transform tests**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  --runInBand
```

Expected: pass. If either test fails because the new form-data field leaks into query payloads, remove it in the same normalization path that currently strips display-only Crosstab controls.

- [ ] **Step 4: Commit non-regression tests**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts
git commit -m "test(crosstab): protect cell formatter query contract"
```

## Task 5: Run Focused Validation

**Files:**
- Verify only; no edits expected.

- [ ] **Step 1: Run focused Jest suite**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/crosstab/cellFormatter.test.ts \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  --runInBand
```

Expected: all selected tests pass.

- [ ] **Step 2: Run ESLint on changed files**

Run:

```bash
cd superset-frontend
npx eslint \
  plugins/plugin-chart-crosstab-table/src/crosstab/cellFormatter.ts \
  plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx \
  plugins/plugin-chart-crosstab-table/src/types.ts \
  plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx \
  plugins/plugin-chart-crosstab-table/test/crosstab/cellFormatter.test.ts \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
```

Expected: no lint errors.

- [ ] **Step 3: Run TypeScript validation**

Run:

```bash
cd superset-frontend
npm run type
```

Expected: pass. If repo-baseline type errors appear outside the changed files, capture the first changed-file-relevant error and report baseline errors separately.

- [ ] **Step 4: Commit validation fixes only if needed**

If validation required code changes:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table
git commit -m "fix(crosstab): satisfy formatter validation"
```

If no validation changes were needed, do not create an empty commit.

## Task 6: Optional Browser Acceptance After Deployment

**Files:**
- Create if deployed: `docs/superpowers/reports/2026-05-25-crosstab-cell-formatter-acceptance.md`
- Create if deployed: `docs/superpowers/reports/2026-05-25-crosstab-cell-formatter-dashboard.png`

- [ ] **Step 1: Verify local Superset health only if a runtime is expected**

Run:

```bash
curl -f http://localhost:8088/health
```

Expected: HTTP 200. If it fails, stop browser acceptance and report:

```text
It appears you aren't set up properly. Please refer to the Working with LLMs section in the development docs for setup instructions.
```

- [ ] **Step 2: Exercise slice 10 only after deployment**

Open the production or local dashboard path used by the existing Crosstab reports, configure `crosstabCellFormatterExpression` with:

```js
({ rawValue, value }) => {
  if (typeof rawValue === "number" && rawValue > 0) {
    return {
      text: value,
      style: {
        backgroundColor: "#fff1b8",
        color: "#1f1f1f",
        fontWeight: "bold",
      },
      tooltip: "formatter active",
    };
  }

  return undefined;
}
```

Verify visually:
- generated value cells use the custom background where the condition matches
- row dimension cells are unchanged
- conditional arrows/number formatting still display when callback returns `undefined`
- dynamic dimensions, dynamic metrics, column sorting, totals, and pagination still render

- [ ] **Step 3: Save acceptance evidence if browser acceptance was run**

Create `docs/superpowers/reports/2026-05-25-crosstab-cell-formatter-acceptance.md`:

```md
# Crosstab Cell Formatter Acceptance

Date: 2026-05-25

## Scope

- Feature: Crosstab matrix value-cell JavaScript formatter
- Chart: slice 10
- Runtime: local or production Superset URL used during verification

## Result

- Formatter text/style/tooltip applied to generated matrix value cells: PASS
- Row dimension cells unchanged: PASS
- Conditional formatting and number formatting preserved when callback returns undefined: PASS
- Dynamic dimensions, dynamic metrics, sorting, totals, and pagination visually present: PASS

## Evidence

- Screenshot: `docs/superpowers/reports/2026-05-25-crosstab-cell-formatter-dashboard.png`
```

- [ ] **Step 4: Commit acceptance report if created**

```bash
git add docs/superpowers/reports/2026-05-25-crosstab-cell-formatter-acceptance.md \
  docs/superpowers/reports/2026-05-25-crosstab-cell-formatter-dashboard.png
git commit -m "docs(crosstab): record cell formatter acceptance"
```

## Self-Review Checklist

- [ ] Spec coverage: formatter control, default commented example, validator, Prettier formatting, local formatter module, callback context, result whitelist, style whitelist, sanitized HTML, style merge order, row-dimension exclusion, and query/export non-goals are each covered by a task.
- [ ] Placeholder scan: every task includes exact files, concrete code, exact commands, and expected outcomes.
- [ ] Type consistency: `crosstabCellFormatterExpression`, `CrosstabCellFormatterResult`, `createCrosstabCellFormatter`, `validateCrosstabCellFormatterCallback`, `validateCrosstabCellFormatterExpression`, and `formatCrosstabCellFormatterCallback` use the same names across tests and implementation.
- [ ] Fast-fail behavior: validation and runtime compilation throw errors for invalid callback source or unsupported result/style fields.
- [ ] Scope discipline: no backend, query construction, dynamic group-by, dynamic metrics, sorting, totals, or export behavior changes are planned except non-regression tests.
