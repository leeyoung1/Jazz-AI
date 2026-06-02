---
name: context-explore
description: >-
  兼容别名。综合探索已合并到 `/explore`，本技能仅用于兼容旧调用。
  执行时应遵循 `/explore` 技能的完整工作流与产出。
---

# Context Explore — 兼容别名

`/context-explore` 已并入 `/explore`。

执行要求：

- 读取并遵循 [`.codeflicker/skills/explore/SKILL.md`](../explore/SKILL.md)
- 保持原有上下文探索产物路径不变：
  - `.prd/{PROJECT_NAME}/03-context/context.md`
  - `.prd/{PROJECT_NAME}/shared/scope_map.json`
- 如果缺少业务探索产物，也在同一次 `/explore` 中先补齐业务探索

## 提示下一步

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CONTEXT EXPLORE ALIASED TO EXPLORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**请改用统一命令**

下一步建议：
  /explore --project {PROJECT_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 成功标准

- [ ] 已明确 `/context-explore` 为兼容别名
- [ ] 实际执行逻辑已切换为 `explore`
- [ ] 原有上下文探索产物路径保持不变
