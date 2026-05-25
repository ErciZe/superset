# Crosstab Dynamic Cell Formatter Design

## Summary

Add a Crosstab-local dynamic cell formatter that mirrors the matrix cell callback
semantics from `noway table v1`. The feature applies only to Crosstab matrix
value cells. It does not affect row dimension cells, query construction,
dynamic group-by, dynamic metrics, sort behavior, or export behavior.

## Goals

- Let Crosstab value cells be dynamically rendered with JavaScript callback
  logic similar to `noway table v1`.
- Support callback results for `text`, `html`, `tooltip`, `className`, and a
  small style whitelist.
- Keep the implementation inside `plugin-chart-crosstab-table` so Crosstab does
  not depend on another business plugin's internal files.
- Preserve the current Crosstab conditional formatting, number formatting,
  totals, dynamic dimensions, and date sorting behavior.

## Non-Goals

- Do not apply the formatter to row header or row dimension cells.
- Do not change backend queries, form data submitted to `/chart/data`, or the
  Crosstab engine output shape.
- Do not add hidden raw-value fields in this change.
- Do not silently ignore invalid callback code. Invalid configuration should
  fail fast during validation or chart rendering.

## Reference Behavior

`noway table v1` exposes `matrix_cell_formatter_expression`, which compiles a
JavaScript function and calls it with:

```ts
({ row, cell, value, rawValue, column, rowIndex, colDef }) => result;
```

The Crosstab feature keeps the same conceptual contract but adapts the context
to Crosstab's generated value columns.

## Form Data

Add a new optional form data field:

```ts
crosstabCellFormatterExpression?: string;
```

An empty value, blank value, or comment-only value disables the formatter.

The field should be exposed in the Crosstab customization controls as a
JavaScript `TextAreaControl` with:

- label: `Crosstab 单元格 JS 回调函数`
- `renderTrigger: true`
- `resetOnHide: false`
- validator that compiles and runs a sample callback
- formatter that runs Prettier over valid callback code

The default value should be a commented example only, so existing charts do not
change behavior until a user writes executable callback code.

## Formatter Module

Create a Crosstab-local module, for example:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/cellFormatter.ts
```

The module owns:

- `CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT`
- `validateCrosstabCellFormatterCallback`
- `validateCrosstabCellFormatterExpression`
- `formatCrosstabCellFormatterCallback`
- `createCrosstabCellFormatter`

The implementation should follow the `noway table v1` formatter behavior but
remain independent.

Allowed result fields:

```ts
text?: DataRecordValue;
html?: string;
tooltip?: string;
className?: string;
style?: Partial<CSSProperties>;
```

Allowed style fields:

- `backgroundColor`
- `color`
- `fontWeight`
- `fontStyle`
- `textAlign`
- `textDecoration`
- `opacity`

Unsupported result fields or style fields throw an error.

## Runtime Context

For each generated Crosstab matrix value cell, construct this callback context:

```ts
{
  row: params.data ?? {},
  cell: {
    field: columnId,
    value: params.value,
    formattedValue: params.valueFormatted,
    rawValue: params.value,
  },
  value: params.valueFormatted ?? params.value,
  rawValue: params.value,
  column: {
    key: columnId,
    label: headerName,
    metric: node.metric,
  },
  rowIndex: params.rowIndex,
  colDef: params.colDef,
}
```

Crosstab does not currently maintain a separate hidden raw-value field, so
`rawValue` is explicitly the AG Grid raw cell value. A future raw-value field can
extend this context without changing the callback signature.

## Rendering Rules

The formatter applies only in `buildLeafColumnDef` for matrix value columns.
`buildRowColumnDefs` remains unchanged.

Rendering order:

1. Crosstab computes the default formatted value with `formatCrosstabValue`.
2. Existing `conditionalFormatting` computes base color, background, and arrow.
3. Total and subtotal row styles provide base background and font weight.
4. The dynamic formatter runs.
5. Formatter `style` is merged last and can override conditional-formatting
   colors.
6. Formatter `text` or `html` overrides displayed content.
7. Formatter `tooltip` and `className` are applied to the rendered cell.

HTML output must be sanitized before insertion with `dangerouslySetInnerHTML`.
If the formatter returns `undefined` or `null`, existing rendering remains
unchanged.

## Error Handling

Validation catches invalid source, non-function values, unsupported result
fields, and unsupported style fields using a sample callback context.

At runtime, formatter errors should propagate to chart rendering errors. Do not
add broad fallback behavior that hides invalid callback code.

## Testing

Add focused tests for the formatter module:

- empty, blank, and comment-only expressions disable formatting
- function and arrow-function callbacks compile
- primitive return values normalize to `{ text }`
- object returns support `text`, `html`, `tooltip`, `className`, and whitelisted
  `style`
- unsupported result fields throw
- unsupported style fields throw
- non-function source throws

Add Crosstab rendering tests:

- formatter overrides a matrix value cell's displayed text
- formatter `html` is rendered through sanitized HTML
- formatter `style`, `tooltip`, and `className` are applied
- formatter style can override existing conditional formatting
- row dimension cells are not formatted by this callback

Add control panel tests:

- the new TextAreaControl exists in the customization controls
- valid callback source passes validation
- unsupported return fields fail validation

Run at least:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/crosstab/cellFormatter.test.ts \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  --runInBand
npx eslint \
  plugins/plugin-chart-crosstab-table/src/crosstab/cellFormatter.ts \
  plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx \
  plugins/plugin-chart-crosstab-table/test/crosstab/cellFormatter.test.ts \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts
npm run type
```

If the change is deployed, also run the existing production build and browser
acceptance flow for slice 10.

## Acceptance Criteria

- Crosstab exposes a JavaScript callback configuration for matrix value cells.
- The callback can dynamically render text, sanitized HTML, tooltip, className,
  and whitelisted styles.
- Existing Crosstab value formatting still works when the callback is disabled.
- Conditional formatting remains available, and callback style can intentionally
  override it.
- Row headers and dimension labels are not affected.
- Dynamic dimensions, dynamic metrics, sorting, totals, and Superset native
  export behavior do not regress.
