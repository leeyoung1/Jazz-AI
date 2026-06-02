# Interface Map Output Format

## File Layout

```text
.vibe/interfaces/
├── index.md                 # 总索引，hooks 默认注入
└── domains/
    ├── {proto-name}.md       # 一个 proto 一个领域文件
    └── {controller-name}.md  # 非 RPC 降级时，一个入口文件一个领域文件
```

## Total Index: `.vibe/interfaces/index.md`

总索引只做功能域导航，不放接口清单、代表接口、request、response、字段、证据或调用链。

```markdown
# Interface Map

## Repository Interface Profile

- Scan date: {YYYY-MM-DD}
- Shape: RPC proto map / Controller map / Mixed / Skipped
- Total domains: {N}
- Injection guidance: 后续阶段默认只注入本总索引；需要某个功能域细节时再读取对应 domain file。

## Domain Index

| Domain | Domain File | Domain Purpose |
|--------|-------------|----------------|
| 投放活动 | .vibe/interfaces/domains/activity.md | 投放活动创建、查询和管理相关能力 |

## Usage Guidance

- `/prd-input` 和 `/explore`：用本索引把功能点锚定到候选功能域和 domain file。
- `/tech-design`：如需求涉及接口变更，再读取相关 domain file，判断参考接口、修改接口或新增接口。
- `/plan-task` 和 `/tdd`：继承技术方案中已确认的接口边界，不重新展开全量接口图谱。
```

## Domain File

领域文件可以列接口，但仍然保持简洁。接口明细只保留接口名称、功能点、大致用途三列。

```markdown
# {Domain Name}

## Domain Summary

{用 1-3 句话说明该 proto 大概负责什么。只基于 proto 名称、service/rpc 名称和注释推断。}

## Interfaces

| Interface | Function Point | Approx Purpose |
|-----------|----------------|----------------|
| ActivityService.QueryActivity | 活动查询 | 查询投放活动详情或列表 |

## Notes

- 这里是轻量图谱，不代表最终接口设计结论。
- 若某个 RPC 语义不清，标注 `unclear`，后续只有需求实际命中该接口时再确认。
```
