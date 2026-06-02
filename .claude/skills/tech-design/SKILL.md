---
name: tech-design
description: >-
  基于上下文分析报告 `context.md` 生成高质量技术方案，或解析已有技术方案文档。
  专注于接口契约、改造点与影响分析。适用于 `explore` 完成后触发，
  或已有技术方案需要解析、或需要生成包含接口契约和改造点的技术方案时。
  不适用于编码执行或任务拆解。
---

# Tech Design — 技术方案生成/解析

基于 explore 的分析结果生成高质量技术方案，或解析已有的技术方案文档。经过人工确认后产出 tech_design.md。

## Working Rules

- 技术方案必须基于 context.md 的分析结果，不能脱离代码实际
- 方案详细程度由需求复杂度自适应决定
- 如果存在 `.vibe/index.md` 或相似现有实现，优先把模板和样例作为方案设计的第一参考输入
- 如果存在 `.vibe/interfaces/index.md`，先读取接口图谱总索引；只有需求命中特定功能域时，才读取对应 `.vibe/interfaces/domains/*.md`，并在接口契约中明确参考、修改或新增接口
- 如果 `scope_map.json` 中存在 `confirmed_interfaces`（`status = confirmed`），必须将其作为接口契约的输入源，不得自行重新推断或增减接口
- 模板和样例是推荐参考，不是强约束；如果没有匹配到合适模板，必须明确写出未匹配原因，但继续给出通用可执行方案
- 方案描述优先回答“代码准备怎么沿用现有骨架来写”，再回答新增或差量实现内容
- **人工确认是强阻断，必须确认后才算完成** — 不得跳过确认流程，不得自行将方案标记为已确认
- 接口契约必须包含完整的入参、出参、错误码定义
- 不确定的技术选型标注 `[待确认]`
- 本 Skill 只产出技术方案，不负责任务拆解（由 plan-task 负责）
- **如果 AskUserQuestion 工具不可用，必须用文本方式逐条列出确认项，等待用户明确回复"确认"后才算通过** — 不得将"展示了方案"等同于"用户已确认"

## 参数

调用时传入参数：

- `$ARGUMENTS` 格式：`--project <项目名> [--url <方案URL>] [--file <方案文件路径>]`
  - `--project`：项目标识名（必填），对应 `.prd/{name}/` 目录
  - `--url`：已有技术方案的在线文档链接（可选，提供则走「解析分支」）
  - `--file`：已有技术方案的本地文件路径（可选，提供则走「解析分支」）
  - 如果 `--url` 和 `--file` 均未提供，走「生成分支」
- 示例：
  - `/tech-design --project user-growth`（AI 生成方案）
  - `/tech-design --project user-growth --url https://example.com/tech-design`（解析在线方案）
  - `/tech-design --project user-growth --file ./docs/tech-design.md`（解析本地方案）

## 工作流

### 分支判断

- 如果用户提供 `--from <文件>` 或明确说“解析已有方案”，进入解析分支。
- 否则进入生成分支。

## 生成分支

> **L1（Lite Flow）模式**：若 `.prd/{name}/shared/level.json` 的 `level` 为 `"L1"`，本阶段按精简流程执行（各 Phase 的 L1 差异见下方标注）。核心原则：**跳过残留问题决策与实现偏好收集，但接口二次确认与方案人工确认照常保留**——这是 Lite 流程唯一的确认环节，质量不能打折。

### Phase 1A：加载上下文

读取 PRD、业务探索、上下文范围、问题 backlog 和已有模板；详细加载清单见 `references/generation-rules.md`。

### Phase 1.5A：残留问题决策 + 接口二次确认 + 实现偏好收集

在生成方案前处理 `question_backlog.json` 中需要本阶段决策的问题，展示 explore 阶段已确认的接口清单进行二次确认，并收集会影响方案结构的实现偏好；细则见 `references/generation-rules.md`。

> **L1（Lite Flow）**：跳过残留问题决策（无 `question_backlog.json`）与实现偏好收集；**接口二次确认照常保留**——`scope_map.json` 的 `confirmed_interfaces` 仍须逐条向用户确认，这是 Lite 流程接口安全网的关键。

### Phase 2A：生成技术方案

按 `references/generation-rules.md` 生成 `tech_design.md`，覆盖方案概要、接口契约、代码改造点、数据模型、流程、影响和风险。

> **L1（Lite Flow）**：方案只产出「方案概要 + 接口契约 + 代码改造点」三段，跳过数据模型/时序/影响分析/风险评估等重内容（等同 generation-rules 的「简单」档）。接口契约直接取自 `scope_map.json` 的 `confirmed_interfaces`，不重新推断。**代码改造点必须逐文件列清楚**，因为 Lite 流程下 TDD 直接以它作为执行工单。

## 解析分支

### Phase 1B：获取已有方案

从用户指定文件或粘贴内容读取已有技术方案；详细输入处理见 `references/parse-rules.md`。

### Phase 2B：解析与对齐

按 `references/parse-rules.md` 将已有方案解析为标准结构，并与 PRD、探索产物和待确认问题对齐。

## 通用阶段

### Phase 3：人工确认（强阻断）

必须按 `references/confirmation-and-output.md` 展示方案摘要、关键决策、风险和待确认项；用户明确确认前不得进入任务拆解。

> **L1（Lite Flow）同样强阻断**：tech-design 是 Lite 流程唯一的方案确认门，必须等用户明确确认后才将 `pending_human_confirm` 设为 `false`；不得自行标记确认。

### Phase 4：输出结果

确认后写入 `.prd/{name}/04-design/tech_design.md`，更新阶段状态。输出格式见 `references/confirmation-and-output.md`。下一步提示按档位：
- **L1（Lite Flow）**：`/tdd --project {name}`（跳过 plan-task，TDD 从 tech_design 的代码改造点提取执行范围）。
- **L2 / L3（Full Flow）**：`/plan-task --project {name}`。

## 成功标准

- [ ] 成功读取 context.md 和 PRD 摘要
- [ ] 如存在 `.vibe/interfaces/index.md`，已先读取总索引；仅对命中的功能域读取 domain file，并在接口契约中引用相关功能域或接口
- [ ] 技术方案包含接口契约和改造点
- [ ] 如 `scope_map.json` 中存在 `confirmed_interfaces`，Phase 1.5A 已展示接口确认清单并完成二次确认
- [ ] tech_design.md 中的接口契约与 `confirmed_interfaces` 中的 `status = confirmed` 接口一致，无自行新增或修改的接口身份
- [ ] 方案详细程度与需求复杂度匹配
- [ ] 方案已通过人工确认（强阻断）
- [ ] tech_design.md 已保存
- [ ] 未修改任何项目源代码
