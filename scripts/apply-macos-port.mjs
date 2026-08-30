#!/usr/bin/env node
/**
 * QZone Archiver macOS port patcher.
 *
 * Applies a small macOS compatibility layer to the upstream
 * salt-fishes/qzone-archiver v4.0.0 desktop source without rewriting the
 * QQ Space collection / deleted-post recovery engine.
 *
 * Modified files are marked for Apache-2.0 section 4(b) compliance.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const upstreamRoot = path.resolve(process.argv[2] || '.');
const desktopDir = path.join(upstreamRoot, 'desktop');

function fail(message) {
  console.error(`[mac-port] ${message}`);
  process.exit(1);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  console.log(`[mac-port] updated ${path.relative(upstreamRoot, file)}`);
}

function replaceOnceOrFail(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    fail(`Could not locate patch marker: ${label}`);
  }
  return source.replace(needle, replacement);
}

if (!fs.existsSync(path.join(upstreamRoot, 'LICENSE'))) {
  fail(`Upstream LICENSE not found: ${upstreamRoot}`);
}
if (!fs.existsSync(path.join(desktopDir, 'package.json'))) {
  fail(`Upstream desktop/package.json not found: ${desktopDir}`);
}

// 1. Add explicit macOS build commands.
const packageFile = path.join(desktopDir, 'package.json');
const pkg = JSON.parse(read(packageFile));
pkg.description = 'QQ空间档案备份桌面版（macOS port：内嵌登录 → 采集 → 打包 → 内置 SPA 浏览）';
pkg.scripts = {
  ...pkg.scripts,
  'dist:mac': 'npm run build:renderer && electron-builder --mac',
  'dist:mac:arm64': 'npm run build:renderer && electron-builder --mac --arm64',
  'dist:mac:x64': 'npm run build:renderer && electron-builder --mac --x64',
};
write(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);

// 2. Replace Windows-only builder config with macOS DMG/ZIP targets.
// Apple Silicon executables must have a valid code signature. We use an
// ad-hoc signature (identity "-") so the public build launches correctly
// without embedding a private Apple Developer certificate in CI.
const builderFile = path.join(desktopDir, 'electron-builder.yml');
const builderConfig = `# MODIFIED FOR macOS PORT by Cliffer1999
# Based on salt-fishes/qzone-archiver v4.0.0 (Apache-2.0)
appId: com.cliffer1999.qzonearchiver.macos
productName: QZoneArchiver
copyright: Copyright © 2026 qzone-archiver contributors

asar: true

directories:
  output: release
  buildResources: build

files:
  - src/main/**/*
  - src/preload/**/*
  - src/engine/**/*
  - src/renderer/dist/**/*
  - assets/**/*
  - package.json
  - LICENSE-UPSTREAM.txt
  - NOTICE-MACOS-PORT.txt

mac:
  category: public.app-category.utilities
  # Ad-hoc sign the app. This is required for reliable Apple Silicon launch
  # and avoids the invalid/unsigned bundle that macOS may label "damaged".
  identity: '-'
  hardenedRuntime: false
  gatekeeperAssess: false
  target:
    - dmg
    - zip
  artifactName: \${productName}-\${version}-mac-\${arch}.\${ext}
  extendInfo:
    NSHighResolutionCapable: true

dmg:
  title: QZoneArchiver \${version}
  artifactName: \${productName}-\${version}-mac-\${arch}.\${ext}
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications

electronDownload:
  mirror: https://npmmirror.com/mirrors/electron/
`;
write(builderFile, builderConfig);

// 3. Restore a native macOS application menu.
const mainFile = path.join(desktopDir, 'src/main/index.js');
let mainSource = read(mainFile);

if (!mainSource.includes('function buildMacMenu()')) {
  const marker = 'const gotLock = app.requestSingleInstanceLock();';
  if (!mainSource.includes(marker)) fail('Could not locate main-process patch marker.');

  const macMenu = `// MODIFIED FOR macOS PORT: native application menu.\nfunction buildMacMenu() {\n  return Menu.buildFromTemplate([\n    {\n      label: app.name,\n      submenu: [\n        { role: 'about' },\n        { type: 'separator' },\n        { role: 'services' },\n        { type: 'separator' },\n        { role: 'hide' },\n        { role: 'hideOthers' },\n        { role: 'unhide' },\n        { type: 'separator' },\n        { role: 'quit' },\n      ],\n    },\n    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },\n    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }] },\n  ]);\n}\n\n`;
  mainSource = mainSource.replace(marker, `${macMenu}${marker}`);
}

if (mainSource.includes('Menu.setApplicationMenu(null);')) {
  mainSource = mainSource.replace(
    'Menu.setApplicationMenu(null);',
    `// MODIFIED FOR macOS PORT: standard native menu on macOS.\n    Menu.setApplicationMenu(process.platform === 'darwin' ? buildMacMenu() : null);`,
  );
}
write(mainFile, mainSource);

// 4. Use a native macOS inset title bar for the main window.
const windowsFile = path.join(desktopDir, 'src/main/windows.js');
let windowsSource = read(windowsFile);
const browserWindowMarker = `windows.main = new BrowserWindow({\n    width: 1200,`;
if (windowsSource.includes(browserWindowMarker)) {
  windowsSource = windowsSource.replace(
    browserWindowMarker,
    `windows.main = new BrowserWindow({\n    // MODIFIED FOR macOS PORT: native traffic-light/title-bar layout.\n    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',\n    width: 1200,`,
  );
}
write(windowsFile, windowsSource);

// 5. Correct the desktop progress model.
// Upstream StatusIndicator reports 0-100 for EACH sub-phase. The renderer
// displayed that number as if it were the whole backup, producing 100 -> 0
// jumps whenever the engine moved to the next phase. Keep the engine's phase
// progress intact, but derive a monotonic overall estimate for the main bar.
const backupStoreFile = path.join(desktopDir, 'src/renderer/src/stores/backup.ts');
let backupStoreSource = read(backupStoreFile);

const progressDecl = `export const progress = ref<{
  module?: string; phase?: string; tip?: string; percent?: number;
  extra?: { success?: number; failed?: number; skip?: number; elapsed?: number };
}>({});`;

const progressModel = `export const progress = ref<{
  module?: string; phase?: string; tip?: string; percent?: number;
  done?: number; total?: number; status?: string;
  extra?: { success?: number; failed?: number; skip?: number; elapsed?: number };
}>({});

// MODIFIED FOR macOS PORT: separate whole-backup progress from sub-phase progress.
export const overallPercent = ref(0);

const MODULE_PHASE_ORDER: Record<string, string[]> = {
  Messages: [
    'Messages', 'Messages_Filter', 'Messages_Full_Content', 'Messages_More_Images',
    'Messages_Comments', 'Messages_Like', 'Messages_Visitor', 'Messages_Images_Mime',
    'Messages_Lbs_Info', 'Messages_Deleted', 'Messages_Export', 'Messages_Export_Other',
    'Common_File', 'Backup_Save', 'Backup_Export',
  ],
  Blogs: [
    'Blogs', 'Blogs_Content', 'Blogs_Comments', 'Blogs_Like', 'Blogs_Visitor',
    'Blogs_Export', 'Blogs_Export_Other', 'Common_File', 'Backup_Save', 'Backup_Export',
  ],
  Diaries: [
    'Diaries', 'Diaries_Content', 'Diaries_Comments', 'Diaries_Like', 'Diaries_Visitor',
    'Diaries_Export', 'Diaries_Export_Other', 'Common_File', 'Backup_Save', 'Backup_Export',
  ],
  Photos: [
    'Photos', 'Photos_Albums_Comments', 'Photos_Albums_Like', 'Photos_Albums_Visitor',
    'Photos_Images', 'Photos_Images_Info', 'Photos_Images_Comments', 'Photos_Images_Like',
    'Photos_Images_Mime', 'Photos_Export', 'Photos_Images_Export', 'Photos_Images_Export_Other',
    'Common_File', 'Backup_Save', 'Backup_Export',
  ],
  Videos: ['Videos', 'Videos_Comments', 'Videos_Like', 'Videos_Export', 'Common_File', 'Backup_Save', 'Backup_Export'],
  Boards: ['Boards', 'Boards_Images_Mime', 'Boards_Export', 'Boards_Export_Other', 'Common_File', 'Backup_Save', 'Backup_Export'],
  Favorites: ['Favorites', 'Favorites_Export', 'Favorites_Export_Other', 'Common_File', 'Backup_Save', 'Backup_Export'],
  Shares: ['Shares', 'Shares_Comments', 'Shares_Like', 'Shares_Visitor', 'Shares_Export', 'Shares_Export_Other', 'Common_File', 'Backup_Save', 'Backup_Export'],
  Friends: ['Friends', 'Friends_Time', 'Friends_Access', 'Friends_Care', 'Friends_Export', 'Common_File', 'Backup_Save', 'Backup_Export'],
  Visitors: ['Visitors', 'Visitors_Export', 'Visitors_Export_Other', 'Common_File', 'Backup_Save', 'Backup_Export'],
};

let activeProgressModule = '';
let activePhaseFloor = 0;

function resetOverallProgress() {
  overallPercent.value = 0;
  activeProgressModule = '';
  activePhaseFloor = 0;
}

function updateOverallProgress(p: any) {
  const modules = selectedModules.value;
  if (!modules.length || !p?.module) return;
  const moduleIndex = modules.indexOf(p.module);
  if (moduleIndex < 0) return;

  if (activeProgressModule !== p.module) {
    activeProgressModule = p.module;
    activePhaseFloor = 0;
  }

  const phases = MODULE_PHASE_ORDER[p.module] || [];
  const phaseIndex = phases.indexOf(p.phase || '');
  const phasePercent = Math.max(0, Math.min(100, Number(p.percent) || 0)) / 100;

  if (phaseIndex >= 0 && phases.length) {
    // Every indicator may independently reach 100%. Dividing by the known
    // phase count prevents one short sub-step from completing the whole bar.
    const phaseFraction = (phaseIndex + phasePercent) / phases.length;
    activePhaseFloor = Math.max(activePhaseFloor, phaseFraction);
  }

  // 100% is reserved for the real backup:completed event.
  const moduleFraction = Math.min(0.98, activePhaseFloor);
  const globalFraction = (moduleIndex + moduleFraction) / Math.max(1, modules.length);
  overallPercent.value = Math.max(
    overallPercent.value,
    Math.min(99, Math.floor(globalFraction * 100)),
  );
}

function markModuleCompleted(module: string) {
  const modules = selectedModules.value;
  const moduleIndex = modules.indexOf(module);
  if (moduleIndex < 0 || !modules.length) return;
  const completedFraction = (moduleIndex + 1) / modules.length;
  overallPercent.value = Math.max(overallPercent.value, Math.min(99, Math.floor(completedFraction * 100)));
}`;
backupStoreSource = replaceOnceOrFail(backupStoreSource, progressDecl, progressModel, 'backup progress declaration');

backupStoreSource = replaceOnceOrFail(
  backupStoreSource,
  `  busy.value = true;\n  paused.value = false;\n  progress.value = { module: modules[0] || '', phase: '启动', percent: 0 };`,
  `  resetOverallProgress();\n  busy.value = true;\n  paused.value = false;\n  progress.value = { module: modules[0] || '', phase: '启动', percent: 0 };`,
  'startBackup progress reset',
);

backupStoreSource = replaceOnceOrFail(
  backupStoreSource,
  `    window.api.on('backup:progress', (p) => {\n      progress.value = p;\n    }),`,
  `    window.api.on('backup:progress', (p) => {\n      progress.value = p;\n      updateOverallProgress(p);\n    }),`,
  'backup progress listener',
);

backupStoreSource = replaceOnceOrFail(
  backupStoreSource,
  `    window.api.on('backup:module-done', (p) => {\n      pushLog('success', \`模块完成：\${MODULE_META[p.module]?.label || p.module}\`);\n    }),`,
  `    window.api.on('backup:module-done', (p) => {\n      markModuleCompleted(p.module);\n      pushLog('success', \`模块完成：\${MODULE_META[p.module]?.label || p.module}\`);\n    }),`,
  'module done listener',
);

backupStoreSource = replaceOnceOrFail(
  backupStoreSource,
  `    window.api.on('backup:completed', async () => {\n      busy.value = false;`,
  `    window.api.on('backup:completed', async () => {\n      overallPercent.value = 100;\n      busy.value = false;`,
  'backup completed listener',
);

backupStoreSource = replaceOnceOrFail(
  backupStoreSource,
  `    busy, paused, engineReady, engineFailed, retryEngine, progress, logs, elapsedSec, downloads,`,
  `    busy, paused, engineReady, engineFailed, retryEngine, progress, overallPercent, logs, elapsedSec, downloads,`,
  'backup store exports',
);
write(backupStoreFile, backupStoreSource);

const backupViewFile = path.join(desktopDir, 'src/renderer/src/views/BackupView.vue');
let backupViewSource = read(backupViewFile);
backupViewSource = replaceOnceOrFail(
  backupViewSource,
  `  busy, paused, progress, elapsedSec, lastResult,`,
  `  busy, paused, progress, overallPercent, elapsedSec, lastResult,`,
  'BackupView store destructure',
);
backupViewSource = replaceOnceOrFail(
  backupViewSource,
  `            <span class="prog-percent">{{ progress.percent ?? 0 }}%</span>`,
  `            <span class="prog-percent">整体进度 {{ overallPercent }}%</span>`,
  'BackupView overall percent label',
);
backupViewSource = replaceOnceOrFail(
  backupViewSource,
  `            <div class="bar-fill" :style="{ width: (progress.percent ?? 0) + '%' }"></div>`,
  `            <div class="bar-fill" :style="{ width: overallPercent + '%' }"></div>`,
  'BackupView overall progress bar',
);
backupViewSource = replaceOnceOrFail(
  backupViewSource,
  `          <div class="prog-meta">\n            <span>成功 {{ progExtra.success ?? 0 }}</span>`,
  `          <div class="prog-meta">\n            <span>当前步骤 {{ progress.percent ?? 0 }}%</span>\n            <span>成功 {{ progExtra.success ?? 0 }}</span>`,
  'BackupView phase percent',
);
write(backupViewFile, backupViewSource);

// 6. Bundle upstream licence and a clear derivative-work notice.
fs.copyFileSync(path.join(upstreamRoot, 'LICENSE'), path.join(desktopDir, 'LICENSE-UPSTREAM.txt'));
console.log('[mac-port] copied upstream Apache-2.0 licence');

const notice = `QZoneArchiver macOS Port\n\nDerivative platform port of:\n  salt-fishes/qzone-archiver\n  https://github.com/salt-fishes/qzone-archiver\n\nPinned upstream commit:\n  63967a184b44ea3eaf339f0abac72bb5244c0a75 (v4.0.0)\n\nUpstream licence: Apache License 2.0.\n\nmacOS-specific modifications:\n- electron-builder DMG/ZIP targets for arm64 and x64\n- ad-hoc macOS code signing for distributable community builds\n- native macOS application menu\n- native macOS main-window title-bar behaviour\n- corrected aggregate backup progress display\n- build and attribution metadata\n\nThe QQ Space collection, deleted-post recovery and export engine are retained\nfrom upstream rather than reimplemented in this port.\n`;
write(path.join(desktopDir, 'NOTICE-MACOS-PORT.txt'), notice);

console.log('[mac-port] macOS port applied successfully');
