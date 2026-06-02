---
name: archive
description: >-
  需求完成后的归档与知识沉淀。生成归档摘要，提炼新业务规则和新代码模板，反向更新 `AGENTS.md` 和模板库，保障知识库持续进化。
  适用于 TDD 与最终编译通过后、需求开发完成且需要沉淀知识时。
  不适用于编译未通过、需求进行中或极小改动。
---

# Archive — 归档与知识沉淀

需求开发完成并验证通过后，在产出物原位生成归档摘要，提炼新业务规则和代码模板，反向更新 Day0 的知识基线。

## Working Rules

- 归档前确认 TDD 执行报告的 `compile_gate=passed` 且 `ready_for_delivery=true`
- 所有知识更新必须经过人工确认后才写入
- 产出物保留在 `.prd/{name}/` 原位，不移动、不复制
- 模板提取标准与 Day0 一致：至少 2-3 个样本支撑才能提炼模板
- 不确定的新规则标注 `[待观察]`，不写入 AGENTS.md
- 归档是整个工作流的最后一个阶段

## 参数

调用时传入参数：

- `$ARGUMENTS` 格式：`--project <项目名> [--skip-knowledge]`
  - `--project`：项目标识名（必填），对应 `.prd/{name}/` 目录
  - `--skip-knowledge`：跳过知识沉淀，只做归档索引（可选）
- 示例：
  - `/archive --project user-growth`（完整归档 + 知识沉淀）
  - `/archive --project user-growth --skip-knowledge`（只归档不沉淀）

## 工作流

### Phase 1：归档前检查

执行前读取 `references/archive-summary.md`，确认 `.prd/{name}/06-execution/execution_report.md` 的 `compile_gate=passed`、`ready_for_delivery=true` 状态、关键产物完整性和归档目标路径。编译未通过时不得归档，除非用户明确使用允许跳过的参数。

### Phase 2：生成归档摘要与索引

按 `references/archive-summary.md` 生成 `.prd/{name}/07-archive/archive.md`，并更新 `.archive/index.md`。

### Phase 3：知识沉淀（除非 --skip-knowledge）

按 `references/knowledge-extraction.md` 提炼新业务规则、新代码模式、AGENTS.md 更新候选和 domain.md 更新候选。

### Phase 4：人工确认更新

按 `references/confirmation-writeback.md` 展示更新摘要并逐项确认；用户确认前不得写入 `.vibe/domain.md`、`.vibe/templates/` 或 `AGENTS.md`。

### Phase 5：执行确认后的写入

仅写入用户确认的知识更新；新增模板后自动调用 `/templates-index` 更新 `.vibe/index.md`。详细写入规则见 `references/confirmation-writeback.md`。

## 提示下一步

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ARCHIVE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**{项目名} — 已归档**

| 动作 | 详情 |
|------|------|
| 归档摘要 | `.prd/{name}/07-archive/archive.md` 已生成 |
| 全局索引 | `.archive/index.md` 已更新 |
| 新业务规则 | {N} 条写入 domain.md / {N} 条跳过 |
| 新代码模板 | {N} 个写入 / {N} 个待观察 |
| AGENTS.md 更新 | {N} 项（工程规则） |
| domain.md 更新 | {N} 项（业务规则/术语/流程） |
| 模板 Index 更新 | {N} 条新增（已自动调用 /templates-index 更新 .vibe/index.md） |

下一步建议：
  如有新需求，重新从 /prd-input 开始
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 成功标准

- [ ] TDD 执行报告 `compile_gate=passed`、`ready_for_delivery=true` 已确认
- [ ] 归档摘要 `.prd/{name}/07-archive/archive.md` 已生成（含产出物索引链接）
- [ ] 全局归档索引 `.archive/index.md` 已更新
- [ ] 新业务规则已提炼并展示给用户
- [ ] 新代码模板已提取（符合 Day0 格式标准）
- [ ] AGENTS.md 更新候选已识别（工程规则）
- [ ] domain.md 更新候选已识别（业务规则/术语/流程）
- [ ] 所有更新经过人工确认后才写入
- [ ] 模板 Index 已同步更新
- [ ] 归档是完整的闭环操作
