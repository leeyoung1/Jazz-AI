---
name: prd-input
description: >-
  新需求主入口。输入 PRD 链接、本地文件路径或直接需求描述，保存 PRD 原文、提取核心产品点，
  然后继续完成业务语义校准、代码范围定位、并行上下文探索和证据驱动人工确认。
  适用于开始新的功能需求、接收 PRD 文档（URL/文件/文本）或主动调用 `/prd-input` 时。
---

# Requirement Input — 需求输入与综合探索

## 入口定位

- `/prd-input` 是新需求从 PRD 到综合探索的主入口。
- 生成 PRD 产物后必须继续进入综合探索，不再提示用户手动执行 `/explore`。
- `/explore --project <项目名>` 只作为已有 PRD 项目的重跑/兼容入口。
- 本阶段只写 `.prd/<PROJECT_NAME>/` 下的阶段产物，不修改业务源码或项目级配置文件。

## 关键引用

如需具体格式或细则，按需读取：

- `references/prd-extraction.md`：PRD 获取、图片识别、摘要维度、`summary.jsonl` 字段。
- `references/exploration-dag.md`：主 Agent 扁平调度、多垂直 Agent、模板复用 Agent、补派规则。
- `references/output-contracts.md`：`question_backlog.json`、`scope_map.json`、`context.md` 结构。

## 强制规则

- 先获取内容再分析，内容获取失败时不生成摘要或探索产物。
- PRD 原文必须完整保存，不删减、不替换图片引用。
- URL 模式必须先用可用的文档抓取方式（浏览器、`curl`/`wget` 或粘贴正文）把文档下载为本地 Markdown；失败或返回登录页/403 时立即停止并提示用户确认权限或改用本地文件/文本模式。
- PRD 中的本地图片必须逐一读取并尝试识别；无法识别时标注 `[待确认]`。
- 摘要必须从 PRD 原文和图片信息中提取，不添加无证据内容。
- 不确定的产品点、业务规则或工程判断必须标注 `[待确认]`。
- 禁止在 PRD 获取、摘要提取或代码探索中途分散提问；必须先完成提取与探索，再统一向用户确认。
- 业务问题必须附 PRD 原文、历史归档或规则来源；工程问题必须附文件路径、方法名或调用链。
- 纯方案决策不在本阶段强行确认，记录为 `ask_stage = tech-design`。
- 模型能力确认必须真实询问用户，禁止 Agent 根据自身能力、上下文或经验自行确认。
- 梳理功能点/功能组时必须先判断其是否为已有功能点、已有功能改造或全新功能点，并记录判断依据。
- 不论 Agent 判断功能点属于已有、改造还是新增，都必须在 Phase 6 统一向用户确认；禁止 Agent 自行确认或默认用户已认可。
- 向用户确认功能点时，必须清晰展示“改造的功能点”，包括原有能力、改造内容、影响范围和判断依据。
- 如果存在 `.vibe/interfaces/index.md`，必须读取总索引并用于把功能点锚定到候选功能域或候选 RPC/HTTP 边界；本阶段不要读取全部 domain file。

## 参数

`$ARGUMENTS` 格式：`<内容> [--name <项目名>]`

- URL 链接：`/prd-input https://example.com/docs/prd-123 --name user-growth`
- 本地文件：`/prd-input /path/to/prd.md --name user-growth`
- 直接描述：`/prd-input 改造权限系统支持服务类型标签 --name permit-tag`
- `--name` 可选；缺失时从标题或描述中提取英文短标识。
- `--level L1|L2|L3`：显式指定复杂度档位（`--level L1` 即走 Lite Flow）；缺省时由 Phase 1.3 自动判定。**更推荐用专用命令 `/lite-prd`**（无需记参数，且避免 `--lite` 布尔 flag 吞掉后面的描述文本）。

输入类型判断：

- 以 `http://` 或 `https://` 开头 → URL 模式。
- 以 `/` 或 `./` 开头，或指向存在文件 → 文件模式。
- 其他内容 → 直接描述模式。

## 工作流

### Phase 0：模型能力确认

本阶段可能需要识别 PRD 图片。执行前必须向用户确认当前模型是否支持图片识别：

- 支持多模态：正常读取并识别图片。
- 不支持多模态：跳过图片识别，并在最终结果中标注「未进行图片识别」。

注意：此确认必须由用户明确回答后才能继续，Agent 禁止自行判断或代替用户确认。

### Phase 1：获取并保存 PRD

1. 解析 `INPUT` 和 `PROJECT_NAME`。
2. 根据输入类型获取 PRD 内容。
3. URL 模式先用可用的文档抓取方式（浏览器、`curl`/`wget` 或粘贴正文）保存到 `.prd/<PROJECT_NAME>/01-prd/prd-source.md`。
4. 读取 PRD 原文和本地图片，按 `references/prd-extraction.md` 处理。
5. 保存完整 PRD 到 `.prd/<PROJECT_NAME>/01-prd/prd.md`。

### Phase 1.3：复杂度档位判定与流程分流（决定 Lite / Full）

PRD 原文保存后，先判定复杂度档位，决定走 Lite Flow（`prd-input → tech-design → tdd`）还是 Full Flow（完整流程）。

1. **读取判定规则**：按 `../_shared/level-detector.md` 的档位定义和信号判定。
2. **确定初判档位**：
   - 用户通过 `/lite-prd` 或 `--level Lx`（如 `--level L1`）进入 → 以用户声明为初判。
   - 否则基于 PRD 原文初步判定（改动规模、是否新增接口、是否跨服务、是否高风险）。
3. **AskUserQuestion 二次确认（强制，不静默生效）**：展示初判档位、判定依据（预估文件数/行数、是否新增接口/跨服务）和各档流程差异；选项为「确认 L1（Lite）/ 升级 L2 / 升级 L3」。AskUserQuestion 不可用时用文本列出并等待用户明确回复。
4. **写入 `.prd/<PROJECT_NAME>/shared/level.json`**：
   ```json
   { "level": "L1", "auto_detected": true, "user_confirmed": true, "reason": "<一句话依据>" }
   ```
   仅最终档位为 L1 时启用 Lite Flow；L2/L3 写对应值但等同完整流程。
5. **流程分流**：
   - **L1（Lite）**：只保留 `01-prd/prd.md`、`03-context/context.md`、`shared/scope_map.json`、`shared/level.json` 四个产物。跳过 Phase 2 的 `prd_summary.md`/`summary.jsonl`、Phase 3（`discovery.md` + `question_backlog.json`）；Phase 4/5 改为主 Agent 轻量定位（不起多 Agent 并行 DAG），`scope_map.json` 只填 `affected_files` 与 `confirmed_interfaces`，`context.md` 只写改动点清单。**这三个产物是 `/tech-design` 的前置依赖，不可省略。**
   - **L2 / L3（Full）**：按原有 Phase 2 ~ Phase 6 完整执行，不跳过任何阶段。

### Phase 2：提取核心产品点

基于完整 PRD 原文和图片识别结果，生成：

- `.prd/<PROJECT_NAME>/01-prd/prd_summary.md`
- `.prd/<PROJECT_NAME>/01-prd/summary.jsonl`

摘要维度和 JSONL 字段按 `references/prd-extraction.md` 执行。

梳理功能点时必须先做已有性判断：

- 对每个功能点标注 `existing_status`：`existing`、`modified_existing`、`new`、`unknown`。
- `existing` 表示 PRD 只是描述原有能力或沿用原行为；`modified_existing` 表示在原有能力上做改造；`new` 表示没有发现既有能力证据；`unknown` 表示证据不足。
- 判断必须引用 PRD 原文、domain、历史归档、模板索引或代码证据；无证据时只能标注 `unknown`。
- 这些判断都不是最终确认，必须进入 Phase 6 交由用户确认。

### Phase 3：业务语义校准

> **L1（Lite Flow）跳过本阶段**：不生成 `discovery.md` 与 `question_backlog.json`；业务语义在 tech-design 的接口二次确认中由用户把关。

读取以下输入并建立业务探索基础：

1. `.prd/<PROJECT_NAME>/01-prd/prd.md`
2. `.prd/<PROJECT_NAME>/01-prd/summary.jsonl`
3. `.vibe/domain.md`（如有）
4. `.vibe/AGENTS.md` 或根目录 `AGENTS.md`（如有）
5. `.vibe/index.md`（如有）
6. `.vibe/interfaces/index.md`（接口图谱总索引，如有）
7. `.archive/index.md` 和相关历史归档（如有）
8. 已有 `discovery.md` / `question_backlog.json`（如为增量重跑）

输出：

- `.prd/<PROJECT_NAME>/02-biz/discovery.md`
- `.prd/<PROJECT_NAME>/shared/question_backlog.json`

### Phase 4：代码范围定位与任务图

主 Agent 先轻量预扫描：

- 提取并合并功能点/功能组。
- 对每个功能点优先识别是否已有能力、已有能力改造或新增能力，并补充证据来源。
- 优先使用 `.vibe/interfaces/index.md` 匹配可能相关的功能域，记录候选 domain id 和 domain file；不要在本阶段展开所有领域文件。
- 定位候选模块、文件、方法和调用链。
- 识别候选可复用模板与模板缺口。
- 生成探索任务图，为并行 Agent 分派做准备。

并行 DAG 细则按 `references/exploration-dag.md` 执行。

### Phase 5：多 Agent 并行探索

> **L1（Lite Flow）简化本阶段**：不起多 Agent 并行 DAG，由主 Agent 直接轻量定位改动文件与可复用模板，产出精简 `scope_map.json`（`affected_files` + `confirmed_interfaces`）与精简 `context.md`（改动点清单）。

由主 Agent 扁平调度：

- 多个 `Vertical Feature Agent`：按功能点/功能组追踪“这个功能会改哪里”。
- 多个 `Template Reuse Agent`：按功能点匹配 `.vibe/index.md` 与 `.vibe/templates/` 中已有模板，判断如何复用；没有匹配模板时才做有限代码补证并记录模板缺口。
- 必要时基于 `follow_up_tasks` 补派第二批 Agent。

约束：

- subAgent 只读，不写最终产物。
- subAgent 禁止再 spawn subAgent。
- 主 Agent 是唯一调度器和最终产物写入者。

输出：

- `.prd/<PROJECT_NAME>/shared/scope_map.json`
- `.prd/<PROJECT_NAME>/03-context/context.md`

产物结构按 `references/output-contracts.md` 执行。

### Phase 6：证据驱动人工确认

汇总以下待确认项后统一向用户确认：

- PRD 提取阶段识别的产品语义、业务规则、工程实现和需代码验证缺口。
- 每个功能点的已有性判断：已有功能点、已有功能改造、全新功能点或证据不足。
- 所有“改造的功能点”清单，必须清晰展示原有能力、改造内容、影响范围、证据来源和待用户确认的问题。
- 基于接口图谱得到的功能点锚定结果：关联哪些候选功能域、对应哪些 domain file、是否需要在 `/tech-design` 读取领域文件继续判断接口变更。
- 业务语义校准中的范围边界、术语映射、历史规则和假设。
- 代码探索中新增或补证据后的待确认项。
- 代码中与 PRD / domain.md / 历史归档明显不一致的内容。

确认要求：

- 必须向用户展示功能点确认表；禁止只给结论或在内部自行确认。
- 即使 Agent 判断为已有功能点或全新功能点，也必须请用户确认判断是否正确。
- 对 `modified_existing` 的功能点必须突出“这是对已有能力的改造”，并列出“原来怎么做”和“现在要怎么改”。

用户反馈处理：

- 提供答案 → `status = resolved`，记录 `resolution` 和来源。
- 回复「跳过」→ `status = open`，保留到后续阶段。
- 回复「删除」→ `status = dropped`。
- 纯方案决策 → `ask_stage = tech-design`。

## 输出提示

> **L1（Lite Flow）输出**：产物只有 `01-prd/prd.md`、`03-context/context.md`、`shared/scope_map.json`、`shared/level.json`；下一步仍是 `/tech-design --project <PROJECT_NAME>`（将自动走 Lite 简化确认，保留接口二次确认与方案人工确认）。

完成后展示（Full Flow）：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRD INPUT + EXPLORE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<PROJECT_NAME> — 需求输入与综合探索完成

产出文件：
- .prd/<PROJECT_NAME>/01-prd/prd.md
- .prd/<PROJECT_NAME>/01-prd/prd_summary.md
- .prd/<PROJECT_NAME>/01-prd/summary.jsonl
- .prd/<PROJECT_NAME>/02-biz/discovery.md
- .prd/<PROJECT_NAME>/shared/question_backlog.json
- .prd/<PROJECT_NAME>/03-context/context.md
- .prd/<PROJECT_NAME>/shared/scope_map.json

下一步建议：
  /tech-design --project <PROJECT_NAME>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 成功标准

- [ ] PRD 内容成功获取；失败时未生成摘要或探索产物。
- [ ] PRD 原文完整保存到 `.prd/<PROJECT_NAME>/01-prd/prd.md`。
- [ ] 图片已按能力尽可能识别，无法识别项已标注 `[待确认]`。
- [ ] `prd_summary.md` 和 `summary.jsonl` 已生成。
- [ ] 每个功能点已标注已有性判断：已有、已有改造、新增或证据不足。
- [ ] 如存在 `.vibe/interfaces/index.md`，已读取总索引并用于锚定功能点候选功能域；未全量读取 domain files。
- [ ] `discovery.md` 和 `question_backlog.json` 已生成或更新。
- [ ] 主 Agent 已按扁平 DAG 调度垂直/模板探索，且未要求 subAgent 嵌套 spawn。
- [ ] `scope_map.json` 包含 `features`、`template_matches`、`agent_runs`。
- [ ] `context.md` 包含模板复用、逐功能点分析、交叉校验、冲突与风险。
- [ ] Phase 0 模型能力已由用户明确确认，Agent 未自行确认。
- [ ] 所有功能点的已有性判断和所有改造功能点已在 Phase 6 统一向用户确认。
- [ ] 本阶段职责范围内的业务/工程不确定项已统一向用户确认。
- [ ] 未修改业务源码、`CLAUDE.md`、`AGENTS.md` 等项目级配置文件。
