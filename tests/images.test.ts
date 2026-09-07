import { describe, it, expect } from 'vitest';
import { rewriteImageSrcs, rewriteCssUrls } from '../src/util/images';
import { MarpEngine } from '../src/marp/engine';
import { TFile, normalizePath } from './obsidian-stub';

function makeMockApp(existingFiles: Record<string, string>) {
  return {
    vault: {
      getAbstractFileByPath: (p: string) => {
        const norm = normalizePath(p);
        if (norm in existingFiles) {
          const file = new TFile();
          Object.assign(file, { path: norm });
          return file;
        }
        return null;
      },
      adapter: {
        getResourcePath: (p: string) => existingFiles[p] ?? `app://local/${p}`,
      },
    },
    metadataCache: {
      getFirstLinkpathDest: (linkpath: string, _sourcePath: string) => {
        for (const p of Object.keys(existingFiles)) {
          if (p === linkpath || p.endsWith('/' + linkpath)) {
            const file = new TFile();
            Object.assign(file, { path: p });
            return file;
          }
        }
        return null;
      },
    },
  } as any;
}

describe('images url rewrite', () => {
  const mockFiles = {
    'attachments/test-image.svg': 'app://local/attachments/test-image.svg?1710000000',
    'attachments/photo.jpg': 'app://local/attachments/photo.jpg?1710000000',
    'attachments/space name.png': 'app://local/attachments/space%20name.png?1710000000',
    'slides/local.png': 'app://local/slides/local.png?1710000000',
  };
  const app = makeMockApp(mockFiles);
  const sourcePath = 'slides/deck.md';

  describe('rewriteImageSrcs: inline <img> tags', () => {
    it('rewrites vault-relative img src to Obsidian resource path', () => {
      const html = '<p><img src="../attachments/test-image.svg" alt="test" /></p>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        '<p><img src="app://local/attachments/test-image.svg?1710000000" alt="test" /></p>',
      );
    });

    it('resolves bare filenames via metadataCache fallback', () => {
      const html = '<img src="photo.jpg" alt="photo" />';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        '<img src="app://local/attachments/photo.jpg?1710000000" alt="photo" />',
      );
    });

    it('leaves external https URLs untouched', () => {
      const html = '<img src="https://example.com/logo.svg" alt="logo" />';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(html);
    });

    it('leaves data: URIs untouched', () => {
      const html = '<img src="data:image/png;base64,iVBORw0KGgo=" alt="data" />';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(html);
    });

    it('rewrites other media elements like <video> and <audio>', () => {
      const html = '<video src="../attachments/photo.jpg"></video><audio src="../attachments/photo.jpg"></audio>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        '<video src="app://local/attachments/photo.jpg?1710000000"></video><audio src="app://local/attachments/photo.jpg?1710000000"></audio>',
      );
    });
  });

  describe('rewriteImageSrcs: background images (![bg])', () => {
    it('rewrites standard Marp background figure style', () => {
      const html = '<figure style="background-image:url(&quot;../attachments/test-image.svg&quot;);"></figure>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        '<figure style="background-image:url(&quot;app://local/attachments/test-image.svg?1710000000&quot;);"></figure>',
      );
    });

    it('preserves filters, sizing, and other inline styles', () => {
      const html =
        '<figure style="background-image:url(&quot;../attachments/test-image.svg&quot;);background-size:contain;filter:blur(5px);"></figure>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        '<figure style="background-image:url(&quot;app://local/attachments/test-image.svg?1710000000&quot;);background-size:contain;filter:blur(5px);"></figure>',
      );
    });

    it('rewrites multiple background figures', () => {
      const html =
        '<figure style="background-image:url(&quot;../attachments/test-image.svg&quot;);"></figure>' +
        '<figure style="background-image:url(&quot;photo.jpg&quot;);"></figure>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        '<figure style="background-image:url(&quot;app://local/attachments/test-image.svg?1710000000&quot;);"></figure>' +
          '<figure style="background-image:url(&quot;app://local/attachments/photo.jpg?1710000000&quot;);"></figure>',
      );
    });

    it('rewrites directive backgrounds on section and data-background-image', () => {
      const html =
        '<section data-background-image="url(&quot;../attachments/test-image.svg&quot;)" ' +
        'style="--background-image:url(&quot;../attachments/test-image.svg&quot;);background-image:url(&quot;../attachments/test-image.svg&quot;);background-size:cover;">' +
        '<h1>Slide</h1></section>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        '<section data-background-image="url(&quot;app://local/attachments/test-image.svg?1710000000&quot;)" ' +
          'style="--background-image:url(&quot;app://local/attachments/test-image.svg?1710000000&quot;);background-image:url(&quot;app://local/attachments/test-image.svg?1710000000&quot;);background-size:cover;">' +
          '<h1>Slide</h1></section>',
      );
    });

    it('handles unquoted url(...) in styles', () => {
      const html = '<div style="background-image:url(../attachments/test-image.svg);"></div>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        '<div style="background-image:url(&quot;app://local/attachments/test-image.svg?1710000000&quot;);"></div>',
      );
    });

    it('handles single-quoted url(...) in styles', () => {
      const html = "<div style=\"background-image:url('../attachments/test-image.svg');\"></div>";
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        "<div style=\"background-image:url('app://local/attachments/test-image.svg?1710000000');\"></div>",
      );
    });

    it('handles URL-encoded spaces in path', () => {
      const html = '<figure style="background-image:url(&quot;../attachments/space%20name.png&quot;);"></figure>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(
        '<figure style="background-image:url(&quot;app://local/attachments/space%20name.png?1710000000&quot;);"></figure>',
      );
    });

    it('leaves external URLs in background untouched', () => {
      const html = '<figure style="background-image:url(&quot;https://example.com/bg.jpg&quot;);"></figure>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(html);
    });

    it('leaves data URIs in background untouched', () => {
      const html = '<figure style="background-image:url(&quot;data:image/png;base64,...&quot;);"></figure>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(html);
    });

    it('leaves SVG fragment IDs in background untouched', () => {
      const html = '<div style="fill:url(#grad);"></div>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(html);
    });

    it('does not alter url(...) in pre/code blocks or paragraph text', () => {
      const html =
        '<p>Reference url("../attachments/test-image.svg") in text</p>' +
        '<pre><code>background: url("../attachments/test-image.svg");</code></pre>';
      const result = rewriteImageSrcs(html, sourcePath, app);
      expect(result).toBe(html);
    });
  });

  describe('rewriteCssUrls: CSS stylesheets', () => {
    it('rewrites relative url(...) in raw CSS', () => {
      const css = 'section { background-image: url("../attachments/test-image.svg"); }';
      const result = rewriteCssUrls(css, sourcePath, app);
      expect(result).toBe(
        'section { background-image: url("app://local/attachments/test-image.svg?1710000000"); }',
      );
    });

    it('leaves external and data URIs in CSS untouched', () => {
      const css = '@import url("https://fonts.example.com/font.css"); mask: url(\'data:image/svg+xml,...\');';
      const result = rewriteCssUrls(css, sourcePath, app);
      expect(result).toBe(css);
    });
  });

  describe('end-to-end integration with MarpEngine', () => {
    const engine = new MarpEngine({ math: 'katex' });

    it('resolves ![bg] rendered HTML', () => {
      const md = '![bg](../attachments/test-image.svg)\n\n# Slide Title';
      const { html } = engine.renderArray(md);
      expect(html).toHaveLength(1);

      const rewritten = rewriteImageSrcs(html[0], sourcePath, app);
      expect(rewritten).toContain('background-image:url(&quot;app://local/attachments/test-image.svg?1710000000&quot;)');
      expect(rewritten).not.toContain('background-image:url(&quot;../attachments/test-image.svg&quot;)');
    });

    it('resolves ![bg right:40% fit] rendered HTML', () => {
      const md = '![bg right:40% fit](../attachments/test-image.svg)\n\n# Split';
      const { html } = engine.renderArray(md);
      expect(html).toHaveLength(1);

      const rewritten = rewriteImageSrcs(html[0], sourcePath, app);
      expect(rewritten).toContain('background-image:url(&quot;app://local/attachments/test-image.svg?1710000000&quot;)');
      expect(rewritten).toContain('background-size:contain');
    });

    it('resolves both inline and background images in the same deck', () => {
      const md =
        '![bg](../attachments/test-image.svg)\n\n# Slide 1\n\n---\n\n# Slide 2\n\n![inline](photo.jpg)';
      const { html } = engine.renderArray(md);
      expect(html).toHaveLength(2);

      const s1 = rewriteImageSrcs(html[0], sourcePath, app);
      const s2 = rewriteImageSrcs(html[1], sourcePath, app);

      expect(s1).toContain('background-image:url(&quot;app://local/attachments/test-image.svg?1710000000&quot;)');
      expect(s2).toContain('<img src="app://local/attachments/photo.jpg?1710000000" alt="inline" />');
    });
  });
});
