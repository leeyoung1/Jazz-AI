---
name: plan-task
description: >-
  基于已确认的技术方案 `tech_design.md` 生成可确认的执行契约，覆盖 `Wave`、`Plan`、
  `depends_on`、`files_modified`、`requirements`、`must_haves`、`execution_hints` 等字段。
  适用于 `tech-design` 已确认后触发。保留独立阶段，但不再承载详细测试规格。
---

# Plan Task — 执行契约生成器

当前仓库已启用 hooks-first 上下文注入。已确认的 `tech_design.md`、`context.md`、`scope_map.json`、接口图谱总索引与仓库规范会在运行时自动进入上下文；本 Skill 只负责把技术方案拆成可确认、可调度、可恢复的执行契约，并继承技术方案中已确认的接口边界。

## 目标

产出 `.prd/{project}/05-tasks/tasks.md`，作为后续 `/tdd` 的唯一执行源。`tasks.md` 必须只承载执行契约，不承载详细测试规格。

## Working Rules

- 必须基于已确认的 `tech_design.md`，禁止脱离方案自行推演需求。
- 拆解单位必须是垂直切片 Plan，不是“只改模型/只改接口”这类水平层任务。
- 每个 Plan 必须足够让 `/tdd` 的 planner 反推出测试规格：目标行为、边界、关键连接、受影响文件、依赖前提必须完整。
- 如技术方案或 `scope_map.json` 存在已确认接口，必须把接口身份写入对应 Plan 的执行契约；TDD 阶段不得重新推断接口身份。
- `tasks.md` 只写执行契约，不写测试 case 列表、断言细节、mock 细节或测试目录结构。
- 同一 Wave 内的 Plan 不得修改同一文件；冲突必须合并成同一 Plan 或拆到后续 Wave。
- `human_confirmed` 必须默认 `false`。未确认的 `tasks.md` 下游 `/tdd` 必须拒绝执行。

## 输入

- 命令：`/plan-task --project <项目名>`
- hooks 已注入：
  - `.prd/{project}/04-design/tech_design.md`
  - `.prd/{project}/03-context/context.md`
  - `.prd/{project}/shared/scope_map.json`
  - `AGENTS.md` 或 `.vibe/AGENTS.md`
  - `.vibe/index.md`（如存在）
  - `.vibe/interfaces/index.md`（接口图谱总索引，如存在）

## 输出契约

保存到：`.prd/{project}/05-tasks/tasks.md`

建议结构：

```md
---
project: demo
generated_at: 2026-04-13T10:00:00Z
source_tech_design: .prd/demo/04-design/tech_design.md
human_confirmed: false
---

# Tasks

## WAVE 1

### PLAN-01: Demo flow

> | 字段 | 值 |
> |------|------|
> | wave | 1 |
> | depends_on | 无 |
> | files_modified | src/a.ts, tests/a.test.ts |
> | requirements | REQ-1 |
> | interfaces_modified | pkg.Service/MethodA |
> | interfaces_added | pkg.Service(proto/path/service.proto) |
> | interfaces_referenced | pkg.OtherService/Query |
> | autonomous | true |

**描述**: 一句话描述交付目标

**must_haves**:
- truths: 用户可观测行为
- artifacts: 必须出现的文件或导出
- key_links: 关键链路连接
- interfaces: 已确认接口身份，必须继承自 tech_design.md 或 scope_map.json

**execution_hints**:
- recommended_template: 推荐模板或“无”
- related_examples: 参考文件路径
- sequencing: 推荐实现顺序
- risks: 特别边界/前置依赖

<tasks>
<task type="auto">
  <name>面向动作的任务</name>
  <files>src/a.ts, tests/a.test.ts</files>
  <action>基于哪个模板/样例做什么差量改动；没有模板时写“按技术方案直接实现”</action>
  <verify>
    <automated>可执行的验证命令</automated>
  </verify>
  <done>完成后系统/文件应处于什么状态</done>
</task>
</tasks>
```

## Phase 1：读取与校准

1. 读取已注入的 `tech_design.md`、`context.md`、`scope_map.json` 和仓库规范。
2. 提取技术方案中的所有改造点、需求 ID、接口约束、依赖关系；如存在接口图谱，只用于校验并继承技术方案里的功能域、参考接口、修改接口和新增接口，不重新展开全量图谱。
3. 识别是否存在可复用模板或现有样例，实现时只记录引用和差量提示，不把模板正文复制进 `tasks.md`。

## Phase 2：拆成 Wave + Plan

1. 将改造点按端到端能力切成多个 Plan。
2. 为每个 Plan 明确：
   - `wave`
   - `depends_on`
   - `files_modified`
   - `requirements`
   - `interfaces_modified`
   - `interfaces_added`
   - `interfaces_referenced`
   - `must_haves`
   - `execution_hints`
3. `interfaces_modified/interfaces_added/interfaces_referenced` 必须来自已确认的 tech_design.md 接口契约或 `scope_map.json.confirmed_interfaces`；缺失时写“无”，不得自行新增接口身份。
4. 根据依赖拓扑把 Plan 归入多个 Wave。
5. 若两个 Plan 修改同一文件，必须合并或串行。

## Phase 3：Plan Checker

只检查 6 个维度：

1. 需求覆盖：所有需求点都被某个 Plan 覆盖，且不重复。
2. 依赖正确性：无循环依赖，Wave 顺序和依赖一致。
3. 文件冲突：同 Wave 的 `files_modified` 不重叠。
4. 切片完整性：每个 Plan 都是可独立验证的端到端切片。
5. Plan 规模：Plan 过大或过小要重整，避免失衡。
6. 接口继承：所有确认过的接口/新增位置都被某个 Plan 覆盖，且 Plan 中未出现未确认接口身份。
7. 范围缩减：禁止“先 hardcode / 先做简化版 / v1 先不做边界”等隐式降级。

自动修复 blocker 最多 3 轮；超过上限则停止并报告用户。

## Phase 4：人工确认

- 展示 Wave 拆解、Plan 列表和 Plan Checker 结果。
- 只有用户明确确认后，才写入 `tasks.md`。
- 无确认工具时，必须等待用户文本回复”确认”。

## 明确不做

- 不在 `tasks.md` 中定义详细测试规格。
- 不生成 `06-execution/plans/*`；这些由 `/tdd` Phase 0 planner 生成。
- 不直接进入编码或写测试文件。

## 提示下一步

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PLAN TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**{project} — 任务拆解完成**

| 产出文件 | 路径 |
|---------|------|
| 执行契约 | `.prd/{project}/05-tasks/tasks.md` |

**拆解概要：**
- Wave: {N} 个
- Plan: {N} 个
- 文件冲突: {N} 个
- 待确认项: {N} 个

下一步建议：
  /tdd --project {project}    ← 进入 TDD 执行
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 成功标准

- [ ] `tasks.md` 已生成到 `.prd/{project}/05-tasks/tasks.md`
- [ ] frontmatter 中 `human_confirmed` 默认为 `false`
- [ ] 每个 Plan 都包含 Wave/依赖/文件范围/requirements/must_haves/execution_hints
- [ ] 如存在接口图谱，每个涉及接口的 Plan 已在 execution_hints 中引用技术方案确认的功能域、接口 ID 或说明新增接口
- [ ] Plan Checker 只覆盖 6 个维度
- [ ] 无详细测试设计泄漏到 `tasks.md`
