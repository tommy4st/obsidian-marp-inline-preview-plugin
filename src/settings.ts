import { App, PluginSettingTab, Setting } from 'obsidian';
import type MarpInlinePreviewPlugin from './main';

export type ExportImageQuality = 'original' | 'high' | 'medium' | 'low';

export interface MarpSettings {
  editPreview: boolean;
  readingPreview: boolean;
  math: 'katex' | 'off';
  exportIncludeNotes: boolean;
  exportOpenAfter: boolean;
  exportImageQuality: ExportImageQuality;
}

export const DEFAULT_SETTINGS: MarpSettings = {
  editPreview: true,
  readingPreview: true,
  math: 'katex',
  exportIncludeNotes: false,
  exportOpenAfter: true,
  exportImageQuality: 'medium',
};

/** Fixed debounce for edit-mode rebuilds. Was tunable via settings; pinned here. */
export const DEBOUNCE_MS = 300;

export class MarpSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: MarpInlinePreviewPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Marp Inline Preview' });
    containerEl.createEl('p', {
      text: 'Only files with `marp: true` in their YAML frontmatter are processed.',
    });

    new Setting(containerEl)
      .setName('Inline preview in edit mode')
      .setDesc('Show each slide rendered below its --- separator in the editor.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.editPreview).onChange(async (v) => {
          this.plugin.settings.editPreview = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Full preview in reading mode')
      .setDesc('Replace the rendered markdown with the full Marp deck.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.readingPreview).onChange(async (v) => {
          this.plugin.settings.readingPreview = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Math rendering')
      .setDesc('KaTeX is bundled. Disable to skip math entirely.')
      .addDropdown((d) =>
        d
          .addOption('katex', 'KaTeX')
          .addOption('off', 'Off')
          .setValue(this.plugin.settings.math)
          .onChange(async (v: 'katex' | 'off') => {
            this.plugin.settings.math = v;
            await this.plugin.saveSettings();
            this.plugin.rebuildEngine();
          }),
      );

    containerEl.createEl('h3', { text: 'PDF Export' });

    new Setting(containerEl)
      .setName('Include presenter notes')
      .setDesc('Add presenter notes as PDF sticky note annotations by default.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.exportIncludeNotes).onChange(async (v) => {
          this.plugin.settings.exportIncludeNotes = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Open PDF after export')
      .setDesc('Open the exported PDF in Obsidian by default after completion.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.exportOpenAfter).onChange(async (v) => {
          this.plugin.settings.exportOpenAfter = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Default image quality / DPI')
      .setDesc('Optimize raster image resolution and compression to reduce PDF file size.')
      .addDropdown((d) =>
        d
          .addOption('original', 'Original (No compression)')
          .addOption('high', 'High (~300 DPI, 4K max)')
          .addOption('medium', 'Medium (~150 DPI, 1080p max)')
          .addOption('low', 'Low (~96 DPI, 720p max)')
          .setValue(this.plugin.settings.exportImageQuality)
          .onChange(async (v: ExportImageQuality) => {
            this.plugin.settings.exportImageQuality = v;
            await this.plugin.saveSettings();
          }),
      );
  }
}
