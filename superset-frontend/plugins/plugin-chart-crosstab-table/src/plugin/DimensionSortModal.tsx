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
import { useEffect, useState } from 'react';
import { getColumnLabel, styled, t } from '@superset-ui/core';
import type { ColumnMeta } from '@superset-ui/chart-controls';
import { Modal, Select } from '@superset-ui/core/components';
import type {
  CrosstabNullSort,
  CrosstabSortDirection,
  CrosstabSortType,
  DimensionSortConfig,
} from '../types';

const FormGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const SORT_DIRECTIONS: CrosstabSortDirection[] = ['asc', 'desc'];
const SORT_TYPES: CrosstabSortType[] = ['string', 'number', 'date'];
const NULL_SORTS: CrosstabNullSort[] = ['last', 'first'];

type DimensionSortModalProps = {
  fieldLabel: string;
  onHide: () => void;
  onSave: (sort: DimensionSortConfig) => void;
  show: boolean;
  sort?: DimensionSortConfig;
  sortFieldOptions: string[];
};

function normalizeSort(sort?: DimensionSortConfig): DimensionSortConfig {
  return {
    by: sort?.by ?? 'self',
    direction: sort?.direction ?? 'asc',
    type: sort?.type ?? 'string',
    nulls: sort?.nulls ?? 'last',
  };
}

export function getColumnMetaLabel(column: ColumnMeta) {
  return (
    column.verbose_name ||
    column.column_name ||
    column.name ||
    column.type ||
    ''
  );
}

export function getSortByValue(sort?: DimensionSortConfig) {
  return sort?.by === undefined || sort.by === 'self'
    ? 'self'
    : getColumnLabel(sort.by);
}

export function getDimensionSortSummary(sort?: DimensionSortConfig) {
  const normalizedSort = normalizeSort(sort);

  return `${getSortByValue(normalizedSort)} · ${normalizedSort.direction} · ${
    normalizedSort.type ?? 'string'
  } · nulls ${normalizedSort.nulls ?? 'last'}`;
}

export default function DimensionSortModal({
  fieldLabel,
  onHide,
  onSave,
  show,
  sort,
  sortFieldOptions,
}: DimensionSortModalProps) {
  const [draft, setDraft] = useState<DimensionSortConfig>(() =>
    normalizeSort(sort),
  );

  useEffect(() => {
    if (show) {
      setDraft(normalizeSort(sort));
    }
  }, [show, sort]);

  return (
    <Modal
      centered
      name="crosstab-dimension-sort-modal"
      onHandledPrimaryAction={() => onSave(draft)}
      onHide={onHide}
      primaryButtonName={t('Save')}
      show={show}
      title={t('Sort settings: %s', fieldLabel)}
      width={520}
    >
      <FormGrid>
        <Field>
          {t('Sort by')}
          <Select
            ariaLabel={t('Sort by')}
            options={[
              { label: t('Self'), value: 'self' },
              ...sortFieldOptions.map(option => ({
                label: option,
                value: option,
              })),
            ]}
            value={getSortByValue(draft)}
            onChange={nextSortBy =>
              setDraft(currentDraft => ({
                ...currentDraft,
                by: nextSortBy === 'self' ? 'self' : String(nextSortBy),
              }))
            }
          />
        </Field>
        <Field>
          {t('Direction')}
          <Select
            ariaLabel={t('Sort direction')}
            options={SORT_DIRECTIONS.map(direction => ({
              label: direction,
              value: direction,
            }))}
            value={draft.direction}
            onChange={nextDirection =>
              setDraft(currentDraft => ({
                ...currentDraft,
                direction: nextDirection as CrosstabSortDirection,
              }))
            }
          />
        </Field>
        <Field>
          {t('Type')}
          <Select
            ariaLabel={t('Sort type')}
            options={SORT_TYPES.map(sortType => ({
              label: sortType,
              value: sortType,
            }))}
            value={draft.type ?? 'string'}
            onChange={nextSortType =>
              setDraft(currentDraft => ({
                ...currentDraft,
                type: nextSortType as CrosstabSortType,
              }))
            }
          />
        </Field>
        <Field>
          {t('Nulls')}
          <Select
            ariaLabel={t('Null sort')}
            options={NULL_SORTS.map(nullSort => ({
              label: nullSort,
              value: nullSort,
            }))}
            value={draft.nulls ?? 'last'}
            onChange={nextNullSort =>
              setDraft(currentDraft => ({
                ...currentDraft,
                nulls: nextNullSort as CrosstabNullSort,
              }))
            }
          />
        </Field>
      </FormGrid>
    </Modal>
  );
}
