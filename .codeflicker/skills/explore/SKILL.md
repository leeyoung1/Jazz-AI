---
name: explore
description: >-
  兼容入口，用于已有 PRD 项目的综合探索或重跑探索。消费已落盘的 PRD、待探索项、
  业务基线、历史归档与代码库，完成领域词汇、范围边界、`question_backlog` 重分类、
  代码范围定位、上下文分析、改动点与风险识别，输出 `discovery.md`、
  `question_backlog.json`、`context.md`、`scope_map.json`。
  新需求从 PRD 开始时优先使用 `/prd-input` 一次完成输入与探索。
---

# Explore — 已有 PRD 项目的综合探索/重跑探索

## Working Rules

- 只读分析，不修改任何项目源代码
- 本入口用于已有 `.prd/<PROJECT_NAME>/01-prd/prd.md` 的项目；新需求优先使用 `/prd-input`
- 必须先完成业务语义与范围边界校准，再进入代码范围定位与深入分析
- 所有判断必须基于证据（PRD / domain.md / AGENTS.md / 模板索引 / 接口图谱总索引 / 历史归档 / 代码）
- 没有证据支撑的推断必须标注 `[假设]`
- 每个功能点至少追溯 3 层调用链
- 改动点必须标注来源：来自 PRD 摘要的哪个功能点或业务规则
- 如果存在 `.vibe/index.md` 或仓库中的相似现有实现，优先把模板和样例作为分析与后续方案的第一参考输入
- 如果存在 `.vibe/interfaces/index.md`，必须优先用于把功能点锚定到候选功能域或候选 RPC/HTTP 边界；默认不要读取全部 domain files
- 模板和样例是高优先级参考，不是强约束；如果没有匹配到合适模板，必须说明原因，但继续正常推进分析
- 不确定的内容标注 `[待确认]`，不要猜测
- 只要属于本阶段职责范围内，且包含 AI 参与的判断、解释、映射、归因或假设，都必须向用户提问确认
- 先展示结果，用户确认后才进入下一阶段

**证据驱动提问规则（本阶段核心约束）：**

- 先尽最大可能收集业务基线、历史归档和代码证据，但证据只用于支撑提问与说明，不作为免确认理由
- 每个向用户提出的问题必须附带证据：
  - 业务问题：PRD 原文 / 历史归档 / 规则来源
  - 工程问题：相关文件路径/方法名/调用链 + 为什么现有代码无法回答 + 不确认的阻塞原因
- 没有文件证据，不允许提工程问题
- 如果 `question_backlog.json` 存在，必须先处理其中的问题，再新增待确认项
- 新增待确认项的 `ask_stage` 根据问题影响范围确定：
  - 阻塞需求理解或业务边界判断 → `ask_stage = explore`
  - 影响代码范围定位或需求-代码映射 → `ask_stage = explore`
  - 纯方案决策（不影响范围定位）→ `ask_stage = tech-design`

## 参数

调用时传入参数：

- `$ARGUMENTS` 格式：`--project <项目名> [--prd <prd文件路径>] [--templates <模板index路径>] [--interfaces <接口index路径>]`
  - `--project`：项目标识名（必填），对应 `.prd/{name}/` 目录
  - `--prd`：PRD 文件路径（可选，默认 `.prd/{name}/01-prd/prd.md`）
  - `--templates`：代码模板索引文件路径（可选，默认查找 `.vibe/index.md`）
  - `--interfaces`：接口图谱总索引路径（可选，默认查找 `.vibe/interfaces/index.md`）
- 示例：`/explore --project user-growth`

## 工作流

### Phase 1：加载输入与业务语义校准

**1.1 加载必要文件**

按以下顺序查找并读取：

1. PRD 主文档：`.prd/<PROJECT_NAME>/01-prd/prd.md`（必须存在，或 `--prd` 指定路径）
2. 业务领域知识：`.vibe/domain.md`（如有）
3. 仓库规范：`.vibe/AGENTS.md`（或根目录 `AGENTS.md`，如有）
4. 模板索引：`.vibe/index.md`（如有）
5. 接口图谱总索引：`.vibe/interfaces/index.md`（如有）
6. 历史归档索引：`.archive/index.md`（如有）
7. 相关历史归档：根据 `.archive/index.md` 中相似业务条目，读取对应的 `archive.md`（如有匹配）
8. 已有业务探索报告：`.prd/<PROJECT_NAME>/02-biz/discovery.md`（如有，作为增量输入）
9. 已有问题待办：`.prd/<PROJECT_NAME>/shared/question_backlog.json`（如有，作为增量输入）

**1.2 检查前置条件**

- 如果 PRD 文件不存在：告知用户「未找到 PRD 文档。新需求请先执行 `/prd-input <PRD/文件/文本> --name <项目名>` 完成输入与探索。」，停止工作流
- 如果 `.vibe/domain.md` 不存在：不硬停止。在结果中标注「缺少业务领域基线，建议先执行 domain-input 补充业务知识」，继续执行
- 如果 `.vibe/AGENTS.md` 和根目录 `AGENTS.md` 都不存在：不硬停止。在结果中标注「缺少仓库规范基线，建议先执行 project-init」，继续执行
- 如果 `.archive/index.md` 不存在：正常继续，跳过历史归档匹配

**1.3 提取领域术语**

从 PRD 中提取关键业务术语，建立词汇表：

| 术语 | PRD 中的表述 | 代码库中的对应（如有） | 类型 | 备注 |
|------|------------|---------------------|------|------|
| 用户 | 用户 | User | 角色 | |
| 服务类型 | 服务类型 | ServiceType | 枚举/对象 | |

术语类型：
- 角色
- 对象
- 动作
- 状态
- 枚举/配置

**1.4 命名对齐**

对照 domain.md、AGENTS.md 与历史归档中的用词，建立：
- PRD 用词 vs 代码用词映射
- 术语定义与同义词
- 业务规则和历史约束的引用关系

**1.5 历史归档匹配**

从 `.archive/index.md` 检索与当前需求相关的历史归档条目，提取：
- 关键设计决策
- 历史踩坑
- 业务规则遗留约束
- 可复用代码模式

**1.6 范围边界识别**

输出：
- In-Scope（确定在范围内）
- Out-of-Scope（确定不在范围内）
- Assumptions（假设，需用户确认）

**1.7 待探索项重分类**

从 `prd.md` 的「待探索项」和已有 `question_backlog.json` 中提取 gap，对每个问题：

- 属于本阶段职责范围且需要用户确认 AI 判断的 → `status = needs_clarification`，`ask_stage = explore`
- 需要代码验证并由本阶段继续补证据的 → `status = deferred`，`ask_stage = explore`
- 纯方案决策 → `status = open`，`ask_stage = tech-design`

**1.8 生成业务产物**

保存到：
- `.prd/<PROJECT_NAME>/02-biz/discovery.md`
- `.prd/<PROJECT_NAME>/shared/question_backlog.json`

`question_backlog.json` 格式：

```text
{
  "project": "<PROJECT_NAME>",
  "generated_at": "<ISO时间>",
  "generated_by": "explore",
  "questions": [
    {
      "id": "Q001",
      "original_gap": "prd-input 中的缺口描述",
      "category": "product_gap",
      "description": "重述为更清晰的问题",
      "owner": "pm / dev / codebase",
      "blocking_level": "high / medium / low",
      "ask_stage": "explore / tech-design",
      "status": "open / resolved / deferred / needs_clarification / partial / dropped",
      "resolution": "如果已解决，记录答案和来源",
      "evidence": ["AGENTS.md 第X节", "archive/xxx/archive.md"],
      "notes": "补充说明"
    }
  ]
}
```

### Phase 2：用户确认（覆盖本阶段全部 AI 判断项）

检查 `question_backlog.json` 中 `ask_stage = explore` 且 `status` 为 `needs_clarification`、`open` 或 `partial` 的问题：

- 如果为 0：直接进入 Phase 3
- 如果问题较少：逐条提问
- 如果问题较多：按功能点或主题分组展示，但不能因为证据充分或数量多而省略本阶段职责范围内的问题

提问必须附带：
- 问题描述
- 来源（PRD / 历史归档 / 规则缺口 / 代码证据）
- 不澄清的影响

用户反馈处理：
- 提供答案 → `status = resolved`
- 回复「跳过」→ `status = open`，保留
- 回复「删除」→ `status = dropped`

### Phase 3：代码范围定位

**3.1 加载业务探索产物**

使用 discovery.md 和 question_backlog.json 作为代码探索输入：
- discovery.md 中的领域词汇用于代码搜索词转换
- question_backlog 中 `status` 为 `open` / `deferred` 且 `ask_stage = explore` 的项优先消费

**3.2 提取功能点列表**

从 PRD 中提取所有功能点，每个功能点记录：
- 功能名称
- 优先级（核心/重要/辅助）
- 描述
- 关键词

**3.3 代码库定位与探索任务图**

对每个功能点，基于关键词定位：

1. 模块定位
2. 文件定位
3. 已有模板匹配与复用
4. 生成探索任务图，为后续多 Agent 并行探索做任务分派

主 Agent 先进行轻量预扫描：

- 提取功能点列表，按核心/重要/辅助排序
- 合并过小、强依赖或共享同一入口的功能点，避免过度拆分
- 根据 PRD、模板索引和少量代码入口识别候选可复用模板与模板缺口
- 根据接口图谱总索引识别每个功能点关联的候选功能域和 domain file；总索引无法锚定时进入待确认项
- 候选可复用模板与模板缺口由仓库证据决定，不写死；常见候选包括查询链路、写入链路、RPC/外部集成链路、异步任务/消息链路、配置/枚举/数据模型链路
- 设定每批最大并发数，默认最多 5 个 subAgent

输出 `scope_map.json`：

```text
{
  "project": "项目名",
  "generated_at": "ISO时间",
  "features": [
    {
      "name": "功能点名称",
      "priority": "核心",
      "keywords": ["关键词1", "关键词2"],
      "located_modules": ["模块路径"],
      "located_files": ["文件路径列表"],
      "call_chains": ["入口 -> service -> dao/rpc"],
      "candidate_interface_domains": ["候选功能域ID"],
      "candidate_domain_files": [".vibe/interfaces/domains/example.md"],
      "interface_candidates": [
        {
          "action": "modify/reference/new/delete",
          "rpc_method": "pkg.Service/MethodA 或 null",
          "service": "pkg.Service 或 null",
          "proto_path": "path/to/service.proto 或 null",
          "reason": "为什么该功能点涉及此接口或位置",
          "status": "candidate"
        }
      ],
      "related_template_matches": ["query/read"],
      "matched_template": "模板名或null",
      "confidence": "high/medium/low",
      "confirmed_interfaces": [
        {
          "rpc_method": "pkg.Service/MethodA 或 null",
          "service": "pkg.Service 或 null",
          "proto_path": "path/to/service.proto 或 null",
          "action": "modify",
          "confirmed_by": "user",
          "confirmed_at_phase": "explore_phase6",
          "status": "confirmed"
        }
      ]
    }
  ],
  "template_matches": [
    {
      "type": "query/read 或由仓库决定的链路类型",
      "representative_entries": ["文件路径#方法名"],
      "key_layers": ["controller", "service", "dao/rpc"],
      "applicable_features": ["功能点名称"],
      "evidence": ["文件路径#方法名"],
      "confidence": "high/medium/low"
    }
  ],
  "agent_runs": [
    {
      "agent_type": "vertical_feature / template_reuse / follow_up",
      "scope": "功能点或链路类型",
      "status": "completed/partial/blocked",
      "evidence_summary": "证据摘要",
      "follow_up_tasks": []
    }
  ],
  "agents": {
    "AGENTS.md_found": true,
    "template_index_found": true,
    "template_index_path": "路径",
    "interface_index_found": true,
    "interface_index_path": "路径"
  }
}
```

### Phase 4：消费 Question Backlog + 多 Agent 并行探索 DAG

**4.1 消费 Question Backlog**

从 `question_backlog.json` 中筛选 `status` 为 `open` 或 `deferred` 且 `ask_stage = explore` 的问题，对每个问题：

1. 在代码库中搜索相关文件/方法/调用链
2. 如果找到强证据：保留证据并继续要求用户确认，不得仅因 AI 认为答案明确就自动 `resolved`
3. 如果代码无法完全回答但缩小了范围：`status = partial`
4. 如果完全无法从代码回答且不再影响代码范围定位：将 `ask_stage = tech-design`

**4.2 调度约束**

- 所有 subAgent 都由主 Agent 直接启动，采用扁平 DAG；subAgent 禁止再 spawn subAgent
- subAgent 只读代码和阶段产物，不写最终 `scope_map.json`、`context.md`、`question_backlog.json`
- subAgent 如发现新缺口，只返回 `follow_up_tasks`，由主 Agent 判断是否补派第二批 Agent
- 功能点 ≥ 3 个时，默认启用多个 Vertical Feature Agent
- 可匹配模板 ≥ 2 个或功能点 ≥ 2 个时，默认启用多个 Template Reuse Agent
- 小需求只启用 1-2 个 Agent，避免并行开销超过收益
- 每批最多 5 个 subAgent；超过后由主 Agent 分批执行

**4.3 Wave 1：垂直功能并行探索**

主 Agent 按功能点/功能组启动多个 `Vertical Feature Agent`：

- 每个核心功能点默认一个 Agent
- 辅助功能、强依赖功能或共享同一入口的功能可以合并为一个 Agent
- 每个 Agent 追踪该功能的现有逻辑、3 层以上调用链、改动点、影响范围、风险和待确认项
- 输出必须回答“这个功能会改哪里”，并列出证据路径

**4.4 Wave 1：模板复用并行匹配**

主 Agent 根据功能点和模板索引启动多个 `Template Reuse Agent`：

- 每个 Agent 负责一组功能点或一类候选模板的复用匹配
- 优先读取 `.vibe/index.md` 和 `.vibe/templates/`，判断已有模板是否适用
- 输出模板名称、适用功能点、复用方式、差量点、风险约束和证据路径
- 如果没有匹配模板，只做有限代码补证，记录模板缺口，不重新抽取 Day0 模板

**4.5 Wave 2：补证据**

主 Agent 汇总 Wave 1 的 `follow_up_tasks` 后，只对真实缺口补开 Agent：

- 不重复探索已覆盖范围
- 优先补充阻塞范围定位、调用链证据不足或垂直/模板复用结论冲突的任务
- 补派 Agent 仍遵守只读、无嵌套 spawn、只返回建议项的规则

**4.6 Wave 3：主 Agent 汇总**

主 Agent 统一合并所有 Agent 输出：

- `features[]`：以垂直功能结果为主，记录功能点到模块、文件、方法、调用链的映射
- `features[]` 同时记录接口图谱证据：候选功能域、domain file、`interface_candidates`（待确认候选接口/位置）和 `confirmed_interfaces`（Phase 6 用户确认后的接口清单）。Phase 6 将强制向用户确认所有涉及接口改造的功能点对应的具体接口或新增位置，不再推迟到下游阶段
- `template_matches[]`：以模板复用结果为主，记录匹配模板、适用功能点、复用方式、差量点和证据
- `agent_runs[]`：记录每个 Agent 的任务类型、覆盖范围、状态、证据摘要和 follow-up
- 垂直结果和模板复用结果冲突时，不让单个 Agent 自动下结论，统一进入待确认项

每个待确认项必须包含：
- 问题
- 影响
- 代码证据
- 为什么代码无法回答
- 推荐处理阶段（默认 `tech-design`）

### Phase 5：汇总与输出

生成：

- `.prd/<PROJECT_NAME>/03-context/context.md`
- `.prd/<PROJECT_NAME>/shared/scope_map.json`

`context.md` 必须包含：
- 需求概要
- 模板复用总览
- 接口图谱命中总览（功能点 / 候选功能域 / domain file）
- 逐功能点分析（现有逻辑 + 改动点 + 影响范围 + 风险）
- 垂直/模板证据交叉校验结果
- 整体依赖关系
- 冲突与风险
- 待确认项

### Phase 6：证据驱动人工确认

汇总以下待确认项：

1. question_backlog 中仍为 `open` 或 `partial` 的项
2. 代码探索中新增的待确认项
3. **接口确认**：所有涉及接口变更的功能点的具体接口（强制执行，见下方接口确认步骤）

**接口确认步骤：**

对于 `scope_map.json` 中存在 `interface_candidates` 或候选接口功能域的每个功能点，根据候选 action 类型逐一确认；确认后才写入 `confirmed_interfaces`。

**modify（修改已有接口）：**

1. 基于 `candidate_interface_domains` 和 `candidate_domain_files`，读取对应 domain file 获取该功能域下的接口清单
2. 列出候选接口（RPC 方法名级别，含简要说明）
3. 使用 AskUserQuestion 向用户确认：

```
功能点「{名称}」涉及修改已有接口。已锚定功能域 `{domain_id}`。

该功能域下接口：
  1. {rpc_method} — {简短描述}
  2. {rpc_method} — {简短描述}

请确认：需要修改哪个具体接口？（可选多个）
```

**new（新增接口）：**

1. 基于 `candidate_interface_domains`，列出可添加新接口的候选 service/proto 位置
2. 使用 AskUserQuestion 向用户确认：

```
功能点「{名称}」涉及新增接口。已锚定功能域 `{domain_id}`。

该功能域下可添加位置的候选 service/proto：
  1. pkg.ServiceA — {简短描述（如 proto 路径）}
  2. pkg.ServiceB — {简短描述（如 proto 路径）}

请确认：
- 新接口加到哪个 service/proto 下？
- 是否可以通过修改已有接口实现此功能（不新增）？
```

3. 如果代码探索发现 `new` 功能点实际上可通过修改已有接口实现，必须向用户提出此选项，由用户决定是否改为 `modify`

**reference（参考接口）：**

1. 列出需要参考（只读不改）的候选接口
2. 使用 AskUserQuestion 向用户确认需要参考哪些接口

**强制规则（所有 action 通用）：**

- 不得跳过此步骤，即使 AI 认为接口明显或置信度高
- **new 功能点只确认归属位置（service/proto），不设计接口结构（留给 tech-design Phase 2A）**
- `reference` 功能点已确认接口，但接口结构设计仍由 tech-design 负责
- 不得在没有接口图谱的情况下自行推断具体接口或位置
- 用户确认后写入 `scope_map.json` 的 `confirmed_interfaces`：
  - `modify/reference/delete`：必须包含 `rpc_method`、`action`、`confirmed_by`、`status`
  - `new`：只要求包含 `service`、`proto_path`、`action`、`confirmed_by`、`status = confirmed_location`，`rpc_method` 可为空，接口结构留给 tech-design
- 用户回复「不知道」→ 将候选信息写入 `question_backlog`（`ask_stage = tech-design`），`confirmed_interfaces` 标记 `confirmed_by = deferred_to_tech_design`、`status = pending`
- 无法确认的部分也必须写入 backlog，不得在无用户确认的情况下默认任何接口

过滤规则：

- 本阶段提问：
  - 属于本阶段职责范围
  - 包含 AI 参与的判断、解释、映射、归因或假设
  - 影响业务边界判断、代码范围定位或需求-代码映射
  - 代码中存在与 PRD / domain.md 明显不一致之处
- 推迟到 `tech-design`：
  - 纯方案决策

## 提示下一步

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXPLORE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**{项目名} — 综合探索完成**

| 产出文件 | 路径 |
|---------|------|
| 业务探索报告 | `.prd/<PROJECT_NAME>/02-biz/discovery.md` |
| 问题待办 | `.prd/<PROJECT_NAME>/shared/question_backlog.json` |
| 上下文分析报告 | `.prd/<PROJECT_NAME>/03-context/context.md` |
| 范围定位地图 | `.prd/<PROJECT_NAME>/shared/scope_map.json` |

**探索概要：**
- 领域术语: {N} 个
- 历史归档匹配: {N} 个
- 范围内: {N} 项 / 范围外: {N} 项 / 假设: {N} 项
- 功能点: {N} 个
- 改动点: {N} 个（修改 {X}, 新增 {Y}, 删除 {Z}）
- 接口图谱命中: 功能域 {D} 个
- 风险: 高 {H}, 中 {M}, 低 {L}
- Question Backlog: 总 {N} → 已补充证据 {R} / 推迟到 tech-design {D} / 需用户确认 {C}

下一步建议：
  /tech-design --project <PROJECT_NAME>    ← 生成技术方案
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 成功标准

- [ ] 成功读取 PRD 主文档
- [ ] 尝试读取 `.vibe/domain.md`（如存在则用于术语对齐和业务规则匹配；不存在则标注缺失，继续执行）
- [ ] 尝试读取 `.vibe/AGENTS.md`（或根目录 `AGENTS.md`；如存在则用于命名对齐；不存在则标注缺失，继续执行）
- [ ] 尝试读取 `.vibe/interfaces/index.md` 总索引（如存在则用于锚定功能点候选功能域；不存在则标注缺失，继续执行）
- [ ] 尝试读取 `.archive/index.md`（如存在则用于历史归档匹配；不存在则跳过历史归档阶段）
- [ ] 领域词汇表已建立（角色/对象/动作/状态/枚举）
- [ ] 历史归档已检索并提取相关经验
- [ ] 范围边界已识别（in-scope / out-of-scope / assumptions）
- [ ] prd-input 的待探索项已全部重分类
- [ ] question_backlog.json 已生成或更新（含 status / evidence / ask_stage）
- [ ] 本阶段职责范围内且包含 AI 判断的事项，均已向用户提问确认
- [ ] Phase 3 定位了每个功能点的代码范围
- [ ] Phase 4 采用主 Agent 扁平调度的多 Agent 并行探索 DAG
- [ ] 功能点 ≥ 3 个时已默认启用多个 Vertical Feature Agent（除非合并有明确理由）
- [ ] 可匹配模板 ≥ 2 个或功能点 ≥ 2 个时已默认启用多个 Template Reuse Agent
- [ ] 所有 subAgent 均由主 Agent 直接启动，未要求 subAgent 再 spawn subAgent
- [ ] scope_map.json 包含 features、template_matches、agent_runs 三类信息
- [ ] 如存在接口图谱总索引，scope_map.json 和 context.md 已记录候选功能域和 domain file，且未全量读取 domain files
- [ ] question_backlog 中需要代码验证的项已补充代码证据，并保留给用户确认
- [ ] context.md 包含：模板复用总览、逐功能点分析、垂直/模板证据交叉校验结果、冲突与风险
- [ ] 每个改动点标注了类型（修改/新增/删除）、来源功能点、风险等级
- [ ] 尝试匹配了模板索引中的链路模板
- [ ] 新增待确认项附带代码证据（文件路径 + 方法名 + 片段 + 无法回答原因）
- [ ] scope_map.json 已生成
- [ ] 所有涉及接口变更的功能点（含 modify/new/reference）已在 Phase 6 向用户确认，AI 未自行跳过或默认任何接口
- [ ] `modify` 功能点已确认具体 RPC 方法名；`new` 功能点已确认归属 service/proto（不含接口结构设计）
- [ ] `scope_map.json` 中每个涉及接口的功能点已填充 `interface_candidates`；Phase 6 后已填充 `confirmed_interfaces`（`status = confirmed`、`confirmed_location` 或 `pending`）
- [ ] 用户回复「不知道」的接口已写入 `question_backlog`，`ask_stage = tech-design`，附带候选功能域和候选接口清单
- [ ] 未修改任何项目源代码（只读分析）
