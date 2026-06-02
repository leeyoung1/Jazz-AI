# PRD 提取细则

## 输入模式

- URL：必须先用可用的文档抓取方式（浏览器、`curl`/`wget` 或粘贴正文）保存到 `.prd/<PROJECT_NAME>/01-prd/prd-source.md`，再读取本地文件。
- 本地文件：直接读取文件内容作为 PRD 原文。
- 直接文本：将参数拼接为需求描述，并整理成 PRD 文档。

## 图片识别

URL 模式下载后的 PRD 如果包含 `![...](...)` 图片引用，必须读取本地图片文件；如果原始图片 URL 需要登录态，直接访问可能失败。

按图片类型提取信息：

- 流程图 / 时序图：步骤、角色、分支、异常路径。
- 原型图 / UI 截图：页面元素、交互逻辑、字段信息。
- 状态机图：状态节点、流转条件。
- 架构图 / 数据流图：系统边界、外部依赖。
- 表格 / 数据图：字段定义、约束。

图片提取的信息标注 `[来源：图片 {文件名}]`；无法识别时标注 `[待确认：图片内容不清晰，请人工补充说明]`。

## PRD 原文产物

保存到 `.prd/<PROJECT_NAME>/01-prd/prd.md`，头部包含：

```markdown
---
source_type: <url | file | text>
source_url: <URL，仅 URL 模式>
source_file: <文件路径，仅文件模式>
fetched_at: <当前时间 ISO 格式>
title: <PRD 标题或需求描述>
---

<PRD 原文内容>
```

## 摘要维度

`prd_summary.md` 必须覆盖：

- 产品定位：一句话描述、目标用户、核心场景。
- 核心功能点：功能名称、类型、描述、验收标准。
- 用户流程：主流程、异常流程；推导内容标注 `[推导]`。
- 业务规则与约束：明确规则、技术约束、外部依赖。
- 数据模型线索：实体、字段；推导内容标注 `[推导]`。
- 待探索项：只分类，不在提取阶段提问。

缺口分类：

| 分类 | 标签 | 推荐处理阶段 |
|------|------|--------------|
| 产品语义缺口 | `product_gap` | explore |
| 业务规则缺口 | `business_gap` | explore |
| 工程实现缺口 | `engineering_gap` | explore |
| 需代码验证 | `defer_to_context` | explore |

## 结构化摘要 JSONL

保存到 `.prd/<PROJECT_NAME>/01-prd/summary.jsonl`，每行一个 JSON 对象：

```text
{"type":"project_meta","project":"项目名","prd_title":"PRD标题","source_url":"原文链接","generated_at":"生成时间"}
{"type":"feature","name":"功能名","priority":"核心/重要/辅助","description":"描述","acceptance_criteria":["标准1"]}
{"type":"user_flow","description":"流程描述","steps":["步骤1"]}
{"type":"business_rule","rule":"规则描述","constraint_type":"业务规则/技术约束/外部依赖"}
{"type":"data_model","entity":"实体名","key_fields":["字段1"],"inferred":true}
{"type":"gap","description":"缺口描述","category":"product_gap/business_gap/engineering_gap/defer_to_context","source_feature":"功能点","suggested_stage":"explore","status":"open"}
```
