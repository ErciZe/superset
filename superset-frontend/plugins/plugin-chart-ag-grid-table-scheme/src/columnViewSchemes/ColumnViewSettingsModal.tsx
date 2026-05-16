/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information.
 * The ASF licenses this file to You under the Apache License, Version 2.0.
 */
import { useEffect, useMemo, useState } from 'react';
import { styled, t } from '@superset-ui/core';
import { Button, Checkbox, Input, Modal, Space } from 'antd';
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  arrayMove,
} from 'react-sortable-hoc';
import { Icons } from '@superset-ui/core/components/Icons';
import type { ColumnSettingGroup, ColumnSettingItem } from './types';

const COLUMN_GROUPS: ColumnSettingGroup[] = [
  '日期/时间',
  '基础信息',
  '指标数据',
  '其他',
];

const Content = styled.div`
  ${({ theme }) => `
    border-top: 1px solid ${theme.colorBorderSecondary};
    display: grid;
    gap: ${theme.sizeUnit * 4}px;
    grid-template-columns: minmax(0, 1fr) 320px;
    margin-top: ${theme.sizeUnit * 4}px;
    padding-top: ${theme.sizeUnit * 4}px;
  `}
`;

const LeftPane = styled.div`
  ${({ theme }) => `
    border-right: 1px solid ${theme.colorBorderSecondary};
    max-height: 560px;
    overflow: auto;
    padding-right: ${theme.sizeUnit * 4}px;
  `}
`;

const RightPane = styled.div`
  max-height: 560px;
  overflow: auto;
`;

const GroupBlock = styled.div`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 4}px;
  `}
`;

const GroupHeader = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const FieldGrid = styled.div`
  ${({ theme }) => `
    display: grid;
    gap: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    grid-template-columns: repeat(2, minmax(160px, 1fr));
  `}
`;

const SelectedHeader = styled.div`
  ${({ theme }) => `
    align-items: center;
    color: ${theme.colorTextSecondary};
    display: flex;
    justify-content: space-between;
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const SelectedItem = styled.div`
  ${({ theme }) => `
    align-items: center;
    background: ${theme.colorFillQuaternary};
    border-radius: ${theme.borderRadius}px;
    display: grid;
    gap: ${theme.sizeUnit * 2}px;
    grid-template-columns: 20px 28px minmax(0, 1fr) auto auto;
    margin-bottom: ${theme.sizeUnit * 2}px;
    min-height: 40px;
    padding: ${theme.sizeUnit * 2}px;
  `}
`;

const OrderNumber = styled.span`
  color: ${({ theme }) => theme.colorTextSecondary};
  text-align: right;
`;

const ColumnLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DragHandle = SortableHandle(() => (
  <Icons.MenuOutlined
    aria-label={t('Drag column')}
    role="img"
    style={{ cursor: 'ns-resize' }}
  />
));

type SortableSelectedItemProps = {
  item: ColumnSettingItem;
  order: number;
  onRemove: (colId: string) => void;
  onTogglePinned: (colId: string) => void;
};

const SortableSelectedItem = SortableElement(
  ({ item, order, onRemove, onTogglePinned }: SortableSelectedItemProps) => (
    <SelectedItem>
      <DragHandle />
      <OrderNumber>{order}</OrderNumber>
      <ColumnLabel title={item.label}>{item.label}</ColumnLabel>
      <Button
        size="small"
        type={item.pinned ? 'primary' : 'default'}
        onClick={() => onTogglePinned(item.colId)}
      >
        {item.pinned ? t('取消固定') : t('固定')}
      </Button>
      <Button size="small" type="text" onClick={() => onRemove(item.colId)}>
        x
      </Button>
    </SelectedItem>
  ),
);

type SortableSelectedListProps = {
  items: ColumnSettingItem[];
  onRemove: (colId: string) => void;
  onTogglePinned: (colId: string) => void;
};

const SortableSelectedList = SortableContainer(
  ({ items, onRemove, onTogglePinned }: SortableSelectedListProps) => (
    <div>
      {items.map((item, index) => (
        <SortableSelectedItem
          index={index}
          item={item}
          key={item.colId}
          onRemove={onRemove}
          onTogglePinned={onTogglePinned}
          order={index + 1}
        />
      ))}
    </div>
  ),
);

type ColumnViewSettingsModalProps = {
  columnSettings: ColumnSettingItem[];
  loading?: boolean;
  open: boolean;
  onApply: (settings: ColumnSettingItem[]) => void;
  onCancel: () => void;
  onReset: () => void;
};

export default function ColumnViewSettingsModal({
  columnSettings,
  loading,
  open,
  onApply,
  onCancel,
  onReset,
}: ColumnViewSettingsModalProps) {
  const [draftSettings, setDraftSettings] = useState<ColumnSettingItem[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (open) {
      setDraftSettings(columnSettings);
      setSearchText('');
    }
  }, [columnSettings, open]);

  const normalizedSearchText = searchText.trim().toLowerCase();
  const filteredSettings = useMemo(
    () =>
      draftSettings.filter(
        item =>
          !normalizedSearchText ||
          item.label.toLowerCase().includes(normalizedSearchText) ||
          item.colId.toLowerCase().includes(normalizedSearchText),
      ),
    [draftSettings, normalizedSearchText],
  );
  const visibleSettings = draftSettings.filter(item => item.visible);
  const visibleSettingsByGroup = useMemo(() => {
    const grouped = new Map<ColumnSettingGroup, ColumnSettingItem[]>();
    COLUMN_GROUPS.forEach(group => grouped.set(group, []));
    filteredSettings.forEach(item => {
      grouped.get(item.group)?.push(item);
    });
    return grouped;
  }, [filteredSettings]);

  const updateDraftSetting = (
    colId: string,
    updater: (item: ColumnSettingItem) => ColumnSettingItem,
  ) => {
    setDraftSettings(current =>
      current.map(item => (item.colId === colId ? updater(item) : item)),
    );
  };

  const setGroupVisible = (group: ColumnSettingGroup, visible: boolean) => {
    const groupColIds = new Set(
      filteredSettings
        .filter(item => item.group === group)
        .map(item => item.colId),
    );
    setDraftSettings(current =>
      current.map(item =>
        groupColIds.has(item.colId) ? { ...item, visible } : item,
      ),
    );
  };

  const removeSelected = (colId: string) => {
    updateDraftSetting(colId, item => ({ ...item, visible: false }));
  };

  const togglePinned = (colId: string) => {
    updateDraftSetting(colId, item => ({ ...item, pinned: !item.pinned }));
  };

  const handleSortEnd = ({
    oldIndex,
    newIndex,
  }: {
    oldIndex: number;
    newIndex: number;
  }) => {
    if (oldIndex === newIndex) {
      return;
    }
    const reorderedVisibleSettings = arrayMove(
      visibleSettings,
      oldIndex,
      newIndex,
    );
    const hiddenSettings = draftSettings.filter(item => !item.visible);
    setDraftSettings([...reorderedVisibleSettings, ...hiddenSettings]);
  };

  return (
    <Modal
      destroyOnClose
      footer={
        <Space>
          <Button disabled={loading} onClick={onReset}>
            {t('恢复默认')}
          </Button>
          <Button disabled={loading} onClick={onCancel}>
            {t('取消')}
          </Button>
          <Button
            disabled={visibleSettings.length === 0}
            loading={loading}
            onClick={() => onApply(draftSettings)}
            type="primary"
          >
            {t('保存并应用')}
          </Button>
        </Space>
      }
      onCancel={onCancel}
      open={open}
      title={t('列设置')}
      width={920}
    >
      <Content>
        <LeftPane>
          <Input
            allowClear
            onChange={event => setSearchText(event.target.value)}
            placeholder={t('搜索字段')}
            value={searchText}
          />
          {COLUMN_GROUPS.map(group => {
            const groupItems = visibleSettingsByGroup.get(group) || [];
            if (groupItems.length === 0) {
              return null;
            }
            const checkedCount = groupItems.filter(item => item.visible).length;
            return (
              <GroupBlock key={group}>
                <GroupHeader>
                  <Checkbox
                    checked={checkedCount === groupItems.length}
                    indeterminate={
                      checkedCount > 0 && checkedCount < groupItems.length
                    }
                    onChange={event =>
                      setGroupVisible(group, event.target.checked)
                    }
                  >
                    {group}
                  </Checkbox>
                </GroupHeader>
                <FieldGrid>
                  {groupItems.map(item => (
                    <Checkbox
                      checked={item.visible}
                      key={item.colId}
                      onChange={event =>
                        updateDraftSetting(item.colId, current => ({
                          ...current,
                          visible: event.target.checked,
                        }))
                      }
                    >
                      {item.label}
                    </Checkbox>
                  ))}
                </FieldGrid>
              </GroupBlock>
            );
          })}
        </LeftPane>
        <RightPane>
          <SelectedHeader>
            <span>
              {t('已选')} ({visibleSettings.length})
            </span>
          </SelectedHeader>
          <SortableSelectedList
            helperClass="column-view-settings-dragging"
            items={visibleSettings}
            lockAxis="y"
            onRemove={removeSelected}
            onSortEnd={handleSortEnd}
            onTogglePinned={togglePinned}
            useDragHandle
          />
        </RightPane>
      </Content>
    </Modal>
  );
}
