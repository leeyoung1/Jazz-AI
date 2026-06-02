#!/usr/bin/env python3
"""
模板索引生成器 — 扫描 .vibe/templates/*.md，校验 frontmatter，生成 .vibe/index.md
用法: python generate_index.py [--templates-dir DIR] [--output FILE]
"""

import argparse
import json
import os
import re
import sys
from collections import OrderedDict
from datetime import datetime
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("缺少依赖: pip install pyyaml")

# ── 校验规则 ──────────────────────────────────────────────────────────────

COMMON_REQUIRED = [
    ("template_type", str),
    ("name", str),
    ("display_name", str),
    ("source_files", list),
    ("tags", list),
    ("sample_count", int),
    ("created_at", str),
]

FLOW_REQUIRED = [
    ("trigger", str),
    ("use_when", str),
    ("avoid_when", str),
    ("layers", list),
]

CAPABILITY_REQUIRED = [
    ("purpose", str),
    ("typical_location", str),
    ("upstream", list),
    ("downstream", list),
]

KEBAB_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ── Frontmatter 解析 ─────────────────────────────────────────────────────

def parse_frontmatter(text: str) -> dict | None:
    """从 markdown 文本中提取 YAML frontmatter"""
    if not text.startswith("---"):
        return None
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None
    return yaml.safe_load(parts[1])


# ── 校验 ─────────────────────────────────────────────────────────────────

def validate_template(fm: dict, filepath: str) -> list[dict]:
    """校验单个模板的 frontmatter，返回错误列表"""
    errors = []

    def _err(field: str, msg: str):
        errors.append({"file": filepath, "field": field, "error": msg})

    # 公共必填字段
    for field, expected_type in COMMON_REQUIRED:
        if field not in fm:
            _err(field, f"缺少必填字段 '{field}'")
        elif not isinstance(fm[field], expected_type):
            _err(field, f"'{field}' 类型应为 {expected_type.__name__}，实际为 {type(fm[field]).__name__}")

    ttype = fm.get("template_type")
    if ttype not in ("flow", "capability"):
        _err("template_type", f"template_type 必须是 'flow' 或 'capability'，实际为 '{ttype}'")
        return errors

    # 类型特定字段
    specific = FLOW_REQUIRED if ttype == "flow" else CAPABILITY_REQUIRED
    for field, expected_type in specific:
        if field not in fm:
            _err(field, f"{ttype} 模板缺少必填字段 '{field}'")
        elif not isinstance(fm[field], expected_type):
            _err(field, f"'{field}' 类型应为 {expected_type.__name__}")

    # name: kebab-case
    name = fm.get("name", "")
    if isinstance(name, str) and name and not KEBAB_RE.match(name):
        _err("name", f"name '{name}' 不符合 kebab-case 格式")

    # source_files 至少 1 个
    sf = fm.get("source_files")
    if isinstance(sf, list) and len(sf) < 1:
        _err("source_files", "source_files 至少需要 1 个路径")

    # layers 至少 2 个（flow）
    if ttype == "flow":
        layers = fm.get("layers")
        if isinstance(layers, list) and len(layers) < 2:
            _err("layers", "flow 模板的 layers 至少需要 2 层")

    # created_at 日期格式
    ca = fm.get("created_at")
    if isinstance(ca, str) and not DATE_RE.match(ca):
        # pyyaml 会把 YYYY-MM-DD 自动解析为 datetime.date
        _err("created_at", f"created_at '{ca}' 不符合 YYYY-MM-DD 格式")
    elif hasattr(ca, "isoformat"):
        fm["created_at"] = ca.isoformat()

    return errors


# ── Markdown 生成 ─────────────────────────────────────────────────────────

LAYER_ABBR = {
    "entry": "entry",
    "orchestration": "orch",
    "core-logic": "core",
    "integration": "integ",
}


def _abbr_layers(layers: list[str]) -> str:
    return "→".join(LAYER_ABBR.get(l, l) for l in layers)


def _flow_row(t: dict) -> str:
    name = t["name"]
    filename = t["_file"]
    trigger = t.get("trigger", "")
    use_when = t.get("use_when", "")
    avoid_when = t.get("avoid_when", "")
    layers = _abbr_layers(t.get("layers", []))
    tags = ",".join(t.get("tags", []))
    samples = t.get("sample_count", 0)
    return f"| [{name}]({filename}) | {trigger} | {use_when} | {avoid_when} | {layers} | {tags} | {samples} |"


def _cap_row(t: dict) -> str:
    name = t["name"]
    filename = t["_file"]
    purpose = t.get("purpose", "")
    location = t.get("typical_location", "")
    upstream = ",".join(t.get("upstream", []))
    downstream = ",".join(t.get("downstream", []))
    tags = ",".join(t.get("tags", []))
    samples = t.get("sample_count", 0)
    return f"| [{name}]({filename}) | {purpose} | {location} | {upstream} | {downstream} | {tags} | {samples} |"


def _jsonl_entry(t: dict) -> str:
    """生成一行紧凑 JSONL，字段顺序固定"""
    ttype = t["template_type"]
    od = OrderedDict()
    od["template_type"] = ttype
    od["name"] = t["name"]
    od["display_name"] = t["display_name"]
    if ttype == "flow":
        for k in ("trigger", "use_when", "avoid_when", "layers"):
            od[k] = t.get(k)
    else:
        for k in ("purpose", "typical_location", "upstream", "downstream"):
            od[k] = t.get(k)
    od["source_files"] = t.get("source_files", [])
    od["tags"] = t.get("tags", [])
    od["sample_count"] = t.get("sample_count", 0)
    od["file"] = t["_file"]
    return json.dumps(od, ensure_ascii=False, separators=(",", ":"))


def generate_index_content(templates: list[dict]) -> str:
    flows = sorted([t for t in templates if t["template_type"] == "flow"], key=lambda x: x["name"])
    caps = sorted([t for t in templates if t["template_type"] == "capability"], key=lambda x: x["name"])

    total = len(templates)
    flow_count = len(flows)
    cap_count = len(caps)
    avg_samples = round(sum(t.get("sample_count", 0) for t in templates) / total, 1) if total else 0

    today = datetime.now().strftime("%Y-%m-%d")

    lines = [
        "# Code Templates Index",
        "",
        f"> AUTO-GENERATED by templates-index. DO NOT EDIT MANUALLY.",
        f"> Last updated: {today}",
        f"> Template count: {total}",
        "",
    ]

    # Flow 表格
    if flows:
        lines += [
            "## Flow Bundle Templates",
            "",
            "| Name | Trigger | Use When | Avoid When | Layers | Tags | Samples |",
            "|------|---------|----------|------------|--------|------|---------|",
        ]
        lines += [_flow_row(t) for t in flows]
        lines.append("")

    # Capability 表格
    if caps:
        lines += [
            "## Capability Templates",
            "",
            "| Name | Purpose | Location | Upstream | Downstream | Tags | Samples |",
            "|------|---------|----------|----------|------------|------|---------|",
        ]
        lines += [_cap_row(t) for t in caps]
        lines.append("")

    # 统计
    lines += [
        "## Statistics",
        "",
        f"- Total templates: {total}",
        f"- Flow templates: {flow_count}",
        f"- Capability templates: {cap_count}",
        f"- Average samples per template: {avg_samples}",
        "",
    ]

    # JSONL 块
    jsonl_lines = [_jsonl_entry(t) for t in (flows + caps)]
    lines.append("<!-- JSONL_START")
    lines += jsonl_lines
    lines.append("JSONL_END -->")
    lines.append("")

    return "\n".join(lines)


# ── 主流程 ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="生成 .vibe/index.md 模板索引")
    parser.add_argument("--templates-dir", default=".vibe/templates",
                        help="模板目录路径 (默认: .vibe/templates)")
    parser.add_argument("--output", default=".vibe/index.md",
                        help="输出文件路径 (默认: .vibe/index.md)")
    args = parser.parse_args()

    tpl_dir = Path(args.templates_dir)
    output = Path(args.output)

    # Phase 1: 扫描
    if not tpl_dir.is_dir():
        sys.exit(f"❌ 模板目录不存在: {tpl_dir}")

    md_files = sorted(tpl_dir.glob("*.md"))
    if not md_files:
        sys.exit(f"❌ 未找到模板文件: {tpl_dir}/*.md")

    print(f"📂 扫描到 {len(md_files)} 个模板文件")

    # Phase 2: 解析 + 校验
    templates = []
    all_errors = []
    seen_names = set()

    for fp in md_files:
        text = fp.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        if fm is None:
            all_errors.append({"file": str(fp), "field": "frontmatter", "error": "无法解析 YAML frontmatter"})
            continue

        errs = validate_template(fm, str(fp))
        all_errors.extend(errs)

        name = fm.get("name", "")
        if name in seen_names:
            all_errors.append({"file": str(fp), "field": "name", "error": f"name '{name}' 重复"})
        seen_names.add(name)

        # 记录相对路径，供索引引用
        fm["_file"] = f"templates/{fp.name}"
        templates.append(fm)

    if all_errors:
        print(f"\n❌ 校验发现 {len(all_errors)} 个错误:\n", file=sys.stderr)
        for e in all_errors:
            print(f"  [{e['file']}] {e['field']}: {e['error']}", file=sys.stderr)
        sys.exit(1)

    print(f"✅ 全部校验通过")

    # Phase 3 + 4: 生成 + 写入
    content = generate_index_content(templates)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")

    flow_count = sum(1 for t in templates if t["template_type"] == "flow")
    cap_count = len(templates) - flow_count

    print(f"\n📝 索引已写入: {output}")
    print(f"   - 总模板数: {len(templates)}")
    print(f"   - Flow: {flow_count}")
    print(f"   - Capability: {cap_count}")


if __name__ == "__main__":
    main()
