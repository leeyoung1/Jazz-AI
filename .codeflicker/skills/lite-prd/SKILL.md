---
name: lite-prd
description: >-
  Lite Flow（轻量流程）需求录入入口，等价 /prd-input --level L1 但免去档位询问。
  适用于改动 ≤5 文件、不跨服务、无新增接口的小需求：录入 PRD、轻量定位改动范围，
  产出精简 prd/context/scope_map 后直接进入 /lite-design。
---

# Lite PRD Input — 轻量需求录入

这是 **Lite Flow** 的第一步。命令本身已声明走轻量流程，无需再做复杂度档位判定与二次确认。

## 与 /prd-input 的关系

`/lite-prd` 等价于 `/prd-input --level L1`，区别只在：
- **跳过** prd-input 的 Phase 1.3 档位判定与 AskUserQuestion 二次确认（已确定走 L1）。
- 其余完全复用 prd-input 的 **L1（Lite Flow）分支**细则，详见 `../prd-input/SKILL.md` 及其 `references/`。

## 参数

`$ARGUMENTS` 格式：`<需求描述 或 PRD URL / 文件路径> [--name <项目名>]`
- 示例：`/lite-prd "为 OrderService.createOrder 加 traceId 日志" --name order-trace`
- `--name` 缺失时从描述中提取英文短标识。

## 执行步骤

1. **写档位标记**：在 `.prd/<PROJECT_NAME>/shared/level.json` 写入：
   ```json
   { "level": "L1", "auto_detected": false, "user_confirmed": true, "reason": "用户通过 /lite-prd 显式选择 Lite Flow" }
   ```
2. **录入 PRD**：按 prd-input Phase 1 获取并保存 `01-prd/prd.md`（URL 用可用的文档抓取方式下载，本地/文本直接保存）。
3. **轻量定位**（不起多 Agent 并行 DAG）：主 Agent 直接定位改动文件与可复用模板，产出：
   - `03-context/context.md`：改动点清单（精简）
   - `shared/scope_map.json`：只填 `affected_files` 与 `confirmed_interfaces`
4. **跳过**：`discovery.md`、`question_backlog.json`、`prd_summary.md`、`summary.jsonl`。
5. **接口锚定**：若存在 `.vibe/interfaces/index.md`，仍用总索引把功能点锚定到候选接口，写入 scope_map 的 `confirmed_interfaces`（供 /lite-design 二次确认）。

## 升档出口

录入后如果发现需求其实涉及**新增接口 / 跨服务 / 数据迁移 / 高风险**，应提示用户改走完整流程：把 `level.json` 的 `level` 改为 `L2`，改用 `/tech-design` → `/plan-task` → `/tdd`。

## 产物与下一步

必须产出（缺一不可，是 /lite-design 的前置依赖）：
- `.prd/<PROJECT_NAME>/01-prd/prd.md`
- `.prd/<PROJECT_NAME>/03-context/context.md`
- `.prd/<PROJECT_NAME>/shared/scope_map.json`
- `.prd/<PROJECT_NAME>/shared/level.json`

完成后提示：

```
下一步：/lite-design --project <PROJECT_NAME>
```
