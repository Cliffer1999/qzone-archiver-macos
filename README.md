<div align="center">

# 🍎 QZone Archiver for macOS

### 删掉的 QQ 空间说说，也许还能找回来。

**免费 · 开源 · 本地运行 · Apple Silicon 原生支持**

通过仍然存在的点赞、评论等互动记录，尝试恢复已经删除的 QQ 空间说说；同时把说说、日志、相册、视频、留言等内容备份到 Mac 本地。

[![macOS](https://img.shields.io/badge/macOS-12%2B-black?logo=apple)](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest)
[![Apple Silicon](https://img.shields.io/badge/Apple%20Silicon-M1%20%2F%20M2%20%2F%20M3%20%2F%20M4-black?logo=apple)](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![Build](https://github.com/Cliffer1999/qzone-archiver-macos/actions/workflows/build-and-release.yml/badge.svg)](https://github.com/Cliffer1999/qzone-archiver-macos/actions/workflows/build-and-release.yml)

## ⬇️ 直接下载最新版

[![Download Apple Silicon](https://img.shields.io/badge/Download-M1%20%2F%20M2%20%2F%20M3%20%2F%20M4-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest/download/QZoneArchiver-4.0.0-mac-arm64.dmg)
&nbsp;
[![Download Intel Mac](https://img.shields.io/badge/Download-Intel%20Mac-1f6feb?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest/download/QZoneArchiver-4.0.0-mac-x64.dmg)

**2020 年以后使用 M1 / M2 / M3 / M4 的 Mac，请下载 Apple Silicon 版。**

[查看 Release 与 ZIP 下载](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest)

</div>

---

## ✨ 它能做什么？

很多人以为 QQ 空间说说删除以后就彻底消失了。

如果一条旧说说当年留下过 **点赞、评论、回复等互动记录**，QQ 空间相关互动数据中有时仍然残留可以用于重建的信息。

QZone Archiver 会尝试从这些仍然可访问的数据中恢复能够重建的历史说说。

> **不是万能恢复。** 如果服务器端已经没有任何可访问的残留数据，工具无法凭空还原内容。但曾经有人点赞或评论过的旧说说，非常值得尝试。

```text
旧说说曾经发布
      ↓
后来被删除
      ↓
当年存在点赞 / 评论 / 回复
      ↓
互动数据仍有残留
      ↓
尝试重建已删除说说
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

所有备份保存在你自己选择的本地目录中。

---

## 🧭 三步开始

### 1. 下载

- Apple Silicon（M1 / M2 / M3 / M4）：[`arm64.dmg`](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest/download/QZoneArchiver-4.0.0-mac-arm64.dmg)
- Intel Mac：[`x64.dmg`](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest/download/QZoneArchiver-4.0.0-mac-x64.dmg)

### 2. 登录自己的 QQ 空间

打开 App，点击登录，在应用内嵌的 QQ 空间页面完成扫码或验证。

### 3. 选择内容并开始备份

选择说说、相册、日志等模块。完成后可直接进入本地档案浏览器查看。

---

## 🔐 隐私

macOS 移植层没有新增服务器，也不会把你的 QQ Cookie 或备份上传到本项目维护者的服务器。

- QQ 登录发生在应用内嵌页面
- 登录状态保存在本机 Electron session
- 导出内容保存在你选择的 Mac 文件夹
- 没有新增 analytics / telemetry 服务
- 请勿公开上传 `p_skey`、`skey`、Cookie 或私人备份

详见 [`docs/PRIVACY.md`](docs/PRIVACY.md)。

---

## ⚠️ 第一次打开

从 **v4.0.0-mac.2** 开始，Apple Silicon 与 Intel 构建都会进行 **ad-hoc code signing**，并在 GitHub Actions 中执行 `codesign --verify --deep --strict` 校验。

因此不会再发布一个连 macOS 自身签名完整性检查都无法通过的包。

不过这个社区版本目前还没有使用付费的 **Apple Developer ID + Apple notarization**，所以第一次启动时 Gatekeeper 仍可能提示“无法验证开发者”。这种情况下：

**Finder → 应用程序 → 右键 QZoneArchiver → 打开 → 再确认打开**

或者：

**系统设置 → 隐私与安全性 → 仍要打开**

如果你看到的是“应用已损坏，应该移到废纸篓”，请确认下载的是 **v4.0.0-mac.2 或更新版本**，不要继续使用旧的 `mac.1` 包。

---

## ❓ FAQ

**真的能恢复所有删除的说说吗？**  
不能。恢复依赖 QQ 空间目前仍可访问的互动数据。

**M1 / M2 / M3 / M4 能用吗？**  
可以，下载 `arm64.dmg`。

**会绕过别人的 QQ 空间权限吗？**  
不会。工具只能使用当前登录账号本身有权访问的数据。

**收费吗？**  
不收费，代码公开，遵循 Apache-2.0。

更多问题见 [`docs/FAQ.md`](docs/FAQ.md)。

---

## 🍎 macOS 版做了什么适配？

上游 [`salt-fishes/qzone-archiver`](https://github.com/salt-fishes/qzone-archiver) v4.0.0 提供完整 Electron 桌面版，但官方桌面包只发布 Windows。

本项目保留上游 QQ 空间采集、恢复与导出逻辑，并增加：

- macOS `.dmg` / `.zip`
- Apple Silicon `arm64`
- Intel `x64`
- ad-hoc code signing
- 自动 `codesign` 完整性校验
- macOS 原生菜单与快捷键
- Dock / Finder 行为适配
- GitHub Actions 自动构建与 Release

```text
salt-fishes/qzone-archiver v4.0.0
              ↓
     apply-macos-port.mjs
              ↓
       macOS adaptation
              ↓
     code-sign + verify
              ↓
      arm64 / x64 DMG
```

---

## 🛠️ 本地构建

```bash
git clone https://github.com/salt-fishes/qzone-archiver.git upstream-qzone-archiver
node scripts/apply-macos-port.mjs upstream-qzone-archiver
cd upstream-qzone-archiver/desktop
npm install
npm run dist:mac:arm64
```

Intel Mac：

```bash
npm run dist:mac:x64
```

---

## 🙏 上游与许可

基于：

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

[下载最新版](https://github.com/Cliffer1999/qzone-archiver-macos/releases/latest) · [恢复原理](docs/RECOVERY.md) · [隐私](docs/PRIVACY.md) · [FAQ](docs/FAQ.md)

</div>
