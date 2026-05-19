import CrosstabTableChartPlugin from '../src';

describe('CrosstabTableChartPlugin', () => {
  it('has chart metadata and a lazy chart loader', () => {
    const plugin = new CrosstabTableChartPlugin();

    expect(plugin.metadata.name).toBe('Crosstab Table');
    expect(plugin.metadata.category).toBe('Table');
    expect(plugin.loadChart).toBeDefined();
  });
});
