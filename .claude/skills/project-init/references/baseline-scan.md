# Baseline Scan Reference

## Phase 0 — Baseline Scan

先检查仓库中的已有规则和工程形态。

**0.0 预估耗时提示**

在开始扫描前，根据仓库规模给出预估耗时，让用户有心理预期：

扫描仓库顶层目录和主要模块数量，粗略判断规模：

| 仓库规模 | 判断依据 | 预估耗时 |
|---------|---------|---------|
| 小型 | 文件总数 < 200，模块 ≤ 3 | 3-5 分钟 |
| 中型 | 文件总数 200-1000，模块 4-10 | 8-15 分钟 |
| 大型 | 文件总数 > 1000，或 monorepo / 多语言 | 20-40 分钟 |

向用户展示：
```
⏱ 预估耗时：{规模判断} 仓库，预计需要约 {N} 分钟完成全量扫描与模板提取。
   （耗时仅供参考，实际取决于代码复杂度）
```

然后继续执行后续步骤。

### 0.1 读取已有规范

优先查找：

- `AGENTS.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `.editorconfig`
- `checkstyle.xml`
- `.eslintrc*`
- `prettier.config.*`
- `pyproject.toml`
- `package.json`
- `pom.xml`
- `build.gradle*`
- `go.mod`
- `Cargo.toml`

如果仓库已有规范文档：

- 将其作为高优先级基线
- 后续代码探索用于补充模板、验证规范、标记未覆盖部分
- 不直接退出

### 0.2 识别仓库类型

识别以下信息：

- 主要语言
- 构建工具
- 仓库形态：单模块 / 多模块 / monorepo
- 运行形态：HTTP 服务 / RPC 服务 / 前端页面 / CLI / SDK / Job / Worker / 数据任务 / 基础设施仓库
- 测试组织方式
- 主要资源文件位置：SQL、Proto、Schema、配置、脚本、静态资源
- 后端接口图谱策略：Proto-domain map / Controller-entry map / 非后端跳过

输出一个仓库画像表：

| 维度 | 结果 |
|------|------|
| Repo Type | |
| Primary Languages | |
| Build System | |
| Runtime Shape | |
| Interface Map Strategy | |
| Existing Rule Docs | |
| Main Modules | |
| Test Layout | |

如果识别为 RPC 服务、HTTP 服务或混合后端服务，Baseline Scan 后必须进入 `/interface-index` 生成轻量接口图谱。RPC 仓库按“一 proto 一个功能域”输出总索引和领域文件；非后端仓库必须记录跳过原因。

### 0.3 建立角色清单

在仓库里查找这些角色对应的真实实现位置：

- 入口层：如 route、controller、rpc、command、handler、page、job entry
- 编排层：如 service、usecase、workflow、orchestrator、action
- 核心逻辑层：如 domain、processor、engine、business logic
- 集成层：如 repository、mapper、dao、gateway、client、api service
- 契约层：如 request、response、params、types、schema、entity、state、props
- 公共能力：如 config、utils、constants、enums、hooks、shared
- 测试层：unit、integration、e2e、fixtures、mocks

输出角色映射表：

| 角色 | 仓库中的实现 | 代表路径 |
|------|-------------|---------|
| 入口层 | | |
| 编排层 | | |
| 核心逻辑层 | | |
| 集成层 | | |
| 契约层 | | |
| 公共能力 | | |
| 测试层 | | |

如果某个角色不存在，填写“未形成稳定层”。
