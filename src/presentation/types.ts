import { TFile, setIcon } from 'obsidian';
import type MarpInlinePreviewPlugin from '../main';
import { injectThemeIfMissing } from '../marp/frontmatter';
import { rewriteCssUrls, rewriteImageSrcs } from '../util/images';
import { SLIDE_H, SLIDE_W, paintFrame } from '../util/frame';

export const MARP_PRESENTATION_VIEW_TYPE = 'marp-presentation-view';
export const MARP_PRESENTER_VIEW_TYPE = 'marp-presenter-view';

export const PRESENTATION_CHANNEL_NAME = 'obsidian-marp-presentation-sync';

export interface PresentationTimerState {
  isRunning: boolean;
  elapsedSeconds: number;
  startedAt: number | null;
}

export interface PresentationState {
  filePath: string;
  currentSlide: number;
  totalSlides: number;
  isBlackout: boolean;
  isWhiteout: boolean;
  timer: PresentationTimerState;
}

export interface SlideDeckData {
  slides: string[];
  css: string;
  comments: string[][];
  title?: string;
}

export type PresentationMessage =
  | { type: 'NAVIGATE'; filePath: string; slideIndex: number }
  | { type: 'TIMER_CONTROL'; action: 'start' | 'pause' | 'reset' }
  | { type: 'SET_BLANK'; blank: 'none' | 'black' | 'white' }
  | { type: 'SYNC_REQUEST' }
  | { type: 'SYNC_RESPONSE'; state: PresentationState };

export function safePaintFrame(iframe: HTMLIFrameElement, html: string, css: string): void {
  if (!paintFrame(iframe, html, css)) {
    requestAnimationFrame(() => {
      if (!paintFrame(iframe, html, css)) {
        setTimeout(() => paintFrame(iframe, html, css), 60);
      }
    });
  }
}

export async function loadSlideDeck(plugin: MarpInlinePreviewPlugin, file: TFile): Promise<SlideDeckData> {
  const src = await plugin.app.vault.cachedRead(file);
  const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
  const fmTheme = typeof fm?.theme === 'string' && fm.theme ? fm.theme : null;
  const theme = await plugin.themes.collect(file, fmTheme);
  const md = fmTheme ? src : injectThemeIfMissing(src, theme);
  const rendered = plugin.engine.renderArray(md);
  return {
    slides: rendered.html.map((h) => rewriteImageSrcs(h, file.path, plugin.app)),
    css: rewriteCssUrls(rendered.css, file.path, plugin.app),
    comments: rendered.comments,
    title: typeof fm?.title === 'string' ? fm.title : file.basename,
  };
}

export function createSlideIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('tabindex', '-1');
  iframe.style.cssText = `width:${SLIDE_W}px;height:${SLIDE_H}px;border:0;display:block;background:transparent;pointer-events:none;`;
  return iframe;
}

export function createIconButton(
  parent: HTMLElement,
  cls: string,
  icon: string,
  title: string,
  onClick: (e: MouseEvent) => void,
): HTMLButtonElement {
  const btn = parent.createEl('button', { cls, attr: { title } });
  setIcon(btn, icon);
  btn.onclick = onClick;
  return btn;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatTime(sec: number): string {
  return `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`;
}

export function formatClockTime(d = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

