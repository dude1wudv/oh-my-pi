# omp v20.1.2

发布日期：2026-08-15

## 版本定位

本版本完成 Plan 阶段 canonical 路由切换：计划从首次草拟开始就直接落在当前项目的 `.omp/plans/`，批准、执行、压缩恢复、ACP 与子 agent handoff 始终引用同一个项目文件。同时继续沿用 `@dude1wudv/*` 个人 npm scope 和 Windows 本地发行链路。

## v20.1.2 详细更新

### 项目级 canonical 计划

- Plan 模式直接创建 `.omp/plans/YYYY-MM-DD-<slug>.md`；日期在首次进入 Plan 阶段时固定，slug 复用现有标题规范化规则。
- 同日同名冲突使用第一个可用的 `-2`、`-3` 后缀，采用独占创建，绝不静默覆盖已有计划。
- 计划首个版本状态为 `planned`；批准时原子更新同一文件为 `executing`，不再导出第二份 session-local canonical 副本。
- 旧 session 的非空 `local://` 计划在批准前一次性迁移到项目目录；旧文件保留，执行引用切换到迁移后的项目相对路径。

### 路径安全与编辑体验

- Plan 模式仅放行 `.omp/plans/` 下的 Markdown 计划和非 canonical 的 `local://` scratch；普通 working tree 继续只读。
- 拒绝绝对路径、其它 scheme、`..` 穿越、symlink 越界、删除和移动/重命名。
- 首次写入按需创建 `.omp/plans`；ACP/editor bridge 对项目计划保持正常编辑器可见写入，磁盘回读内容仍是批准依据。
- `read` 和 hashline 恢复在模型遗漏 `.omp/plans/` 前缀时只可绑定当前 active project plan，不会恢复到其它 working-tree 文件。

### 批准与执行生命周期

- Interactive、ACP、plan-yolo、fresh-session、compaction 和 subagent handoff 全部携带固定项目相对路径。
- fresh-session 继续复制其它 local scratch artifacts，但不再复制 canonical 计划。
- 状态更新或 legacy 迁移失败时保持 Plan 模式，并返回具体文件错误。
- compaction/prune 持续保护当前项目计划的 `read` 结果；批准后的首条执行提示要求直接读取同一文件。

### Agent 模型边界

- `scout` 保持 `model: "@smol"`，thinking level 从 `medium` 提升为 `high`。
- Plan 模式 generic `task` preflight 使用固定错误拒绝：`Plan mode exploration requires the read-only scout agent; generic task workers are available after plan approval.`
- 批准后默认 task worker 继续解析到 `@task`，`AUTO_THINKING` 和默认关闭的 prewalk 行为不变。

### 验证

- canonical 路由、迁移、写保护、handoff、compaction 和 agent 边界套件：95 tests passed。
- interactive/ACP/fresh-session/hashline 套件：186 tests passed，1 个仅 Windows 跳过的 POSIX editor-script test。
- Interactive、ACP 与 plan-yolo 生命周期组合：135 tests passed，1 skipped。

## v20.1.1 详细更新

发布日期：2026-08-15

- 修复 asynchronous task batch wakeup：批量 task delivery 继续由 result barrier 驱动，不会因部分结果提前唤醒 Main。
- 补齐 project-plan runtime 基础设施：状态字段、项目路径解析、plan 文件扫描、interactive/ACP/plan-yolo 引用、handoff、compaction 保护和 recovery plumbing。
- 保持 20.1.0 的个人 npm scope、Windows binary 和 GitHub Packages 发布拓扑。

## v20.1.0 详细更新

发布日期：2026-08-14

- 将公开包迁移到 `@dude1wudv/*`，同步 workspace catalog、包内依赖、exports 和原生模块依赖，避免覆盖上游 npm 包。
- 发布包提供编译后的 TypeScript declarations 和 JavaScript 产物；npm 消费者不依赖仓库源码布局。
- 新增 Windows x64 native leaf package 与 `omp.exe` release workflow，支持 Windows 本地安装和更新。
- 增加 npm tarball manifest 检查、Windows 路径兼容、OTP 发布参数、GitHub Packages 发布和 release asset 重试/复用。
- 明确 delegated review validation ownership，并补充 npm 安装、更新、SDK、provider、工具和扩展文档。

## 发布产物

- npm：`@dude1wudv/*` workspace packages，版本 `20.1.2`。
- GitHub Release：`v20.1.2`，包含本说明与构建产物。
- Windows 本地：使用本次源码构建的 `omp.exe` 替换当前安装，`omp --version` 应返回 `omp/20.1.2`。

## 上游

- 上游仓库：<https://github.com/can1357/oh-my-pi>
- 本发行版：<https://github.com/dude1wudv/oh-my-pi>
