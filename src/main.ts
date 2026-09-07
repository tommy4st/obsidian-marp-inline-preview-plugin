import { Plugin, MarkdownView, TFile, Platform } from 'obsidian';
import { MarpEngine } from './marp/engine';
import { ThemeResolver } from './marp/themes';
import { buildReadingPostProcessor } from './reading/postProcessor';
import { buildEditorExtension, refreshSlides } from './editor/extension';
import type { EditorView } from '@codemirror/view';
import { DEBOUNCE_MS, DEFAULT_SETTINGS, MarpSettingTab, MarpSettings } from './settings';
import { openPdfExportModal } from './export/service';

export default class MarpInlinePreviewPlugin extends Plugin {
  settings: MarpSettings = { ...DEFAULT_SETTINGS };
  engine!: MarpEngine;
  themes!: ThemeResolver;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.engine = new MarpEngine({ math: this.settings.math === 'off' ? false : 'katex' });
    this.themes = new ThemeResolver(this.app, this.engine);

    this.registerMarkdownPostProcessor(
      buildReadingPostProcessor({
        app: this.app,
        engine: this.engine,
        themes: this.themes,
        enabled: () => this.settings.readingPreview,
      }),
    );

    this.registerEditorExtension(
      buildEditorExtension({
        app: this.app,
        engine: this.engine,
        themes: this.themes,
        enabled: () => this.settings.editPreview,
        debounceMs: () => DEBOUNCE_MS,
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', () => this.refreshActiveEditors()),
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && (file.path.endsWith('.css') || file.name.startsWith('.marprc'))) {
          this.themes.invalidate();
          this.refreshActiveEditors();
          this.refreshActiveReadingViews();
        }
      }),
    );

    this.addSettingTab(new MarpSettingTab(this.app, this));

    this.addCommand({
      id: 'marp-inline-preview-refresh',
      name: 'Refresh Marp previews',
      callback: () => {
        this.themes.invalidate();
        this.refreshActiveEditors();
        this.refreshActiveReadingViews();
      },
    });

    this.addCommand({
      id: 'marp-export-pdf',
      name: 'Export slide deck to PDF...',
      checkCallback: (checking: boolean) => {
        if (!Platform.isDesktop) return false;
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const isMarp = fm?.marp === true || fm?.marp === 'true';
        if (!isMarp) return false;

        if (!checking) {
          openPdfExportModal(file, {
            plugin: this,
            engine: this.engine,
            themes: this.themes,
          });
        }
        return true;
      },
    });

    if (Platform.isDesktop) {
      this.registerEvent(
        this.app.workspace.on('file-menu', (menu, file) => {
          if (file instanceof TFile && file.extension === 'md') {
            const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
            if (fm?.marp === true || fm?.marp === 'true') {
              menu.addItem((item) => {
                item
                  .setTitle('Export Marp to PDF...')
                  .setIcon('file-text')
                  .onClick(() => {
                    openPdfExportModal(file, {
                      plugin: this,
                      engine: this.engine,
                      themes: this.themes,
                    });
                  });
              });
            }
          }
        }),
      );
    }
  }

  onunload(): void {
    // All registrations are auto-cleaned by Obsidian.
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  rebuildEngine(): void {
    this.engine.rebuild({ math: this.settings.math === 'off' ? false : 'katex' });
    this.themes.invalidate();
    this.refreshActiveEditors();
    this.refreshActiveReadingViews();
  }

  /** Ask every open editor's worker ViewPlugin to recompute slide widgets. */
  private refreshActiveEditors(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const v = leaf.view;
      if (v instanceof MarkdownView) {
        // @ts-expect-error — see note in editor/extension.ts about editor.cm
        const cm = v.editor?.cm as EditorView | undefined;
        if (cm) cm.dispatch({ effects: refreshSlides.of(null) });
      }
    });
  }

  /** Force Obsidian to re-render open preview leaves, so our post-processor runs again. */
  private refreshActiveReadingViews(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const v = leaf.view;
      if (v instanceof MarkdownView && v.getMode() === 'preview') {
        v.previewMode?.rerender?.(true);
      }
    });
  }
}
