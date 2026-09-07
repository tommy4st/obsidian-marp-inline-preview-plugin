// CJS stub of the runtime `obsidian` module — used only by the bundle smoke
// test that loads the built main.js inside Node. The vitest source tests use
// tests/obsidian-stub.ts for src/ imports; this file is for the bundled CJS
// require("obsidian") calls.

class App {}
class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
  }
  registerEditorExtension() {}
  registerMarkdownPostProcessor() {}
  registerEvent() {}
  addSettingTab() {}
  addCommand() {}
  async loadData() { return null; }
  async saveData() {}
}
class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
}
class Setting {
  constructor() { return this; }
  setName() { return this; }
  setDesc() { return this; }
  addText(cb) { cb?.(this); return this; }
  addToggle(cb) { cb?.(this); return this; }
  addDropdown(cb) { cb?.(this); return this; }
  addButton(cb) { cb?.(this); return this; }
  addOption() { return this; }
  setValue() { return this; }
  onChange() { return this; }
  setButtonText() { return this; }
  setCta() { return this; }
  setDisabled() { return this; }
  onClick() { return this; }
}
class MarkdownView {}
class TFile {}
class Modal {
  constructor(app) {
    this.app = app;
    this.contentEl = {
      empty() {},
      createEl() { return {}; },
    };
  }
  open() {}
  close() {}
}
class Notice {
  constructor() {}
  hide() {}
}
const Platform = {
  isDesktop: true,
  isMobile: false,
};

function normalizePath(p) {
  let s = String(p || '').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

module.exports = {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  MarkdownView,
  TFile,
  Modal,
  Notice,
  Platform,
  normalizePath,
};
