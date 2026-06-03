# Easy Date Range Picker Design

## Summary

Add an optional, dashboard-only easy date range picker for Superset native time filters. The new picker provides a two-month range panel with shortcuts, while preserving the existing Superset date filter components and time range contract.

The feature is enabled per native time filter through `controlValues.enableEasyDateRange`. Existing dashboards, new filters, and Explore keep the existing experience unless the switch is explicitly enabled for a time filter.

## Goals

- Improve dashboard time filter usability with a clearer date range selection panel.
- Keep the original `Custom`, `Advanced`, and AntD date picker paths available.
- Avoid backend changes, migrations, dashboard-id exceptions, and changes to Superset's `time_range` query semantics.
- Minimize upstream merge friction by keeping changes localized and opt-in.
- Add necessary Chinese translations for new user-facing labels.

## Non-Goals

- Do not introduce Element Plus or any Vue dependency.
- Do not replace the existing date picker globally.
- Do not enable the new picker in Explore.
- Do not change `/api/v1/time_range/` parsing or chart query behavior.
- Do not add relative expression editing to the new picker; existing `Custom` and `Advanced` frames keep that responsibility.

## User Experience

When a dashboard native time filter has `Use easy date range picker` enabled, its date filter popover includes an additional range type named `Date range`.

The `Date range` frame contains:

- A left shortcut column.
- Two calendar months displayed side by side.
- Range highlighting for selected and hover-preview dates.
- Start and end date inputs for visibility.
- Existing outer `Actual time range`, `Cancel`, and `Apply` controls from `DateFilterLabel`.

The selected end date is inclusive from the user's perspective. Internally, the value is encoded as Superset's exclusive end datetime.

Example:

```text
User selects: 2026-06-01 through 2026-06-03
Stored value: 2026-06-01T00:00:00 : 2026-06-04T00:00:00
```

## Shortcuts

The easy picker supports fixed datetime ranges for:

- Today
- Yesterday
- Last 7 days
- Last 30 days
- Current week
- Current month
- Current quarter
- Current year
- Previous week
- Previous month
- Previous quarter
- Previous year

Shortcuts output explicit datetime ranges instead of relative strings such as `Last 7 days`. This makes the selected value stable and keeps the easy picker focused on concrete dashboard filtering.

## Architecture

Use a low-intrusion wiring model:

1. Add independent date range components under `DateFilterControl/components`.
2. Add an optional `enableEasyDateRange?: boolean` prop to `DateFilterControl`.
3. Generate range type options inside `DateFilterLabel` based on that prop, instead of permanently changing the shared `FRAME_OPTIONS` list.
4. Read `formData.controlValues.enableEasyDateRange` in `TimeFilterPlugin`.
5. Pass the boolean to `DateFilterControl`.

Explore does not pass `enableEasyDateRange`, so it keeps the existing range types and behavior.

## Component Boundaries

Planned components:

- `DateRangeFrame`
  - Adapts the date range panel to Superset's `FrameComponentProps`.
  - Parses the current `time_range` if it is a concrete `since : until` value.
  - Emits Superset-compatible `time_range` strings.
- `DateRangeCalendarPanel`
  - Pure UI and date selection state.
  - Handles month navigation, range selection, shortcut selection, and invalid range state.
  - Depends on Dayjs, Superset theme tokens, and Superset component wrappers.

Existing components remain:

- `CustomFrame`
- `AdvancedFrame`
- `CommonFrame`
- `CalendarFrame`
- `CurrentCalendarFrame`

## Native Filter Configuration

Add a switch only for native filters with `filterType === 'filter_time'`.

Configuration:

```text
Label: Use easy date range picker
Storage: controlValues.enableEasyDateRange
Default: false
```

Existing dashboards do not change because a missing value is treated as `false`. New time filters also default to `false`; users must explicitly enable the new picker.

The existing save transformer already preserves `controlValues`, so no backend schema or migration change is required.

## Data Flow

```text
FiltersConfigModal
  -> controlValues.enableEasyDateRange
  -> dashboard metadata native_filter_configuration
  -> TimeFilterPlugin formData.controlValues.enableEasyDateRange
  -> DateFilterControl enableEasyDateRange
  -> DateFilterLabel adds Date range option
  -> DateRangeFrame emits time_range
  -> TimeFilterPlugin setDataMask({ extraFormData: { time_range } })
```

## Date Encoding

The easy picker uses concrete UTC-style datetime strings already accepted by Superset:

```text
YYYY-MM-DDT00:00:00 : YYYY-MM-DDT00:00:00
```

Selection rules:

- Start date is encoded as `startOf('day')`.
- End date is encoded as `selectedEndDate.add(1, 'day').startOf('day')`.
- If current value is not a concrete parseable range, the frame initializes to Today.
- If end date is before start date, Apply is disabled through the frame's invalid state and existing outer validation.

The outer `DateFilterLabel` continues to call `fetchTimeRange()` and display `Actual time range`.

## Error Handling

- Invalid range selection is prevented in the panel UI.
- Invalid or non-concrete incoming values initialize to Today when entering `Date range`.
- The component does not silently translate advanced expressions. Users can keep using `Custom` or `Advanced` for those cases.
- Existing `DateFilterLabel` validation remains the source of truth before Apply.

## Translation

Add Chinese translations for new labels and shortcuts in `superset/translations/zh/LC_MESSAGES/messages.po`.

Expected labels include:

- `Date range`
- `Use easy date range picker`
- `Easy date range picker`
- `Start date`
- `End date`
- `Selected range`
- `Today`
- `Yesterday`
- `Last 7 days`
- `Last 30 days`
- `Current week`
- `Current month`
- `Current quarter`
- `Current year`
- `Previous week`
- `Previous month`
- `Previous quarter`
- `Previous year`

Only necessary new msgids should be added to reduce merge conflicts in `messages.po`.

## Testing

Add focused frontend tests:

- `DateRangeCalendarPanel.test.tsx`
  - Renders two months and shortcuts.
  - Emits exclusive end values for inclusive UI selections.
  - Emits explicit datetime ranges for shortcuts.
  - Prevents invalid end-before-start ranges.
- `DateFilterLabel.test.tsx`
  - Does not show `Date range` when `enableEasyDateRange` is false or omitted.
  - Shows `Date range` when `enableEasyDateRange` is true.
- Native filter config modal tests
  - Shows `Use easy date range picker` only for time filters.
  - Saves the switch into `controlValues.enableEasyDateRange`.
  - Keeps non-time filters unchanged.
- `TimeFilterPlugin` tests
  - Passes the control value into `DateFilterControl`.

Validation commands:

```bash
cd superset-frontend
npm run test -- src/explore/components/controls/DateFilterControl
npm run test -- src/filters/components/Time
npm run test -- src/dashboard/components/nativeFilters/FiltersConfigModal
```

Translation validation:

```bash
msgfmt -c superset/translations/zh/LC_MESSAGES/messages.po
```

Before pushing implementation commits, run:

```bash
pre-commit run --all-files
```

## Merge-Friction Controls

- Keep changes frontend-only.
- Keep all behavior opt-in through a per-filter `controlValues` flag.
- Avoid changing shared `FRAME_OPTIONS` globally.
- Avoid touching backend models, migrations, and API schemas.
- Avoid direct AntD imports in new product code; use Superset component wrappers where available.
- Keep `messages.po` changes minimal and verify with `msgfmt -c`.
