import { render, screen } from '@superset-ui/core/spec';
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
});
