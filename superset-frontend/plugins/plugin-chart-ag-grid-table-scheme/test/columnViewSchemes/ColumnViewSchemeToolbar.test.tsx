import { render, screen } from '@superset-ui/core/spec';
import ColumnViewSchemeToolbar from '../../src/columnViewSchemes/ColumnViewSchemeToolbar';
import { useColumnViewSchemes } from '../../src/columnViewSchemes/useColumnViewSchemes';

jest.mock('../../src/columnViewSchemes/useColumnViewSchemes', () => ({
  useColumnViewSchemes: jest.fn(),
}));

const mockUseColumnViewSchemes = useColumnViewSchemes as jest.Mock;

describe('ColumnViewSchemeToolbar', () => {
  beforeEach(() => {
    mockUseColumnViewSchemes.mockReturnValue({
      activeScheme: { id: 1, is_default: true, name: '日常方案' },
      applyColumnSettings: jest.fn(),
      deleteActiveScheme: jest.fn(),
      deleting: false,
      getDefaultColumnSettings: jest.fn(() => []),
      getColumnSettings: jest.fn(() => []),
      loading: false,
      resetColumns: jest.fn(),
      saveActiveScheme: jest.fn(),
      saveAsScheme: jest.fn(),
      saving: false,
      schemes: [{ id: 1, is_default: true, name: '日常方案' }],
      setActiveAsDefault: jest.fn(),
      switchScheme: jest.fn(),
    });
  });

  it('uses Chinese text for scheme toolbar actions', () => {
    render(
      <ColumnViewSchemeToolbar
        chartId={1}
        colDefs={[]}
        columnSettingsEnabled
        gridApi={{} as never}
        schemeManagementEnabled
      />,
    );

    expect(screen.getByText(/保\s*存/)).toBeInTheDocument();
    expect(screen.getByText('另存为')).toBeInTheDocument();
    expect(screen.getByText(/重\s*置/)).toBeInTheDocument();
    expect(screen.getByText(/删\s*除/)).toBeInTheDocument();
  });
});
