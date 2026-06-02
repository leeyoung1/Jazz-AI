# Template File Format Reference

本文档定义模板文件的命名规范、YAML Frontmatter 格式和校验规则。

## Template File Structure

模板文件采用以下命名规范：`{type}-{name}.md`

- `type`: `flow` (Flow Bundle Template) 或 `capability` (Capability Template)
- `name`: 小写、短横线分隔、语义化（如 `read-query`, `persistence`）

每个模板文件必须包含 YAML Frontmatter 开头：

### Flow Bundle Template Frontmatter

```yaml
---
template_type: flow
name: read-query-flow              # 唯一标识，kebab-case
display_name: 读取查询链路          # 人类可读名称
trigger: HTTP Request              # 触发方式
use_when: 读取查询类接口             # 适用场景（单行摘要）
avoid_when: 写入变更/异步消费         # 不适用场景（单行摘要）
layers:                            # 涉及的分层（有序）
  - entry
  - orchestration
  - core-logic
  - integration
source_files:                      # 提取来源（真实代码路径）
  - src/controller/XxxController.java
  - src/service/XxxService.java
  - src/repository/XxxRepository.java
tags:                              # 标签（用于搜索匹配）
  - query
  - read
  - http
sample_count: 3                    # 样本数量
created_at: 2025-04-08             # 生成日期 (YYYY-MM-DD)
---
```

Body 部分继续使用原有的 Flow Bundle Template 结构：
- Entry Template
- Orchestration Template
- Core Logic Template
- Integration / Persistence Template
- Fixed Steps
- Replaceable Steps
- Error Handling
- Logging / Metrics
- Test Template
- Source Files

### Capability Template Frontmatter

```yaml
---
template_type: capability
name: persistence                  # 唯一标识，kebab-case
display_name: 持久化                # 人类可读名称
purpose: 数据库读写操作              # 用途
typical_location: repository/dao 层 # 典型位置
upstream:                          # 上游调用方
  - service
  - orchestration
downstream:                        # 下游依赖
  - database
  - cache
source_files:                      # 提取来源
  - src/repository/XxxRepository.java
tags:
  - persistence
  - dao
sample_count: 2
created_at: 2025-04-08
---
```

Body 部分继续使用原有的 Capability Template 结构：
- Setup Template
- Execution Template
- Result Handling Template
- Error Pattern
- Observability Pattern
- Test Template
- Common Variants
- Source Files

## Template Validation Rules

每个模板文件必须通过以下校验：
- `template_type` 必须是 `flow` 或 `capability`
- `name` 必填且唯一（不能与其他模板重复）
- `source_files` 必填且至少包含 1 个真实代码路径
- `sample_count` 必填且 >= 1
- Flow 类型必须包含 `layers` 字段（至少 2 层）
- Capability 类型必须包含 `upstream` 和 `downstream` 字段
