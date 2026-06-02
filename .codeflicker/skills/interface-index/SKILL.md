---
name: interface-index
description: >-
  为后端仓库生成轻量接口图谱。适用于项目初始化、刷新接口资产、后端 RPC/proto
  功能域盘点，或需要重新生成 `.vibe/interfaces/index.md` 和领域文件时。
---

# Interface Map

生成轻量接口图谱，不做接口审计。目标是让后续阶段先看到“有哪些功能域、每个领域大概有哪些 RPC 能力”，而不是把每个接口下钻成完整语义分析。

## Working Rules

- 只做轻量扫描和高层归纳，不读取实现层、不验证接口语义、不追调用链。
- RPC 仓库只扫描 `.proto`。一个 proto 文件默认视为一个功能域。
- 对每个 proto 生成一个领域明细文件，描述该 proto 中 service/rpc 大概做什么。
- 生成一个总索引：`.vibe/interfaces/index.md`。后续 hooks 只需要注入这个总索引。
- 总索引只列功能域、领域明细文件和功能域摘要，作为导航入口；不要在总索引中列代表接口。
- 领域明细文件放在 `.vibe/interfaces/domains/{proto-name}.md`。
- 语义判断只基于 proto 文件名、package、service 名、rpc 方法名和注释；不要为了提高置信度去下钻源码。
- 最终图谱必须简洁：接口明细只保留“接口名称 / 功能点 / 大致用途”。不要输出 request、response、字段、source line、evidence、confidence、长注释或调用链。
- 不要求严格分类确认；不懂的地方用 `unknown`、`unclear` 或“需结合需求时再确认”标注即可。
- 如果没有 proto 文件，可以降级扫描 Controller / Route / Handler，但仍保持轻量：按入口文件聚合为功能域，不做方法级深挖。

## Output Shape

写入 `.vibe/interfaces/index.md` 或 `.vibe/interfaces/domains/*.md` 前，读取 `references/output-format.md`，严格按其中模板输出。模板必须放在 reference 文件中维护，不要在本 SKILL.md 内复制或发散出新格式。

## Workflow

### Phase 1 — Detect Shape

1. 查找 `.proto` 文件。
2. 如果存在包含 `service`/`rpc` 的 proto，使用 RPC proto map。
3. 如果没有 proto，再轻量查找 Controller / Route / Handler 入口。
4. 如果不是后端仓库，写明跳过原因，不生成接口图谱。

### Phase 2 — Extract Proto RPCs

优先使用脚本做确定性提取：

```sh
node .codeflicker/skills/interface-index/scripts/extract-rpc-interfaces.mjs \
  --root . \
  --format domains
```

脚本只提取 proto 元数据，不做语义分类、不做覆盖率验证、不读取实现层。需要指定 proto 目录时：

```sh
node .codeflicker/skills/interface-index/scripts/extract-rpc-interfaces.mjs \
  --root . \
  --proto-dir path/to/proto \
  --format domains
```

`domains` 输出按 proto 聚合，只包含 source、package、service 名和 method 名，不包含 request/response。脚本只支持 `domains` 和 `summary`，避免误用 raw 接口详情导致上下文膨胀。

### Phase 3 — Build Domain Files

按 `source` 聚合，一份 proto 生成一个 domain file：

- `domain`：从 proto 文件名、package 或 service 名生成可读功能域名称。
- `domain purpose`：从文件名、package、service 名和 rpc 名推断，控制在一句话。
- 接口明细表只保留接口名称、功能点、大致用途三列。
- RPC 过多时不要全量解释长段文字，只保留简洁表格。

### Phase 4 — Build Total Index

总索引必须短，适合 hooks 注入：

- 优先控制在 200 行以内。
- 每个 domain 一行。
- 不放完整 RPC 大表，不放代表接口，只放 domain、domain purpose 和 domain file 链接。
- 不放 request/response。
- 明确写“需要细节时再打开 domain file”。

### Phase 5 — Final Report

完成后展示：

```text
Interface map complete

- Total index: .vibe/interfaces/index.md
- Domain files: .vibe/interfaces/domains/
- Domains: {N}
- Injection: 后续默认只注入总索引；命中特定功能域时再读取领域文件。
```

## Success Criteria

- [ ] 输出 `.vibe/interfaces/index.md` 总索引。
- [ ] RPC 仓库按“一 proto 一领域文件”输出 `.vibe/interfaces/domains/*.md`。
- [ ] 未读取实现层，未追调用链，未做接口语义验证。
- [ ] 总索引只包含功能域、大致用途和领域文件路径，不包含代表接口。
- [ ] 领域文件中的接口明细只包含接口名称、功能点、大致用途，不包含 request/response。
- [ ] 下游阶段默认只需要注入总索引。
