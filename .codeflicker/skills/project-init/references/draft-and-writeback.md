# Draft And Writeback Reference

## Phase 2 — User Intent Checkpoint

在进入第二阶段前，必须先确认用户希望这次结果停留在“知识储备”，还是继续提炼为“强约束”。

优先使用 `AskUserQuestion` tool，只问一个问题：

- 这次输出是作为“知识储备”保留，还是要继续提炼为“强约束”并生成严格的 `AGENTS.md` 规则？

推荐两个选项：

- 知识储备：保留探索结果、完整链路模板、能力模板、差异点，作为后续理解仓库和人工判断的输入
- 强约束：继续进入下一阶段，提炼必须/禁止/默认规则，目标产物是可执行的 `AGENTS.md`

如果当前环境没有 `AskUserQuestion` tool：

- 用一条简短文本问题直接询问用户
- 在得到用户明确答复前，不进入强规则提炼

分支规则如下：

- 用户选择“知识储备”：停止在探索结果层，输出仓库画像、模板、不一致点和观察性总结；不要默认写入 `AGENTS.md`
- 用户选择“强约束”：继续执行后续阶段

## Phase 3 — Hard Rules Extraction

只有当用户明确选择“强约束”时，才执行本阶段。

从已有规范文档、构建配置、代码样本、测试样本中提炼硬约束。优先提炼以下内容：

- 构建、检查、测试命令及执行顺序
- 增量改动边界和禁止项
- 入口层、编排层、转换层、集成层的强职责边界
- 参数校验、空值处理、集合返回、默认值处理规则
- 错误码、异常抛出、日志级别、日志语言、打点规则
- 仓库特有基础设施约束，例如 proto、配置中心、fetch、消息队列、性能、序列化工具
- 新代码模板、注释规范、作者信息、提交前自检项

强规则写入标准：

- 至少由已有规范文档直接声明，或由 2-3 个以上稳定代码样本共同支撑
- 能写成 `必须`、`禁止`、`默认`、`仅限` 这类执行性语句
- 仅观察到但未形成稳定共识的内容，不得写成强规则，只能保留在“不一致项”中

本阶段输出：

- Hard Rules Candidate List
- Evidence Table
- Open Questions

## Phase 4 — Repository-Specific Standards Draft

基于已有规范和代码样本，生成一份仓库规范草案。

草案按以下结构输出，按仓库实际情况删减或补充：

### 1. Project Structure

- 顶层模块说明
- 关键资源目录
- 测试目录组织

### 2. Architecture Rules

- 入口层职责
- 编排层职责
- 核心逻辑层职责
- 集成层职责
- 契约层职责
- 层间调用方向

### 3. Naming And Placement Rules

- 文件命名
- 类/函数/模块命名
- 新代码应放置的位置
- 公共代码应放置的位置

### 4. Data And Contract Rules

- 参数对象、返回对象、状态对象、schema、types 的组织方式
- 转换逻辑的放置位置
- 默认值、空值、空集合处理方式

### 5. Error Handling Rules

- 错误类型
- 抛错方式
- 错误返回方式
- 统一处理点位置

### 6. Logging And Observability Rules

- 日志级别
- 日志语言
- 埋点/metrics/trace 的位置
- 关键路径是否要求日志和打点同时出现

### 7. Testing Rules

- 单元测试位置
- 集成测试位置
- fixture/mock 的组织方式
- 新功能最小测试要求

### 8. Forbidden Patterns

从代码和规范文档里提炼明确禁止项，例如：

- 在入口层混入业务逻辑
- 在编排层内联大量转换代码
- 不返回统一格式
- 跳过日志或埋点
- 把外部依赖调用散落在多个层次
- 缺少测试或把测试写错层

### 9. Inconsistencies

单列一节，记录仓库内未统一的写法：

- 哪些点不一致
- 各自出现在哪些路径
- 哪种写法更主流
- 暂不统一，只做记录

## Phase 5 — Template Pack

最终模板按类型分组，每个模板输出为独立文件，位于 `.vibe/templates/` 目录。

模板文件格式详见 [template-format.md](references/template-format.md)。

### Output Requirements

- 至少输出 3 个 Flow Bundle Templates，每个保存为 `.vibe/templates/flow-{name}.md`
- 至少输出 5 个 Capability Templates（仓库中发现的稳定能力），每个保存为 `.vibe/templates/capability-{name}.md`
- 所有模板文件必须包含完整 frontmatter
- 模板生成完成后，**自动调用 `/templates-index`** 生成索引文件

## Final Output Format

最终汇总必须按以下顺序输出：

1. Repository Profile
2. Existing Rules Summary
3. Role Map
4. Module Map
5. User Intent Decision
6. End-to-End Flow Templates
7. Capability Templates
8. Hard Rules Candidate List
9. Repository Standards Draft
10. Inconsistencies And Gaps
11. Suggested Document Targets

## Document Writeback

展示结果后，询问用户是否写入文档。

### Default Output Locations

| File Type | Path | Description |
|-----------|------|-------------|
| 仓库规范 | `AGENTS.md` | 仓库强约束规范（仅当用户选择"强约束"时写入） |
| Flow 模板 | `.vibe/templates/flow-{name}.md` | 端到端链路模板（每个独立文件，含 frontmatter） |
| Capability 模板 | `.vibe/templates/capability-{name}.md` | 横向能力模板（每个独立文件，含 frontmatter） |
| 模板索引 | `.vibe/index.md` | 模板目录索引（由 `/templates-index` Skill 自动生成） |
| 接口图谱总索引 | `.vibe/interfaces/index.md` | 后端接口图谱总索引（由 `/interface-index` Skill 生成，供 hooks 注入） |
| 接口图谱领域文件 | `.vibe/interfaces/domains/*.md` | 每个 proto 或入口文件一个功能域明细 |

### Writeback Strategy

**用户选择"知识储备"：**
- 默认不写入任何文件，仅展示探索结果
- 如用户额外确认，可写入模板文件到 `.vibe/templates/`
- 后端接口图谱仍按 `/interface-index` 规则处理：总索引保持轻量，领域细节写入 `.vibe/interfaces/domains/`
- 不写入 AGENTS.md

**用户选择"强约束"：**
- 规范写入 `AGENTS.md`
- 模板分别写入 `.vibe/templates/` 目录下（每个模板独立文件）
- 后端接口图谱写入 `.vibe/interfaces/index.md` 和 `.vibe/interfaces/domains/`
- 所有模板写入后，**自动调用 `/templates-index`** 生成 `.vibe/index.md`
- 写入前展示变更摘要（新增哪些模板、更新哪些模板）

### Handling Existing Templates

如果仓库已有 `.vibe/templates/`：
- 新增模板：直接创建新文件
- 更新模板：同名文件则覆盖，但保留 frontmatter 中的 `created_at` 字段
- 展示变更摘要（新增/更新/删除）

如果仓库没有 `.vibe/templates/`：
- 创建 `.vibe/` 目录
- 创建 `.vibe/templates/` 子目录
- 写入所有模板文件
- 调用 `/templates-index` 生成索引
