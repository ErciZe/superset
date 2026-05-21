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

export const ERR_DYNAMIC_SLOT_DUPLICATE_OPTION =
  'ERR_DYNAMIC_SLOT_DUPLICATE_OPTION';
export const ERR_DYNAMIC_SLOT_DUPLICATE_SLOT =
  'ERR_DYNAMIC_SLOT_DUPLICATE_SLOT';
export const ERR_DYNAMIC_SLOT_INVALID_OPTION =
  'ERR_DYNAMIC_SLOT_INVALID_OPTION';
export const ERR_DYNAMIC_SLOT_OVERLAP = 'ERR_DYNAMIC_SLOT_OVERLAP';
export const ERR_DYNAMIC_SLOT_SPLICE_COUNT = 'ERR_DYNAMIC_SLOT_SPLICE_COUNT';

export type DynamicSlotOption<TPayload extends readonly unknown[]> = {
  id: string;
  payload: TPayload;
};

export type DynamicSlot<TPayload extends readonly unknown[]> = {
  id: string;
  slotIndex: number;
  spliceCount?: number;
  defaultOptionId: string;
  options: DynamicSlotOption<TPayload>[];
};

export type SelectedDynamicSlotOption<
  TPayload extends readonly unknown[],
  TSlot extends DynamicSlot<TPayload> = DynamicSlot<TPayload>,
> = {
  slot: TSlot;
  option: DynamicSlotOption<TPayload>;
};

type ValidateDynamicSlotsOptions<
  TPayload extends readonly unknown[],
  TSlot extends DynamicSlot<TPayload>,
> = {
  allowEmptyPayload?: boolean;
  getPlacement?: (slot: TSlot) => string;
};

export function getDynamicSlotSpliceCount(
  slot: Pick<DynamicSlot<readonly unknown[]>, 'spliceCount'>,
): number {
  return slot.spliceCount ?? 1;
}

export function validateDynamicSlots<
  TPayload extends readonly unknown[],
  TSlot extends DynamicSlot<TPayload>,
>(
  slots: TSlot[],
  {
    allowEmptyPayload = false,
    getPlacement = () => '',
  }: ValidateDynamicSlotsOptions<TPayload, TSlot> = {},
): void {
  const seenSlotIds = new Set<string>();
  const occupiedRangesByPlacement = new Map<string, Set<number>>();

  slots.forEach(slot => {
    if (seenSlotIds.has(slot.id)) {
      throw new Error(ERR_DYNAMIC_SLOT_DUPLICATE_SLOT);
    }

    seenSlotIds.add(slot.id);

    const spliceCount = getDynamicSlotSpliceCount(slot);
    const occupiedRanges =
      occupiedRangesByPlacement.get(getPlacement(slot)) ?? new Set<number>();

    for (let offset = 0; offset < spliceCount; offset += 1) {
      const itemIndex = slot.slotIndex + offset;

      if (occupiedRanges.has(itemIndex)) {
        throw new Error(ERR_DYNAMIC_SLOT_OVERLAP);
      }

      occupiedRanges.add(itemIndex);
    }

    occupiedRangesByPlacement.set(getPlacement(slot), occupiedRanges);

    const seenOptionIds = new Set<string>();

    slot.options.forEach(option => {
      if (seenOptionIds.has(option.id)) {
        throw new Error(ERR_DYNAMIC_SLOT_DUPLICATE_OPTION);
      }

      seenOptionIds.add(option.id);

      if (
        option.payload.length !== spliceCount &&
        (!allowEmptyPayload || option.payload.length > 0)
      ) {
        throw new Error(ERR_DYNAMIC_SLOT_SPLICE_COUNT);
      }
    });
  });
}

export function resolveDynamicSlotOptions<
  TPayload extends readonly unknown[],
  TSlot extends DynamicSlot<TPayload>,
>(
  slots: TSlot[],
  selectedOptionIdsBySlot?: Record<string, string>,
): SelectedDynamicSlotOption<TPayload, TSlot>[] {
  return slots.map(slot => {
    const selectedOptionId =
      selectedOptionIdsBySlot?.[slot.id] ?? slot.defaultOptionId;
    const option = slot.options.find(
      candidateOption => candidateOption.id === selectedOptionId,
    );

    if (!option) {
      throw new Error(ERR_DYNAMIC_SLOT_INVALID_OPTION);
    }

    return { slot, option };
  });
}

export function applyDynamicSlotSplices<
  TItem,
  TSlot extends DynamicSlot<readonly TItem[]> = DynamicSlot<readonly TItem[]>,
>(
  items: TItem[],
  selectedOptions: SelectedDynamicSlotOption<readonly TItem[], TSlot>[],
): TItem[] {
  const effectiveItems = [...items];
  const descendingOptions = [...selectedOptions].sort(
    (leftOption, rightOption) =>
      rightOption.slot.slotIndex - leftOption.slot.slotIndex,
  );

  descendingOptions.forEach(({ option, slot }) => {
    effectiveItems.splice(
      slot.slotIndex,
      slot.slotIndex === items.length ? 0 : getDynamicSlotSpliceCount(slot),
      ...option.payload,
    );
  });

  return effectiveItems;
}
