import AgGridTableSchemeChartPlugin from '../src';

describe('AG Grid table scheme metadata', () => {
  it('uses the noway table v1 display name', () => {
    const plugin = new AgGridTableSchemeChartPlugin();

    expect(plugin.metadata.name).toBe('noway table v1');
  });
});
