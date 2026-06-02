---
name: templates-index
description: >-
  重新生成 `.vibe/index.md`：扫描 `.vibe/templates/*.md`，解析 YAML front matter，
  校验必填字段，并产出 Markdown + JSONL 索引。适用于模板文件新增、修改或删除后，
  通常在 `project-init` 或 `archive` 技能运行后触发；也可通过 `/templates-index` 手动调用。
---

# Templates Index Generator

运行 `scripts/generate_index.py` 扫描 `.vibe/templates/` 目录，校验 frontmatter，生成 `.vibe/index.md`。

## Prerequisites

- Python 3.10+
- pyyaml（`pip install pyyaml`）

## Workflow

### Step 1 — 检查前置条件

1. 确认 `.vibe/templates/` 存在且包含 `.md` 文件
2. 确认 pyyaml 可用：`python3 -c "import yaml"`，缺失则 `pip install pyyaml`

### Step 2 — 运行脚本

```bash
python3 scripts/generate_index.py --templates-dir .vibe/templates --output .vibe/index.md
```

> `scripts/` 指本 Skill 目录下的 `scripts/` 文件夹，执行时需用完整路径。

**正常输出：**
```
📂 扫描到 11 个模板文件
✅ 全部校验通过

📝 索引已写入: .vibe/index.md
   - 总模板数: 11
   - Flow: 3
   - Capability: 8
```

### Step 3 — 处理失败

脚本以退出码 1 退出时表示失败，按错误类型处理：

| 错误信息 | 处理方式 |
|----------|---------|
| `ModuleNotFoundError: yaml` | `pip install pyyaml` 后重试 |
| `模板目录不存在` | 先运行 project-init 生成模板 |
| `未找到模板文件` | 确认 `.vibe/templates/` 下有 `.md` 文件 |
| 校验错误列表 | 根据错误修复对应模板文件的 frontmatter，然后重试 |

### Step 4 — 报告结果

脚本成功后输出摘要：

```
- Templates scanned: {N}
- Flow bundles: {N}
- Capabilities: {N}
- Index written to: .vibe/index.md
```

## Frontmatter Schema Reference

脚本校验的完整字段规范，供上游 Skill 生成模板时参考。

### 公共必填字段

| Field | Type | Constraint |
|-------|------|------------|
| `template_type` | string | `"flow"` \| `"capability"` |
| `name` | string | kebab-case，全局唯一 |
| `display_name` | string | 可读名称 |
| `source_files` | string[] | >= 1 |
| `tags` | string[] | — |
| `sample_count` | int | >= 1 |
| `created_at` | string | YYYY-MM-DD |

### Flow 专属

| Field | Type | Constraint |
|-------|------|------------|
| `trigger` | string | — |
| `use_when` | string | — |
| `avoid_when` | string | — |
| `layers` | string[] | >= 2 |

### Capability 专属

| Field | Type | Constraint |
|-------|------|------------|
| `purpose` | string | — |
| `typical_location` | string | — |
| `upstream` | string[] | — |
| `downstream` | string[] | — |

## 提示下一步

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TEMPLATES INDEX COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**模板索引已更新**

| 产出文件 | 路径 |
|---------|------|
| 模板索引 | `.vibe/index.md` |

**索引概要：**
- Templates scanned: {N}
- Flow bundles: {N}
- Capabilities: {N}

下一步建议：
  /project-init    ← 如需继续补模板
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 成功标准

- [ ] 已检查 `.vibe/templates/` 是否存在
- [ ] 已校验模板 frontmatter
- [ ] 已生成 `.vibe/index.md`
- [ ] 已输出模板数量摘要
