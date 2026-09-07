export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds a standalone HTML document string with Marp's print CSS for webview printing.
 */
export function buildExportHtml(html: string, css: string, title?: string): string {
  const docTitle = escapeHtml(title || 'Marp Slide Deck');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <style>
    ${css}
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}
