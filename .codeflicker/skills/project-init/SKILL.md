---
name: project-init
description: >-
  首次进入陌生仓库时，先探索仓库并提取仓库原生工程规范，以及可复用的端到端实现模板，
  再开始做改动。适用于第一次接手陌生仓库、需要理解一个功能通常如何在该仓库落地、
  需要从现有代码中提炼可复用模板、或需要为多语言单仓库建立探索基线时。
  不适用于上下游已知的单文件小改动，或用户只问某个具体代码位置且不需要全局探索的场景。
---

# Codebase Pattern Bootstrap

进入陌生仓库后，先识别仓库类型，再并行抽取结构、多个垂直完整链路模板、横向组件模板，最后生成仓库规范草案和模板文档。

## Working Rules

- 先读规范文档，再读代码样本，再下结论。
- 必须并行探索，至少 3 个 Agent 同时启动。
- 完整链路模板抽取必须由主 Agent 扁平调度多个垂直模板抽取 subAgent；不要只启动一个“垂直模板 Agent”串行抽所有链路。
- subAgent 禁止再 spawn subAgent；如发现缺口只返回 follow_up_tasks，由主 Agent 统一补派、合并和写最终模板。
- 每类模式至少看 3 个样本；不足 3 个时，明确标注“样本不足”。
- 先抽“完整链路模板”，再抽“单点组件模板”。
- 在进入第二阶段前，必须先询问用户这次结果是作为“知识储备”还是继续提炼为“强约束”。
- 模板必须标注来源文件路径，只总结代码中重复出现的模式。
- 发现不一致写法时，单独列出，不强行合并为统一规范。
- 先展示结果，用户确认后再写入文档。

## 工作流

### Phase 0 — Baseline Scan

执行前先读取 `references/baseline-scan.md`，完成耗时预估、已有规范读取、仓库类型识别和角色清单建立。

### Phase 0.5 — Lightweight Interface Map For Backend Repos

完成仓库类型识别后，如果运行形态是后端 RPC 服务、HTTP 服务或混合后端服务，调用 `/interface-index` 生成 `.vibe/interfaces/index.md`。

- RPC 后端优先基于 `.proto` service/rpc 定义建立轻量接口图谱：一个 proto 一个领域明细文件，总索引只列功能域。
- 非 RPC 后端基于 Controller / Route / Handler 入口建立轻量入口图谱。
- 非后端仓库跳过，并在最终结果中写明跳过原因。
- `/interface-index` 不下钻实现层、不验证接口语义；语义不清时标注 `unclear`，后续需求命中该功能域时再确认。

### Phase 1 — Parallel Exploration

执行前先读取 `references/parallel-exploration.md`，由主 Agent 同时调度：

- Structure And Module Map Agent：识别目录、模块边界、依赖方向和关键资源位置。
- 多个 Vertical Flow Agent：按功能点、功能模块或链路簇并行抽取完整端到端链路模板。
- Cross-Cutting Capability Agent：抽取公共能力、横切组件和可复用单点模板。

### Phase 2 — User Intent Checkpoint

进入强约束提炼前必须向用户确认：本次结果仅作为“知识储备”，还是继续提炼为会约束后续改代码的“强约束”。详细确认格式见 `references/draft-and-writeback.md`。

### Phase 3 — Hard Rules Extraction

仅当用户确认继续提炼为强约束时执行；只把多处样本支撑、仓库已有规范明确要求、或构建/测试/框架强制要求的内容升级为硬规则。

### Phase 4 — Repository-Specific Standards Draft

按 `references/draft-and-writeback.md` 生成仓库规范草案，覆盖项目结构、架构规则、命名放置、数据契约、异常、日志、测试、禁止模式和不一致写法。

### Phase 5 — Template Pack

按 `references/template-format.md` 和 `references/draft-and-writeback.md` 生成模板包；确认后写入 `.vibe/templates/` 并更新 `.vibe/index.md`。

## Document Writeback

默认输出位置、覆盖策略、已有模板合并策略和最终展示格式见 `references/draft-and-writeback.md`。所有写入必须先展示结果并经用户确认。

## Quality Checklist

提交结果前检查：

- 是否读取了已有规范文档
- 是否完成了仓库类型识别
- 后端仓库是否已调用 `/interface-index` 生成 `.vibe/interfaces/index.md` 总索引和 `.vibe/interfaces/domains/` 领域文件，或非后端仓库是否已记录跳过原因
- 是否并行启动了 3 个 Agent
- 是否由主 Agent 扁平调度多个垂直链路模板抽取 subAgent
- 是否没有让 subAgent 再 spawn subAgent
- 是否在强规则提炼前询问了用户意图
- 是否至少抽取了 3 条完整链路
- 是否每个模板都标注了来源文件
- 是否区分了完整链路模板和横向能力模板
- 是否只在用户选择强约束后才进行了强规则提炼
- 是否记录了仓库中的不一致写法
- 是否在用户确认前避免直接写入文档
- 是否将最终规范写回目标设置为 `AGENTS.md`
- 是否按规范格式生成了独立模板文件（flow-*.md / capability-*.md）
- 每个模板文件是否包含完整的 YAML frontmatter
- 模板文件名是否符合 `{type}-{name}.md` 规范
- 生成后是否自动调用了 `/templates-index` 更新索引

## 提示下一步

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PROJECT INIT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**仓库基线探索完成**

| 产出类型 | 路径 |
|---------|------|
| 仓库规范 | `AGENTS.md`（如用户确认写入） |
| 模板目录 | `.vibe/templates/` |
| 模板索引 | `.vibe/index.md` |
| 接口图谱 | `.vibe/interfaces/index.md`（总索引，后端仓库） |

**基线概要：**
- 仓库画像: {Repo Type}
- 完整链路模板: {N} 个
- 横向能力模板: {N} 个
- 接口图谱: {生成 / 跳过，原因}
- 规则候选: {N} 项

下一步建议：
  /domain-input    ← 补齐业务领域知识
  /prd-input ...   ← 进入具体需求
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 成功标准

- [ ] 已读取已有规范文档
- [ ] 已完成仓库类型识别
- [ ] 后端仓库已调用 `/interface-index` 生成 `.vibe/interfaces/index.md` 总索引和 `.vibe/interfaces/domains/` 领域文件，或非后端仓库已记录跳过原因
- [ ] 已并行启动至少 3 个 Agent
- [ ] 已由主 Agent 扁平调度多个垂直链路模板抽取 subAgent
- [ ] 未要求 subAgent 再 spawn subAgent
- [ ] 已在强规则提炼前询问用户意图
- [ ] 已至少抽取 3 条完整链路
- [ ] 每个模板都标注了来源文件
- [ ] 已区分完整链路模板和横向能力模板
- [ ] 只在用户选择强约束后才进行强规则提炼
- [ ] 已记录仓库中的不一致写法
- [ ] 在用户确认前未直接写入文档
- [ ] 最终规范写回目标设置为 `AGENTS.md`
- [ ] 模板文件符合 `{type}-{name}.md` 规范
- [ ] 生成后已自动调用 `/templates-index` 更新索引
