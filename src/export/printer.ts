/**
 * Programmatically renders an HTML document inside an isolated Electron <webview>
 * and prints it to a PDF buffer using Chromium's native print engine.
 */
export async function printHtmlToPdf(
  fullHtml: string,
  timeoutMs = 30000,
): Promise<Uint8Array> {
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

    // Write the document HTML and wait for fonts + images
    await webview.executeJavaScript(`
      document.open();
      document.write(${JSON.stringify(fullHtml)});
      document.close();
    `);

    // Ensure custom web fonts (KaTeX, Google fonts) and images are fully decoded
    await webview.executeJavaScript(`
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        ...Array.from(document.images).map(img =>
          img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
        )
      ])
    `);

    // Brief delay to ensure styles and SVG layouts have computed
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
