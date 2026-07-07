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
import {
  applyDynamicSlotSplices,
  ERR_DYNAMIC_SLOT_DUPLICATE_OPTION,
  ERR_DYNAMIC_SLOT_DUPLICATE_SLOT,
  ERR_DYNAMIC_SLOT_INVALID_OPTION,
  ERR_DYNAMIC_SLOT_OVERLAP,
  ERR_DYNAMIC_SLOT_SPLICE_COUNT,
  getDynamicSlotSpliceCount,
  resolveDynamicSlotOptions,
  validateDynamicSlots,
  type DynamicSlot,
} from '../../src/plugin/dynamicSlots';

type Placement = 'rows' | 'columns';
type TestSlot = DynamicSlot<readonly string[]> & {
  placement: Placement;
};

const baseSlots: TestSlot[] = [
  {
    id: 'level2',
    placement: 'columns',
    slotIndex: 1,
    spliceCount: 1,
    defaultOptionId: 'shop',
    options: [
      { id: 'shop', payload: ['shop_name'] },
      { id: 'country', payload: ['country'] },
    ],
  },
  {
    id: 'level3',
    placement: 'columns',
    slotIndex: 2,
    spliceCount: 1,
    defaultOptionId: 'none',
    options: [
      { id: 'none', payload: [] },
      { id: 'msku', payload: ['msku'] },
    ],
  },
];

describe('dynamic slot mechanics', () => {
  test('resolves selected options from ownState selections and defaults', () => {
    const selectedOptions = resolveDynamicSlotOptions(baseSlots, {
      level2: 'country',
    });

    expect(
      selectedOptions.map(({ option, slot }) => [slot.id, option.id]),
    ).toEqual([
      ['level2', 'country'],
      ['level3', 'none'],
    ]);
    expect(selectedOptions[0].slot.placement).toBe('columns');
  });

  test('throws for duplicate slot ids', () => {
    expect(() =>
      validateDynamicSlots(
        [
          baseSlots[0],
          {
            ...baseSlots[1],
            id: baseSlots[0].id,
          },
        ],
        { allowEmptyPayload: true, getPlacement: slot => slot.placement },
      ),
    ).toThrow(ERR_DYNAMIC_SLOT_DUPLICATE_SLOT);
  });

  test('throws for duplicate option ids inside one slot', () => {
    expect(() =>
      validateDynamicSlots(
        [
          {
            ...baseSlots[0],
            options: [
              { id: 'dimension', payload: ['shop_name'] },
              { id: 'dimension', payload: ['country'] },
            ],
          },
        ],
        { allowEmptyPayload: true, getPlacement: slot => slot.placement },
      ),
    ).toThrow(ERR_DYNAMIC_SLOT_DUPLICATE_OPTION);
  });

  test('throws for overlapping slot ranges within the same placement', () => {
    expect(() =>
      validateDynamicSlots(
        [
          {
            ...baseSlots[0],
            slotIndex: 1,
            spliceCount: 2,
            options: [{ id: 'shop', payload: ['shop_name', 'country'] }],
          },
          {
            ...baseSlots[1],
            slotIndex: 2,
          },
        ],
        { allowEmptyPayload: true, getPlacement: slot => slot.placement },
      ),
    ).toThrow(ERR_DYNAMIC_SLOT_OVERLAP);
  });

  test('allows overlapping slot ranges across different placements', () => {
    expect(() =>
      validateDynamicSlots(
        [
          baseSlots[0],
          {
            ...baseSlots[1],
            placement: 'rows',
            slotIndex: baseSlots[0].slotIndex,
          },
        ],
        { allowEmptyPayload: true, getPlacement: slot => slot.placement },
      ),
    ).not.toThrow();
  });

  test('validates payload length against spliceCount and allowEmptyPayload', () => {
    const slots: TestSlot[] = [
      {
        ...baseSlots[0],
        spliceCount: 2,
        options: [{ id: 'empty', payload: [] }],
      },
    ];

    expect(() =>
      validateDynamicSlots(slots, {
        allowEmptyPayload: false,
        getPlacement: slot => slot.placement,
      }),
    ).toThrow(ERR_DYNAMIC_SLOT_SPLICE_COUNT);

    expect(() =>
      validateDynamicSlots(slots, {
        allowEmptyPayload: true,
        getPlacement: slot => slot.placement,
      }),
    ).not.toThrow();

    expect(() =>
      validateDynamicSlots(
        [
          {
            ...baseSlots[0],
            spliceCount: 2,
            options: [{ id: 'short', payload: ['shop_name'] }],
          },
        ],
        { allowEmptyPayload: true, getPlacement: slot => slot.placement },
      ),
    ).toThrow(ERR_DYNAMIC_SLOT_SPLICE_COUNT);
  });

  test('throws when a selected option id is not in the slot options', () => {
    expect(() =>
      resolveDynamicSlotOptions(baseSlots, { level2: 'unknown' }),
    ).toThrow(ERR_DYNAMIC_SLOT_INVALID_OPTION);
  });

  test('applies splices in descending slot order', () => {
    const selectedOptions = resolveDynamicSlotOptions(
      [
        {
          ...baseSlots[0],
          slotIndex: 1,
          defaultOptionId: 'country',
        },
        {
          ...baseSlots[1],
          slotIndex: 2,
          defaultOptionId: 'msku',
        },
      ],
      {},
    );

    expect(
      applyDynamicSlotSplices(['biz_date', 'shop_name'], selectedOptions),
    ).toEqual(['biz_date', 'country', 'msku']);
  });

  test('uses one as the default splice count', () => {
    expect(
      getDynamicSlotSpliceCount({
        spliceCount: undefined,
      }),
    ).toBe(1);
  });
});
