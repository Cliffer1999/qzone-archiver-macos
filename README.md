<div align="center">

# 🍎 QZone Archiver for macOS

### 删掉的 QQ 空间说说，也许还能找回来。

**免费 · 开源 · 本地运行 · Apple Silicon 原生支持**

通过仍然存在的点赞、评论等互动记录，尝试恢复已经删除的 QQ 空间说说；同时把说说、日志、相册、视频、留言等内容完整备份到 Mac 本地。

[![macOS](https://img.shields.io/badge/macOS-12%2B-black?logo=apple)](https://github.com/Cliffer1999/qzone-archiver-macos/releases)
[![Apple Silicon](https://img.shields.io/badge/Apple%20Silicon-M1%20%2F%20M2%20%2F%20M3%20%2F%20M4-black?logo=apple)](https://github.com/Cliffer1999/qzone-archiver-macos/releases)
[![Intel Mac](https://img.shields.io/badge/Intel%20Mac-supported-blue)](https://github.com/Cliffer1999/qzone-archiver-macos/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![Build](https://github.com/Cliffer1999/qzone-archiver-macos/actions/workflows/build-and-release.yml/badge.svg)](https://github.com/Cliffer1999/qzone-archiver-macos/actions/workflows/build-and-release.yml)

## **[⬇️ 下载 macOS 版本](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest)**

**M1 / M2 / M3 / M4 用户下载 `arm64.dmg`**  
Intel Mac 用户下载 `x64.dmg`

</div>

---

## ✨ 它最特别的地方

很多人以为 QQ 空间说说删除以后就彻底消失了。

实际上，如果那条说说曾经留下过 **点赞、评论、回复等互动记录**，QQ 空间的相关互动数据中有时仍然保留着可用于重建的信息。

QZone Archiver 会尝试从这些残留互动记录里找回能够恢复的历史说说。

> **不是“万能恢复”。** 没有任何互动痕迹、服务器端也不再保留数据的内容无法凭空恢复。但如果旧说说曾经有人点赞或评论，非常值得试一次。

### 一个你可能会遇到的场景

```text
2014 年发了一条说说
       ↓
几年后自己删除了
       ↓
当年朋友点过赞 / 留过评论
       ↓
互动通知仍有残留记录
       ↓
QZone Archiver 尝试重建这条已删除说说
```

---

## 🚀 不只是恢复说说

| 功能 | 支持 |
| --- | :---: |
| 已删除说说恢复（存在互动记录时） | ✅ |
| 说说完整备份 | ✅ |
| 日志 / 日记 | ✅ |
| 相册 / 图片 | ✅ |
| 视频 | ✅ |
| 留言板 | ✅ |
| 收藏 / 分享 | ✅ |
| 好友 / 访客 | ✅ |
| 本地离线浏览 | ✅ |
| 全文搜索 | ✅ |
| 增量备份 | ✅ |
| Apple Silicon | ✅ |
| Intel Mac | ✅ |

备份完成后可以直接在本地查看，不需要一直连接 QQ 空间。

---

## 🧭 三步使用

### 1. 下载

进入 **[Releases](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest)**：

- Apple Silicon（M1 / M2 / M3 / M4）：下载 `QZoneArchiver-*-mac-arm64.dmg`
- Intel Mac：下载 `QZoneArchiver-*-mac-x64.dmg`

### 2. 登录自己的 QQ 空间

打开 App 后点击登录，在内嵌 QQ 空间窗口中完成扫码 / 验证。

登录 Cookie 由 Electron 的本地 session 保存，本项目没有增加远程服务器。

### 3. 选择要备份的内容

选择说说、相册、日志等模块并开始备份。完成后可以直接进入本地档案浏览器查看历史内容。

---

## 🔐 你的数据去哪了？

这个问题比功能更重要。

**macOS 移植层不会把你的 QQ Cookie 或备份上传到我的服务器，因为这个项目没有自己的服务器。**

- QQ 登录发生在应用内嵌的 QQ 空间页面
- 登录状态保存在本机 Electron session
- 导出文件保存在你自己选择的 Mac 文件夹
- 本项目没有新增 analytics / telemetry
- 不要把 `p_skey`、`skey`、Cookie 或私人备份上传到 GitHub

更多说明见 [`docs/PRIVACY.md`](docs/PRIVACY.md)。

---

## 🍎 为什么要做 macOS 版？

上游 [`salt-fishes/qzone-archiver`](https://github.com/salt-fishes/qzone-archiver) v4.0.0 已经提供完整的 Electron 桌面应用，但官方桌面安装包仅发布 Windows 版本。

它的核心采集、恢复和导出逻辑本身大部分是跨平台的，所以这个项目专门完成 macOS 适配：

- `.dmg` / `.zip` 打包
- Apple Silicon `arm64`
- Intel `x64`
- macOS 原生 App / Edit / Window 菜单
- `⌘Q / ⌘C / ⌘V / ⌘A` 等标准快捷键
- Dock 再次点击恢复窗口
- Finder 目录交互
- GitHub Actions 使用真实 macOS runner 自动构建

核心 QQ 空间采集与删除说说恢复引擎尽可能保持上游不变，让平台移植层更容易检查和维护。

---

## ⚠️ 第一次打开提示“无法验证开发者”

当前公开构建没有使用付费 Apple Developer 证书签名，因此 macOS 可能在第一次启动时拦截。

操作方法：

**Finder → 应用程序 → 右键 QZoneArchiver → 打开 → 再次确认“打开”**

或者在：

**系统设置 → 隐私与安全性 → 仍要打开**

这与应用是否收费无关，是 macOS Gatekeeper 对未签名第三方应用的标准提示。

---

## ❓ 常见问题

**真的能恢复所有删除的说说吗？**  
不能。它依赖 QQ 空间仍保留的互动数据。曾有点赞、评论、回复等记录的内容成功机会更高。

**会读取别人的私密空间吗？**  
不会绕过 QQ 空间本身的权限。请只备份你有权访问的账号与内容。

**免费吗？**  
是。代码公开，Apache-2.0 许可。

**M1 Mac 能用吗？**  
可以。Apple Silicon 使用原生 `arm64` 构建。

**为什么安装包比较大？**  
桌面版基于 Electron，并包含离线档案浏览所需资源，因此体积会明显大于普通小工具。

更多见 [`docs/FAQ.md`](docs/FAQ.md)。

---

## 🛠️ 开发与构建

本仓库不复制维护一份容易过时的 QQ API 引擎，而是固定到经过验证的上游版本，然后应用一个可审计的 macOS patch。

```text
salt-fishes/qzone-archiver v4.0.0
              ↓
     apply-macos-port.mjs
              ↓
     macOS Electron App
              ↓
       arm64 / x64 DMG
```

本地构建：

```bash
git clone https://github.com/salt-fishes/qzone-archiver.git upstream-qzone-archiver
node scripts/apply-macos-port.mjs upstream-qzone-archiver
cd upstream-qzone-archiver/desktop
npm install
npm run dist:mac:arm64
```

Intel：

```bash
npm run dist:mac:x64
```

---

## 🙏 上游项目与开源许可

这个 macOS 版本基于：

- [`salt-fishes/qzone-archiver`](https://github.com/salt-fishes/qzone-archiver)
- 上游版本：v4.0.0
- 固定 commit：`63967a184b44ea3eaf339f0abac72bb5244c0a75`
- License：Apache-2.0

上游项目又基于 [`ShunCai/QZoneExport`](https://github.com/ShunCai/QZoneExport) 演进。

本仓库保留上游 attribution，并在生成的 App 中附带 Apache-2.0 License 与移植说明。详见 [`NOTICE`](NOTICE)。

---

<div align="center">

### 如果它帮你找回了一段过去，欢迎点一个 ⭐

**让更多还在找旧 QQ 空间内容的人看到它。**

[下载](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest) · [恢复原理](docs/RECOVERY.md) · [隐私](docs/PRIVACY.md) · [FAQ](docs/FAQ.md)

</div>
