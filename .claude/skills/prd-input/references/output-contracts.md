# 探索产物契约

## question_backlog.json

保存到 `.prd/<PROJECT_NAME>/shared/question_backlog.json`。

```text
{
  "project": "<PROJECT_NAME>",
  "generated_at": "<ISO时间>",
  "generated_by": "prd-input",
  "questions": [
    {
      "id": "Q001",
      "original_gap": "PRD 或探索中的缺口描述",
      "category": "product_gap / business_gap / engineering_gap / defer_to_context",
      "description": "重述为清晰问题",
      "owner": "pm / dev / codebase",
      "blocking_level": "high / medium / low",
      "ask_stage": "explore / tech-design",
      "status": "open / resolved / deferred / needs_clarification / partial / dropped",
      "resolution": "如已解决，记录答案和来源",
      "evidence": ["PRD章节", "文件路径#方法名"],
      "notes": "补充说明"
    }
  ]
}
```

## scope_map.json

保存到 `.prd/<PROJECT_NAME>/shared/scope_map.json`。

```text
{
  "project": "项目名",
  "generated_at": "ISO时间",
  "features": [
    {
      "name": "功能点名称",
      "priority": "核心/重要/辅助",
      "keywords": ["关键词1"],
      "located_modules": ["模块路径"],
      "located_files": ["文件路径"],
      "call_chains": ["入口 -> service -> dao/rpc"],
      "candidate_interface_domains": ["候选功能域ID"],
      "candidate_domain_files": [".vibe/interfaces/domains/example.md"],
      "related_template_matches": ["flow-query-read"],
      "confidence": "high/medium/low"
    }
  ],
  "template_matches": [
    {
      "template_name": "flow-query-read",
      "template_path": ".vibe/templates/flow-query-read.md",
      "applicable_features": ["功能点名称"],
      "reuse_strategy": "直接复用 / 差量复用 / 不适用",
      "delta_points": ["需要替换的业务插槽"],
      "evidence": ["文件路径#方法名"],
      "confidence": "high/medium/low"
    }
  ],
  "agent_runs": [
    {
      "agent_type": "vertical_feature / template_reuse / follow_up",
      "scope": "功能点或候选模板",
      "status": "completed/partial/blocked",
      "evidence_summary": "证据摘要",
      "follow_up_tasks": []
    }
  ]
}
```

## context.md

保存到 `.prd/<PROJECT_NAME>/03-context/context.md`，必须包含：

- 需求概要。
- 模板复用总览。
- 接口图谱命中总览：功能点关联哪些候选功能域、对应哪些 domain file。
- 逐功能点影响分析。
- 垂直/模板证据交叉校验结果。
- 整体依赖关系。
- 冲突与风险。
- 待确认项。
