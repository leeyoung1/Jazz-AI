# Parallel Exploration Reference

## Phase 1 — Parallel Exploration

必须同时启动结构探索、多个垂直链路模板抽取、横向能力模板抽取。主 Agent 是唯一调度器和最终模板合并者。

### Agent A — Structure And Module Map

任务：

1. 阅读顶层目录和主要模块
2. 识别模块边界和依赖方向
3. 总结每个模块职责
4. 找出配置、资源、生成代码、脚本所在位置
5. 给出简化目录树

输出：

- 简化目录树
- 模块职责说明
- 依赖方向说明
- 关键资源位置表

### Agent B1..Bn — Vertical Flow Template Extraction

任务不是由一个 Agent 串行抽所有链路，而是由主 Agent 按功能点、功能模块或链路簇并行启动多个垂直模板抽取 subAgent。

**主 Agent 分派规则：**

1. 先根据仓库画像、入口层、模块边界和代码目录识别候选功能点/功能模块。
2. 将候选功能点合并为若干互不重叠的垂直抽取任务。
3. 每个核心功能模块或高频链路类型默认一个 `Vertical Flow Agent`。
4. 小模块、强依赖模块或共享同一入口/编排层的功能可以合并为一个 Agent。
5. 每批最多并行 5 个 `Vertical Flow Agent`；超过则分批执行。
6. 如果某个 subAgent 发现需要额外样本或跨模块补证据，只返回 `follow_up_tasks`，由主 Agent 统一补派。

**垂直抽取目标：**

每个 `Vertical Flow Agent` 抽取自己负责范围内的完整功能链路，保持从触发点到输出/副作用的端到端闭环。

不要把真实样例简单压缩成一个“大而全方法”。必须把链路拆成分层配套模板，保持各层职责边界清晰。

所有 `Vertical Flow Agent` 合计至少抽取 3 条真实链路。优先选择仓库中最常见的链路类型：

- 请求查询链路
- 写入/变更链路
- 页面交互链路
- 异步消费链路
- 定时任务链路
- CLI 命令执行链路
- 数据同步/批处理链路
- SDK 调用链路

每条链路都必须覆盖：

1. 触发点
2. 入口文件
3. 参数或状态如何进入系统
4. 编排逻辑在哪一层
5. 核心逻辑在哪一层
6. 外部依赖、数据库、缓存、消息、文件系统、浏览器状态如何接入
7. 返回、渲染、落库、发消息或输出如何完成
8. 错误处理放在哪
9. 日志、埋点、trace、metrics 如何做
10. 测试覆盖落在哪

每条链路输出为一个完整的 `Flow Bundle Template`，格式固定如下：

#### Flow Bundle Template: `<name>`

- Trigger:
- Use When:
- Avoid When:
- Layer Boundary:
- Input Contract:
- Entry Template:
- Orchestration Template:
- Core Logic Template:
- Integration / Persistence Template:
- Output / Side Effects:
- Fixed Steps:
- Replaceable Steps:
- Error Handling:
- Logging / Metrics:
- Test Template:
- Source Files:

模板输出要求：

- `Entry Template` 只保留协议适配、参数接收、轻量校验、调用下层、返回组装；不要把转换、外调、状态流转、落库全部塞进入口方法
- `Orchestration Template` 负责主流程编排，不内联大段协议转换和底层细节
- `Core Logic Template` 只放复用业务规则、状态判断、领域处理
- `Integration / Persistence Template` 只放 dao、repository、fetch、producer、gateway 等边界调用
- `Fixed Steps` 只写该类链路稳定重复出现的骨架步骤
- `Replaceable Steps` 只写按业务场景变化的插槽步骤
- 代码片段只保留骨架，不抄大段实现；不要把单个真实样例压缩后直接冒充模板

**主 Agent 合并规则：**

- 主 Agent 负责合并所有 `Vertical Flow Agent` 输出，去重相似模板。
- 如果两个 Agent 输出同类链路但层次边界不同，保留为变体并标注来源，不强行统一。
- 最终 Flow 模板必须能追溯到具体 source files。
- 不允许任何 subAgent 直接写 `.vibe/templates/flow-*.md`；模板文件只由主 Agent 在用户确认后写入。

### Agent C — Cross-Cutting Capability Templates

按能力维度抽样，不按技术名预设。

检查这些能力是否存在：

- 持久化
- 缓存或状态管理
- 外部调用
- 消息或事件
- 配置读取
- 权限或上下文
- 日志与观测
- 序列化或数据契约
- 后台任务
- 测试基建

每种能力至少找到 2 个样本；找不到则写“未发现稳定模式”。

每种能力输出固定格式，并且必须是“可执行模板”，不是名词摘要：

#### Capability Template: `<name>`

- Purpose:
- Typical Location:
- Use When:
- Avoid When:
- Upstream Caller:
- Downstream Dependency:
- Setup Template:
- Execution Template:
- Result Handling Template:
- Error Pattern:
- Observability Pattern:
- Test Template:
- Fixed Steps:
- Replaceable Steps:
- Common Variants:
- Test Pattern:
- Source Files:

模板输出要求：

- `Setup Template` 说明依赖如何注入、初始化、构造
- `Execution Template` 给出最小调用骨架，而不是只列注解或类名
- `Result Handling Template` 说明结果转换、空值处理、返回策略
- `Fixed Steps` 标识稳定不变的调用顺序
- `Replaceable Steps` 标识按场景调整的逻辑
- 如果某种能力只找到零散调用，不能硬写模板，只能标记为“样本不足”
