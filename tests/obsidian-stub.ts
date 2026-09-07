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

export class Component {
  load(): void {}
  onload(): void {}
  unload(): void {}
  onunload(): void {}
  addChild<T extends Component>(component: T): T { return component; }
  removeChild<T extends Component>(component: T): T { return component; }
  register(cb: () => any): void {}
  registerEvent(eventRef: any): void {}
  registerInterval(id: number): number { return id; }
}

export class Scope {
  register(_modifiers: string[], _key: string | null, _func: (evt: KeyboardEvent) => boolean | void): void {}
}

export class WorkspaceLeaf {
  view: any;
  app: App;
  constructor(app?: App) {
    this.app = app || (new App());
  }
  async setViewState(_viewState: any, _eState?: any): Promise<void> {}
  getViewState(): any { return {}; }
  detach(): void {}
}

export class ItemView extends Component {
  app: App;
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  contentEl: HTMLElement;
  scope: Scope | null = null;
  navigation = false;

  constructor(leaf: WorkspaceLeaf) {
    super();
    this.leaf = leaf;
    this.app = leaf.app || new App();
    this.containerEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.containerEl.appendChild(this.contentEl);
  }

  getViewType(): string { return 'item-view'; }
  getDisplayText(): string { return 'Item View'; }
  getIcon(): string { return 'document'; }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
  getState(): Record<string, unknown> { return {}; }
  async setState(_state: any, _result?: any): Promise<void> {}
  addAction(_icon: string, _title: string, _callback: (evt: MouseEvent) => any): HTMLElement {
    return document.createElement('div');
  }
}

export class MarkdownRenderer {
  static async render(
    _app: App,
    markdown: string,
    el: HTMLElement,
    _sourcePath: string,
    _component: Component,
  ): Promise<void> {
    el.innerHTML = markdown;
  }
}

export function setIcon(parent: HTMLElement, iconId: string): void {
  parent.setAttribute('data-icon', iconId);
}

