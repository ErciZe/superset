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
import type { DataRecord, DataRecordValue } from '@superset-ui/core';
import {
  HIERARCHY_META_KEY,
  type HierarchyRecord,
  type HierarchyView,
} from './types';

export { HIERARCHY_META_KEY };

export const encodeHierarchyPath = (values: DataRecordValue[]): string =>
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
    return { records, metadataKey: HIERARCHY_META_KEY };
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
      visible.push({
        ...record,
        [HIERARCHY_META_KEY]: metadata,
      } as HierarchyRecord);
    }
    previousValues = values;
  });

  return { records: visible, metadataKey: HIERARCHY_META_KEY };
}
