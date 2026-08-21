# 爆品指数趋势默认图例实施计划

1. 先为安全 ECharts 解析器和 Mixed Timeseries transform 增加失败测试，锁定静态 `legend.selected` 与动态值拒绝行为。
2. 在 `legendSchema` 中只增加 `z.record(z.string(), z.boolean())` 形式的 `selected` 字段，并跑聚焦 Jest 测试。
3. 先为生成器增加失败合同测试，再给三张趋势图写入完整的默认图例选择映射。
4. 运行两套爆品指数 Python 测试、ECharts 聚焦 Jest、ruff/prettier/oxlint、类型检查、ZIP 确定性和 `pre-commit run --all-files`。
5. 从干净精确提交构建生产镜像；发布前备份镜像、资产、Dashboard 元数据和三张趋势图配置。
6. 切换镜像后仅更新三张趋势图，不导入 Dashboard YAML，验证 Dashboard `position_json` 与发布前一致。
7. 验证 26 张主图 API、Dashboard 保存、服务健康与日志；浏览器检查天/周/月三个趋势 Tab 的默认图例状态。
8. 任一构建、图表更新、布局一致性、API 或浏览器门禁失败时，恢复镜像和三张图表配置并停止。
