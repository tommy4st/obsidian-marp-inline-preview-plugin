import { describe, it, expect } from 'vitest';
import { buildExportHtml, escapeHtml } from '../src/export/template';

describe('buildExportHtml', () => {
  const dummyHtml = '<div class="marpit"><svg>Slide 1</svg><svg>Slide 2</svg></div>';
  const dummyCss = '@page { size: 1280px 720px; } section { color: red; }';

  it('renders complete standalone HTML with title, css, and html', () => {
    const html = buildExportHtml(dummyHtml, dummyCss, 'Test Deck & Presentation');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Deck &amp; Presentation</title>');
    expect(html).toContain(dummyCss);
    expect(html).toContain(dummyHtml);
  });

  it('uses default title when title is omitted', () => {
    const html = buildExportHtml(dummyHtml, dummyCss);
    expect(html).toContain('<title>Marp Slide Deck</title>');
  });

  it('properly escapes malicious titles', () => {
    const html = buildExportHtml(dummyHtml, dummyCss, '<script>alert(1)</script> & "fun"');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;fun&quot;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('escapeHtml escapes all HTML entities', () => {
    expect(escapeHtml('<div class="a" id=\'b\'>&</div>')).toBe(
      '&lt;div class=&quot;a&quot; id=&#39;b&#39;&gt;&amp;&lt;/div&gt;',
    );
  });
});
