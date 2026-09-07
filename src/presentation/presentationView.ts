import { ItemView, Platform, TFile, WorkspaceLeaf } from 'obsidian';
import type MarpInlinePreviewPlugin from '../main';
import { SLIDE_H, SLIDE_W } from '../util/frame';
import { PresentationSession } from './session';
import {
  MARP_PRESENTATION_VIEW_TYPE,
  SlideDeckData,
  createIconButton,
  createSlideIframe,
  loadSlideDeck,
  safePaintFrame,
} from './types';
import { openPresenterView } from './service';

interface LaserPoint {
  x: number;
  y: number;
  time: number;
  newStroke?: boolean;
}

export class MarpPresentationView extends ItemView {
  public file: TFile | null = null;
  public session: PresentationSession | null = null;
  private deck: SlideDeckData | null = null;

  private stageEl!: HTMLElement;
  private slideWrapperEl!: HTMLElement;
  private iframe!: HTMLIFrameElement;
  private blankOverlayEl!: HTMLElement;
  private laserCanvas!: HTMLCanvasElement;
  private hudEl!: HTMLElement;
  private hudCounterEl!: HTMLElement;
  private laserBtn!: HTMLElement;
  private hudHideTimeout: any = null;

  public isLaserActive = false;
  private isLaserDrawing = false;
  private laserPoints: LaserPoint[] = [];
  private laserCursorPos: { x: number; y: number } | null = null;
  private laserAnimId: number | null = null;

  private unsubs: Array<() => void> = [];
  private resizeObserver: ResizeObserver | null = null;
  private touchStartX = 0;
  private touchStartY = 0;

  constructor(leaf: WorkspaceLeaf, private plugin: MarpInlinePreviewPlugin) {
    super(leaf);
    this.navigation = false;
  }

  getViewType(): string {
    return MARP_PRESENTATION_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file ? `Presentation: ${this.file.basename}` : 'Marp Presentation';
  }

  getIcon(): string {
    return 'presentation';
  }

  getState(): Record<string, unknown> {
    return {
      filePath: this.file?.path,
      slideIndex: this.session?.currentSlide ?? 0,
    };
  }

  async setState(state: any, _result: any): Promise<void> {
    if (state?.filePath) {
      const abstractFile = this.app.vault.getAbstractFileByPath(state.filePath);
      if (abstractFile instanceof TFile) {
        await this.loadFile(abstractFile, state.slideIndex ?? 0);
      }
    }
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('marp-presentation-view');
    contentEl.tabIndex = 0;

    // Slide Stage & Wrapper
    this.stageEl = contentEl.createDiv({ cls: 'marp-presentation-stage' });
    this.slideWrapperEl = this.stageEl.createDiv({ cls: 'marp-presentation-slide-wrapper' });
    this.slideWrapperEl.style.width = `${SLIDE_W}px`;
    this.slideWrapperEl.style.height = `${SLIDE_H}px`;

    this.iframe = createSlideIframe();
    this.slideWrapperEl.appendChild(this.iframe);

    // Overlays & Laser Canvas
    this.blankOverlayEl = contentEl.createDiv({ cls: 'marp-presentation-blank-overlay' });
    this.setupLaserPointer(contentEl);

    // Controls & Listeners
    this.buildHud(contentEl);
    this.setupKeyboardNavigation(contentEl);
    this.setupClickNavigation(contentEl);
    this.setupTouchNavigation(contentEl);
    this.setupAutoScaling(contentEl);

    if (this.deck) {
      this.renderCurrentSlide();
      this.updateHud();
    }

    const fileModifyRef = this.app.vault.on('modify', async (modifiedFile) => {
      if (this.file && modifiedFile.path === this.file.path) {
        await this.reloadDeck();
      }
    });
    this.registerEvent(fileModifyRef);

    if (Platform.isDesktop && this.isPopout()) {
      setTimeout(() => void this.enterFullscreen(), 50);
    }

    const focusView = () => {
      try {
        const doc = contentEl.ownerDocument || document;
        doc.defaultView?.focus();
        contentEl.focus();
      } catch {}
    };
    focusView();
    setTimeout(focusView, 50);
    setTimeout(focusView, 150);
  }

  async onClose(): Promise<void> {
    this.cleanup();
  }

  public async loadFile(file: TFile, initialSlideIndex = 0): Promise<void> {
    this.file = file;
    await this.reloadDeck(initialSlideIndex);
  }

  private async reloadDeck(initialSlideIndex?: number): Promise<void> {
    if (!this.file) return;

    try {
      this.deck = await loadSlideDeck(this.plugin, this.file);

      if (!this.session) {
        this.session = PresentationSession.getOrCreate(this.file.path, this.deck.slides.length);
        if (initialSlideIndex !== undefined && initialSlideIndex >= 0) {
          this.session.goTo(initialSlideIndex, false);
        }
        this.attachSessionListeners();
      } else {
        this.session.setTotalSlides(this.deck.slides.length);
      }

      this.renderCurrentSlide();
      this.updateHud();
    } catch (err) {
      console.error('[marp-presentation] failed to render slide deck', err);
    }
  }

  private attachSessionListeners(): void {
    if (!this.session) return;

    this.unsubs.push(
      this.session.on('slide-change', () => {
        this.clearLaserTrails();
        this.renderCurrentSlide();
        this.updateHud();
      }),
      this.session.on('blank-change', (blank) => this.updateBlankOverlay(blank)),
      this.session.on('destroy', () => {
        this.session = null;
      }),
    );
  }

  private renderCurrentSlide(): void {
    if (!this.deck || !this.session) return;
    const slideHtml =
      this.deck.slides[this.session.currentSlide] ??
      '<div class="marp-inline-preview"><section><h1>End of Deck</h1></section></div>';
    safePaintFrame(this.iframe, slideHtml, this.deck.css);
  }

  private updateBlankOverlay(blank: 'none' | 'black' | 'white'): void {
    this.blankOverlayEl.toggleClass('is-blackout', blank === 'black');
    this.blankOverlayEl.toggleClass('is-whiteout', blank === 'white');
  }

  // --- Laser Pointer ---

  private setupLaserPointer(container: HTMLElement): void {
    this.laserCanvas = container.createEl('canvas', { cls: 'marp-laser-canvas' });
    this.resizeLaserCanvas();

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest('.marp-presentation-hud')) return;
      if (this.isLaserActive && e.button === 0) {
        this.isLaserDrawing = true;
        const rect = this.laserCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.laserCursorPos = { x, y };
        this.laserPoints.push({ x, y, time: performance.now(), newStroke: true });
        this.startLaserAnimation();
        try {
          container.setPointerCapture?.(e.pointerId);
        } catch {}
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      this.showHudTemporarily();
      if (this.isLaserActive) {
        const rect = this.laserCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.laserCursorPos = { x, y };
        if (this.isLaserDrawing) {
          this.laserPoints.push({ x, y, time: performance.now() });
        }
        this.startLaserAnimation();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.isLaserDrawing) {
        this.isLaserDrawing = false;
        try {
          if (container.hasPointerCapture?.(e.pointerId)) {
            container.releasePointerCapture(e.pointerId);
          }
        } catch {}
      }
    };

    const onPointerLeave = () => {
      this.isLaserDrawing = false;
      this.laserCursorPos = null;
      this.hudEl?.removeClass('is-visible');
      this.contentEl.addClass('is-cursor-hidden');
      this.startLaserAnimation();
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('pointerleave', onPointerLeave);

    this.unsubs.push(() => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('pointerleave', onPointerLeave);
      if (this.laserAnimId !== null) cancelAnimationFrame(this.laserAnimId);
    });
  }

  public resizeLaserCanvas = (): void => {
    if (!this.laserCanvas || !this.contentEl) return;
    const dpr = window.devicePixelRatio || 1;
    this.laserCanvas.width = (this.contentEl.clientWidth || window.innerWidth) * dpr;
    this.laserCanvas.height = (this.contentEl.clientHeight || window.innerHeight) * dpr;
    if (this.isLaserActive) {
      this.startLaserAnimation();
    }
  };

  private clearLaserTrails(): void {
    this.laserPoints = [];
    this.isLaserDrawing = false;
    if (this.laserCanvas) {
      const ctx = this.laserCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, this.laserCanvas.width, this.laserCanvas.height);
    }
  }

  private startLaserAnimation(): void {
    if (this.laserAnimId === null) {
      this.laserAnimId = requestAnimationFrame(() => this.drawLaser());
    }
  }

  private drawLaser(): void {
    this.laserAnimId = null;
    if (!this.laserCanvas) return;

    const ctx = this.laserCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, this.laserCanvas.width, this.laserCanvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const now = performance.now();
    this.laserPoints = this.laserPoints.filter((p) => now - p.time < 1000);

    // Draw fading trail
    if (this.laserPoints.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < this.laserPoints.length; i++) {
        const p1 = this.laserPoints[i];
        if (p1.newStroke) continue;
        const p0 = this.laserPoints[i - 1];
        const alpha = Math.max(0, 1 - (now - p1.time) / 1000);
        ctx.lineWidth = Math.max(1, 4 * alpha);
        ctx.strokeStyle = `rgba(255, 34, 34, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    // Draw blurred red dot
    const isCursorHidden = this.contentEl.classList.contains('is-cursor-hidden');
    if (this.laserCursorPos && this.isLaserActive && !isCursorHidden) {
      const { x, y } = this.laserCursorPos;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    const hasVisibleCursor = this.isLaserActive && this.laserCursorPos !== null && !isCursorHidden;
    if (this.laserPoints.length > 0 || hasVisibleCursor) {
      this.laserAnimId = requestAnimationFrame(() => this.drawLaser());
    }
  }

  public toggleLaserPointer(): void {
    this.isLaserActive = !this.isLaserActive;
    this.contentEl.toggleClass('is-laser-active', this.isLaserActive);
    this.laserBtn?.toggleClass('is-active', this.isLaserActive);

    this.showHudTemporarily();

    if (!this.isLaserActive) {
      this.clearLaserTrails();
      this.laserCursorPos = null;
      if (this.laserAnimId !== null) {
        cancelAnimationFrame(this.laserAnimId);
        this.laserAnimId = null;
      }
    } else {
      this.startLaserAnimation();
    }
  }

  private buildHud(container: HTMLElement): void {
    this.hudEl = container.createDiv({ cls: 'marp-presentation-hud' });
    this.hudCounterEl = this.hudEl.createDiv({
      cls: 'marp-presentation-hud-counter',
      text: 'Slide 1 / 1',
    });

    createIconButton(this.hudEl, 'marp-presentation-hud-btn', 'chevron-left', 'Previous Slide (Left Arrow)', (e) => {
      e.stopPropagation();
      this.session?.prev();
    });

    createIconButton(this.hudEl, 'marp-presentation-hud-btn', 'chevron-right', 'Next Slide (Right Arrow / Space)', (e) => {
      e.stopPropagation();
      this.session?.next();
    });

    this.laserBtn = createIconButton(this.hudEl, 'marp-presentation-hud-btn', 'target', 'Toggle Laser Pointer (L)', (e) => {
      e.stopPropagation();
      this.toggleLaserPointer();
    });

    createIconButton(this.hudEl, 'marp-presentation-hud-btn', 'presentation', 'Open Presenter View (P)', (e) => {
      e.stopPropagation();
      if (this.file) {
        void openPresenterView(this.app, this.plugin, this.file, {
          slideIndex: this.session?.currentSlide ?? 0,
        });
      }
    });

    createIconButton(this.hudEl, 'marp-presentation-hud-btn', 'maximize', 'Toggle Fullscreen (F)', (e) => {
      e.stopPropagation();
      this.toggleFullscreen();
    });

    createIconButton(this.hudEl, 'marp-presentation-hud-btn', 'x', 'Exit Presentation (Esc)', (e) => {
      e.stopPropagation();
      this.leaf.detach();
    });

    container.addEventListener('mousemove', () => this.showHudTemporarily());
    this.showHudTemporarily();
  }

  private showHudTemporarily(): void {
    if (!this.hudEl) return;
    this.hudEl.addClass('is-visible');
    this.contentEl.removeClass('is-cursor-hidden');
    if (this.isLaserActive) {
      this.startLaserAnimation();
    }
    if (this.hudHideTimeout) clearTimeout(this.hudHideTimeout);
    this.hudHideTimeout = setTimeout(() => {
      try {
        if (this.hudEl?.matches(':hover')) {
          this.showHudTemporarily();
          return;
        }
      } catch {}
      this.hudEl.removeClass('is-visible');
      this.contentEl.addClass('is-cursor-hidden');
      if (this.isLaserActive) {
        this.startLaserAnimation();
      }
    }, 2500);
  }

  private updateHud(): void {
    if (!this.hudCounterEl || !this.session) return;
    this.hudCounterEl.textContent = `Slide ${this.session.currentSlide + 1} / ${this.session.totalSlides}`;
  }

  private setupKeyboardNavigation(container: HTMLElement): void {
    const doc = container.ownerDocument || document;

    const handleKeydown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
        case 'Enter':
          e.preventDefault();
          this.session?.next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          this.session?.prev();
          break;
        case 'Home':
          e.preventDefault();
          this.session?.first();
          break;
        case 'End':
          e.preventDefault();
          this.session?.last();
          break;
        case 'b':
        case '.':
          e.preventDefault();
          this.session?.toggleBlackout();
          break;
        case 'w':
          e.preventDefault();
          this.session?.toggleWhiteout();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          this.toggleLaserPointer();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          if (this.file) {
            void openPresenterView(this.app, this.plugin, this.file, {
              slideIndex: this.session?.currentSlide ?? 0,
            });
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'Escape':
          e.preventDefault();
          if (this.isLaserActive) {
            this.toggleLaserPointer();
          } else {
            this.leaf.detach();
          }
          break;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (!this.session) return;
      if (!this.isPopout() && this.app.workspace.activeLeaf && this.app.workspace.activeLeaf !== this.leaf) {
        if (!this.containerEl.contains(doc.activeElement)) {
          return;
        }
      }
      if ((e as any)._marpHandled) return;
      (e as any)._marpHandled = true;
      handleKeydown(e);
    };

    doc.addEventListener('keydown', onKey);
    container.addEventListener('keydown', onKey);

    this.unsubs.push(() => {
      doc.removeEventListener('keydown', onKey);
      container.removeEventListener('keydown', onKey);
    });
  }

  private setupClickNavigation(container: HTMLElement): void {
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('.marp-presentation-hud')) return;
      if (this.session?.isBlackout || this.session?.isWhiteout) {
        this.session.clearBlank();
        return;
      }
      if (this.isLaserActive) return;

      const rect = container.getBoundingClientRect();
      if (e.clientX - rect.left > rect.width * 0.4) {
        this.session?.next();
      } else {
        this.session?.prev();
      }
    };

    container.addEventListener('click', handleClick);
    this.unsubs.push(() => container.removeEventListener('click', handleClick));
  }

  private setupTouchNavigation(container: HTMLElement): void {
    const onTouchStart = (e: TouchEvent) => {
      if (!this.isLaserActive && e.touches.length > 0) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (this.isLaserActive || e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 100) {
        if (dx < 0) this.session?.next();
        else this.session?.prev();
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    this.unsubs.push(() => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
    });
  }

  private setupAutoScaling(container: HTMLElement): void {
    const applyScale = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w > 0 && h > 0) {
        this.slideWrapperEl.style.transform = `translate(-50%, -50%) scale(${Math.min(w / SLIDE_W, h / SLIDE_H)})`;
        this.resizeLaserCanvas();
      }
    };

    this.resizeObserver = new ResizeObserver(() => requestAnimationFrame(applyScale));
    this.resizeObserver.observe(container);
    applyScale();
  }

  public isPopout(): boolean {
    const doc = this.containerEl.ownerDocument;
    return doc !== undefined && doc !== document;
  }

  public async enterFullscreen(): Promise<void> {
    try {
      const doc = this.containerEl.ownerDocument || document;
      if (!doc.fullscreenElement) {
        await this.containerEl.requestFullscreen();
      }
    } catch {}
  }

  public async exitFullscreen(): Promise<void> {
    try {
      const doc = this.containerEl.ownerDocument || document;
      if (doc.fullscreenElement) {
        await doc.exitFullscreen();
      }
    } catch {}
  }

  private toggleFullscreen(): void {
    const doc = this.containerEl.ownerDocument || document;
    if (!doc.fullscreenElement) {
      void this.enterFullscreen();
    } else {
      void this.exitFullscreen();
    }
  }

  private cleanup(): void {
    if (this.hudHideTimeout) clearTimeout(this.hudHideTimeout);
    if (this.laserAnimId !== null) cancelAnimationFrame(this.laserAnimId);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.session?.release();
    this.session = null;
  }
}
