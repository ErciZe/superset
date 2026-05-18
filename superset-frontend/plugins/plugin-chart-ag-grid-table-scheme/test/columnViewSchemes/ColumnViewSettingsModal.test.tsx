import { render, screen, userEvent } from '@superset-ui/core/spec';
import ColumnViewSettingsModal from '../../src/columnViewSchemes/ColumnViewSettingsModal';

describe('ColumnViewSettingsModal', () => {
  it('uses Chinese text for the column drag handle', () => {
    render(
      <ColumnViewSettingsModal
        columnSettings={[
          {
            colId: 'sales',
            group: '指标数据',
            label: '销售额',
            pinned: false,
            visible: true,
          },
        ]}
        loading={false}
        onApply={jest.fn()}
        onCancel={jest.fn()}
        onReset={jest.fn()}
        open
      />,
    );

    expect(screen.getByLabelText('拖拽列')).toBeInTheDocument();
  });

  it('moves a newly pinned selected column after existing pinned columns', () => {
    render(
      <ColumnViewSettingsModal
        columnSettings={[
          {
            colId: 'hidden',
            group: '基础信息',
            label: '隐藏列',
            pinned: false,
            visible: false,
          },
          {
            colId: 'country',
            group: '基础信息',
            label: '国家',
            pinned: true,
            visible: true,
          },
          {
            colId: 'sales',
            group: '指标数据',
            label: '销售额',
            pinned: false,
            visible: true,
          },
          {
            colId: 'margin',
            group: '指标数据',
            label: '利润率',
            pinned: false,
            visible: true,
          },
        ]}
        loading={false}
        onApply={jest.fn()}
        onCancel={jest.fn()}
        onReset={jest.fn()}
        open
      />,
    );

    userEvent.click(screen.getAllByRole('button', { name: '固定' })[1]);

    const selectedLabels = screen
      .getAllByTestId('column-view-selected-label')
      .map(label => label.textContent);
    expect(selectedLabels).toEqual(['国家', '利润率', '销售额']);
  });
});
