export const normalizePath = (p: string): string => {
  const s = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const parts = s.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (resolved.length > 0) resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
};
export class TFile {}
export class App {}
export class Modal {
  app: App;
  contentEl: HTMLElement;
  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement('div');
  }
  open(): void {}
  close(): void {}
}
export class Notice {
  constructor(_message: string, _timeout?: number) {}
  hide(): void {}
}
export const Platform = {
  isDesktop: true,
  isMobile: false,
};
