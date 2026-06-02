---
name: biz-discovery
description: >-
  兼容别名。综合探索已合并到 `/explore`，本技能仅用于兼容旧调用。
  执行时应遵循 `/explore` 技能的完整工作流与产出。
---

# Biz Discovery — 兼容别名

`/biz-discovery` 已并入 `/explore`。

执行要求：

- 读取并遵循 [`.claude/skills/explore/SKILL.md`](../explore/SKILL.md)
- 保持原有业务探索产物路径不变：
  - `.prd/{PROJECT_NAME}/02-biz/discovery.md`
  - `.prd/{PROJECT_NAME}/shared/question_backlog.json`
- 如果本次调用原本期望继续进入代码探索，也直接在同一次 `/explore` 中完成

## 提示下一步

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 BIZ DISCOVERY ALIASED TO EXPLORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**请改用统一命令**

下一步建议：
  /explore --project {PROJECT_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 成功标准

- [ ] 已明确 `/biz-discovery` 为兼容别名
- [ ] 实际执行逻辑已切换为 `explore`
- [ ] 原有业务探索产物路径保持不变
