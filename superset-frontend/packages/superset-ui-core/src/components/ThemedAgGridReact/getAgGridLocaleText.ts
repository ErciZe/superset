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
import { t } from '@apache-superset/core/translation';
import type { LocaleText } from 'ag-grid-community';

export default function getAgGridLocaleText(): LocaleText {
  return {
    next: t('Next'),
    previous: t('Previous'),
    page: t('Page'),
    more: t('More'),
    to: t('to'),
    of: t('of'),
    first: t('First'),
    last: t('Last'),
    loadingOoo: t('Loading...'),
    selectAll: t('Select All'),
    searchOoo: t('Search...'),
    blanks: t('Blanks'),
    filterOoo: t('Filter'),
    applyFilter: t('Apply Filter'),
    clearFilter: t('Clear Filter'),
    resetFilter: t('Reset Filter'),
    cancelFilter: t('Cancel Filter'),
    textFilter: t('Text Filter'),
    numberFilter: t('Number Filter'),
    dateFilter: t('Date Filter'),
    setFilter: t('Set Filter'),
    empty: t('Choose one'),
    equals: t('Equals'),
    notEqual: t('Not Equal'),
    lessThan: t('Less Than'),
    greaterThan: t('Greater Than'),
    lessThanOrEqual: t('Less Than or Equal'),
    greaterThanOrEqual: t('Greater Than or Equal'),
    inRange: t('In Range'),
    inRangeStart: t('From'),
    inRangeEnd: t('To'),
    contains: t('Contains'),
    notContains: t('Not Contains'),
    startsWith: t('Starts With'),
    endsWith: t('Ends With'),
    blank: t('Blank'),
    notBlank: t('Not blank'),
    before: t('Before'),
    after: t('After'),
    ariaFilterInput: t('Filter Input'),
    ariaFilterValue: t('Filter Value'),
    ariaFilterFromValue: t('Filter from value'),
    ariaFilterToValue: t('Filter to Value'),
    ariaFilteringOperator: t('Filtering operator'),
    andCondition: t('AND'),
    orCondition: t('OR'),
    group: t('Group'),
    columns: t('Columns'),
    filters: t('Filters'),
    valueColumns: t('Value Columns'),
    pivotMode: t('Pivot Mode'),
    groups: t('Groups'),
    values: t('Values'),
    pivots: t('Pivots'),
    toolPanelButton: t('Tool Panel'),
    pinColumn: t('Pin Column'),
    valueAggregation: t('Value Aggregation'),
    autosizeThiscolumn: t('Autosize This Column'),
    autosizeAllColumns: t('Autosize All Columns'),
    groupBy: t('Group By'),
    ungroupBy: t('Ungroup By'),
    resetColumns: t('Reset Columns'),
    expandAll: t('Expand All'),
    collapseAll: t('Collapse All'),
    toolPanel: t('Tool Panel'),
    export: t('Export'),
    csvExport: t('CSV Export'),
    excelExport: t('Excel Export'),
    excelXmlExport: t('Excel XML Export'),
    sum: t('Sum'),
    min: t('Min'),
    max: t('Max'),
    none: t('None'),
    count: t('Count'),
    average: t('Average'),
    copy: t('Copy'),
    copyWithHeaders: t('Copy with Headers'),
    paste: t('Paste'),
    sortAscending: t('Sort Ascending'),
    sortDescending: t('Sort Descending'),
    sortUnSort: t('Clear Sort'),
  };
}
