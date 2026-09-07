import type { ImageQualityPreset } from './types';

export interface ImageOptimizationConfig {
  maxDimension: number;
  quality: number;
}

export const QUALITY_PRESETS: Record<
  Exclude<ImageQualityPreset, 'original'>,
  ImageOptimizationConfig
> = {
  high: { maxDimension: 3840, quality: 0.85 },
  medium: { maxDimension: 1920, quality: 0.8 },
  low: { maxDimension: 1280, quality: 0.7 },
};

export interface PrintPdfOptions {
  imageQuality?: ImageQualityPreset;
  timeoutMs?: number;
}

/**
 * Programmatically renders an HTML document inside an isolated Electron <webview>
 * and prints it to a PDF buffer using Chromium's native print engine.
 */
export async function printHtmlToPdf(
  fullHtml: string,
  options: PrintPdfOptions = {},
): Promise<Uint8Array> {
  const timeoutMs = options.timeoutMs ?? 30000;
  const qualityPreset = options.imageQuality ?? 'original';
  const optimization =
    qualityPreset !== 'original' ? QUALITY_PRESETS[qualityPreset] : null;

  // @ts-expect-error webview tag is provided by Electron in Obsidian Desktop
  const webview: HTMLElement & {
    executeJavaScript(code: string): Promise<unknown>;
    printToPDF(options: Record<string, unknown>): Promise<Buffer | Uint8Array>;
  } = document.createElement('webview');

  webview.setAttribute('src', 'app://obsidian.md/help.html');
  webview.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:1280px;height:720px;visibility:hidden;pointer-events:none;';

  document.body.appendChild(webview);

  try {
    // Wait for the webview to complete its initial about/app load
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for webview to initialize'));
      }, timeoutMs);

      const onDomReady = () => {
        cleanup();
        resolve();
      };

      const onFail = (e: unknown) => {
        cleanup();
        const msg = (e as { errorDescription?: string })?.errorDescription ?? 'unknown error';
        reject(new Error(`Webview failed to load: ${msg}`));
      };

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        webview.removeEventListener('dom-ready', onDomReady);
        webview.removeEventListener('did-fail-load', onFail);
      };

      webview.addEventListener('dom-ready', onDomReady);
      webview.addEventListener('did-fail-load', onFail);
    });

    // Write the document HTML
    await webview.executeJavaScript(`
      document.open();
      document.write(${JSON.stringify(fullHtml)});
      document.close();
    `);

    // Wait for initial images to finish loading
    await webview.executeJavaScript(`
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        ...Array.from(document.images).map(img =>
          img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
        )
      ])
    `);

    // Perform in-webview pre-print image optimization if requested
    if (optimization) {
      await webview.executeJavaScript(`
        (async () => {
          const maxDim = ${optimization.maxDimension};
          const quality = ${optimization.quality};

          function isSvg(src) {
            return !src || src.startsWith('data:image/svg') || /\\.svg([?#].*)?$/i.test(src);
          }

          function resizeImg(img) {
            if (!img.naturalWidth || !img.naturalHeight) return;
            if (isSvg(img.src)) return;

            const w = img.naturalWidth;
            const h = img.naturalHeight;
            if (w <= maxDim && h <= maxDim && quality >= 1.0) return;

            const scale = Math.min(1, maxDim / Math.max(w, h));
            const targetW = Math.max(1, Math.round(w * scale));
            const targetH = Math.max(1, Math.round(h * scale));

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, targetW, targetH);

            try {
              img.src = canvas.toDataURL('image/jpeg', quality);
            } catch (e) {
              // Canvas tainted or not allowed; keep original image
            }
          }

          // 1. Optimize <img> elements
          for (const img of Array.from(document.querySelectorAll('img'))) {
            resizeImg(img);
          }

          // 2. Optimize background images (Marp ![bg] syntax)
          const bgElements = Array.from(document.querySelectorAll('[style*="background-image"], [data-background-image]'));
          for (const el of bgElements) {
            const styleAttr = el.getAttribute('style') || '';
            const match = /url\\((['"]?)(.*?)\\1\\)/i.exec(styleAttr);
            if (!match) continue;
            const url = match[2];
            if (isSvg(url) || url.startsWith('data:image/jpeg')) continue;

            await new Promise((resolve) => {
              const temp = new Image();
              temp.crossOrigin = 'anonymous';
              temp.onload = () => {
                try {
                  const w = temp.naturalWidth;
                  const h = temp.naturalHeight;
                  if (w > maxDim || h > maxDim || quality < 1.0) {
                    const scale = Math.min(1, maxDim / Math.max(w, h));
                    const targetW = Math.max(1, Math.round(w * scale));
                    const targetH = Math.max(1, Math.round(h * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(temp, 0, 0, targetW, targetH);
                      const dataUrl = canvas.toDataURL('image/jpeg', quality);
                      el.style.backgroundImage = 'url("' + dataUrl + '")';
                    }
                  }
                } catch (e) {}
                resolve();
              };
              temp.onerror = () => resolve();
              temp.src = url;
            });
          }

          // Ensure updated images have settled
          await Promise.all(
            Array.from(document.images).map(img =>
              img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
            )
          );
        })()
      `);
    }

    // Ensure fonts and layouts are settled
    await webview.executeJavaScript(`document.fonts ? document.fonts.ready : Promise.resolve()`);
    await new Promise((r) => setTimeout(r, 150));

    // Print to PDF with Chromium's print engine
    const buffer = await webview.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });

    return new Uint8Array(buffer);
  } finally {
    webview.remove();
  }
}
