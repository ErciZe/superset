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
import { DataRecordValue } from '@superset-ui/core';
import { Icons, Tooltip } from '@superset-ui/core/components';
import { HierarchyCellMeta } from '../types';

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
  if (!meta?.firstInGroup) {
    return null;
  }

  const text = String(valueFormatted ?? value ?? '-');
  const action = meta.expanded ? t('Collapse %s', text) : t('Expand %s', text);

  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: meta.depth * 16,
      }}
    >
      <span style={{ display: 'inline-flex', width: 24 }}>
        {meta.hasDescendants && (
          <Tooltip title={action}>
            <button
              type="button"
              aria-label={action}
              onClick={event => {
                event.stopPropagation();
                onToggle(meta.path);
              }}
              style={{
                border: 0,
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
              }}
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
      <Tooltip title={text}>
        <span>{text}</span>
      </Tooltip>
    </span>
  );
}
