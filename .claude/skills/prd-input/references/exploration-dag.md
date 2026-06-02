# 综合探索并行 DAG

## 核心原则

- 主 Agent 是唯一调度器和最终产物写入者。
- 所有 subAgent 都由主 Agent 直接启动，采用扁平 DAG。
- subAgent 禁止再 spawn subAgent。
- subAgent 只读代码和阶段产物，不写最终 `scope_map.json`、`context.md`、`question_backlog.json`。
- subAgent 如发现新缺口，只返回 `follow_up_tasks`，由主 Agent 判断是否补派第二批 Agent。

## Wave 0：主 Agent 预扫描

主 Agent 先轻量读取 PRD、summary、domain、AGENTS、模板索引、接口图谱总索引、历史归档和少量代码入口：

- 提取功能点列表，按核心/重要/辅助排序。
- 合并过小、强依赖或共享同一入口的功能点。
- 优先读取 `.vibe/index.md` 与 `.vibe/templates/`，识别候选可复用模板。
- 如果存在 `.vibe/interfaces/index.md`，优先匹配相关功能域，并记录每个功能点关联的候选 domain id 和 domain file。不要全量读取 domain files。
- 只有模板缺失、索引过旧或模板无法覆盖当前功能时，才有限补看同类代码并记录模板缺口。
- 默认每批最多 5 个 subAgent；超过则分批。

## Wave 1：垂直功能并行探索

启动多个 `Vertical Feature Agent`：

- 每个核心功能点默认一个 Agent。
- 辅助功能、强依赖功能或共享同一入口的功能可以合并。
- 每个 Agent 追踪现有逻辑、3 层以上调用链、改动点、影响范围、风险和待确认项。
- 输出回答“这个功能会改哪里”，并列出证据路径。
- 如存在接口图谱，输出必须说明该功能点与总索引中哪些功能域相关，以及判断依据。

## Wave 1：模板复用并行匹配

启动多个 `Template Reuse Agent`：

- 每个 Agent 负责一组功能点或一类候选模板的复用匹配。
- 优先判断已有模板是否适用，输出模板名称、适用功能点、复用方式、差量点、风险约束和证据路径。
- 如果没有匹配模板，只做有限代码补证，记录模板缺口，不重新抽取 Day0 模板。

## Wave 2：补证据

主 Agent 汇总 `follow_up_tasks` 后，只对真实缺口补开 Agent：

- 不重复探索已覆盖范围。
- 优先补充阻塞范围定位、调用链证据不足、垂直/模板复用结论冲突的任务。
- 补派 Agent 仍遵守只读、无嵌套 spawn、只返回建议项。

## Wave 3：主 Agent 汇总

主 Agent 统一合并所有 Agent 输出：

- 以垂直功能结果为主，记录功能点到模块、文件、方法、调用链的映射。
- 合并接口图谱证据，记录功能点到候选功能域和候选 domain file 的锚定关系；无法从总索引锚定的问题进入待确认项。正式的修改接口/新增接口判断留到 `/tech-design`。
- 以模板复用结果为主，记录匹配模板、适用功能点、复用方式、差量点和证据。
- 记录每个 Agent 的任务类型、覆盖范围、状态、证据摘要和 follow-up。
- 垂直结果和模板复用结果冲突时，不让单个 Agent 自动下结论，统一进入待确认项。

## 启用规则

- 功能点 ≥ 3 个时，默认启用多个 Vertical Feature Agent。
- 可匹配模板 ≥ 2 个或功能点 ≥ 2 个时，默认启用多个 Template Reuse Agent。
- 小需求只启用 1-2 个 Agent，避免并行开销超过收益。
