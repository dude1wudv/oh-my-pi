# omp v20.1.0

发布日期：2026-08-14

## 版本定位

这是基于上游 `can1357/oh-my-pi` 的个人发行版。版本号从本项目的 `v17.3.5` 重新计数，本次发布使用 `v20.1.0`，不沿用上游版本号。

## 与上游的主要差异

- **个人 npm scope**：将公开包迁移到 `@dude1wudv/*`，避免覆盖或依赖上游 npm 包；包内依赖、workspace catalog、exports 和原生模块依赖同步切换。
- **npm 发布产物**：发布包提供编译后的 TypeScript 声明文件和 JavaScript 产物，调整 `exports` 与 `files`，使 Node/npm 消费者不依赖仓库源码布局；原生包补充平台可选依赖。
- **Windows 发布链路**：新增 Windows release workflow，构建并发布 Windows x64 native leaf 包，随后构建 Windows `omp.exe`，并支持本地安装与更新。
- **发布可靠性**：增加 npm tarball manifest 检查、Windows 路径兼容、OTP 发布参数支持，以及无 Cargo 环境下的 release 检查容错。
- **工作流与协作**：保留并扩展本地 task orchestration、delegated review validation ownership、状态指标和 Windows 本地开发流程。
- **文档与安装**：更新安装、npm 更新、原生模块、SDK、provider、工具和扩展相关说明，明确个人 scope 包的安装方式。

## 已发布 npm 包

本版本已发布 `@dude1wudv` scope 下的运行时、AI、catalog、agent、coding-agent、natives、TUI、wire、utils、omptype、hashline、mnemopi、snapcompact、stats 等包及 Windows x64 native leaf 包，版本均为 `20.1.0`。

## 本地构建

Windows 本地 `omp.exe` 已由本版本构建并替换，运行 `omp --version` 返回 `omp/20.1.0`。

## 上游

- 上游仓库：<https://github.com/can1357/oh-my-pi>
- 本发行版：<https://github.com/dude1wudv/oh-my-pi>
