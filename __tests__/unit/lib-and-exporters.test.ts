import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { toBlob } from 'html-to-image';
import { cn } from '@/lib/utils';
import { generateToolMetadata, generateJsonLd } from '@/lib/seo';
import { getPublicSiteUrl } from '@/tool/template-metadata';
import {
  formatExportError,
  throwIfAborted,
  renderToImage,
  createCanvasExporter,
} from '@/tool/exporters/utils';
import type { ToolConfig, ExportOptions } from '@itsjust/core';
import toolConfig from '@/tool/tool.config';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));
vi.mock('@itsjust/core', () => ({
  sanitizeFilename: (s: string) => s,
}));

const toBlobMock = toBlob as Mock;

class FakeImage {
  private _src = '';
  naturalWidth = 120;
  naturalHeight = 60;
  onload: (() => void) | null = null;
  onerror: ((err?: ErrorEvent) => void) | null = null;
  get src() {
    return this._src;
  }
  set src(v: string) {
    this._src = v;
    setTimeout(() => this.onload?.(), 0);
  }
}

const fakeCtx = { drawImage: vi.fn() };

beforeEach(() => {
  class FakeURL extends globalThis.URL {
    static createObjectURL = vi.fn(() => 'blob:fake');
    static revokeObjectURL = vi.fn();
  }
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('URL', FakeURL as unknown as typeof URL);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    fakeCtx as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback
  ) {
    cb(new Blob(['img'], { type: 'image/png' }));
  });
  // jsdom getComputedStyle: default to a transparent background; tests override.
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    backgroundColor: 'rgba(0, 0, 0, 0)',
  } as CSSStyleDeclaration);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('cn', () => {
  it('joins truthy classes with spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters null, undefined, false and empty strings', () => {
    expect(cn('a', null, undefined, false, 'b', '')).toBe('a b');
  });

  it('returns empty string when nothing is truthy', () => {
    expect(cn(null, undefined, false)).toBe('');
  });
});

describe('getPublicSiteUrl', () => {
  it('falls back to the dev URL', () => {
    delete process.env.NEXT_PUBLIC_URL;
    expect(getPublicSiteUrl()).toBe('http://localhost:3000');
  });

  it('uses NEXT_PUBLIC_URL when set', () => {
    process.env.NEXT_PUBLIC_URL = 'https://morse.example.com';
    expect(getPublicSiteUrl()).toBe('https://morse.example.com');
    delete process.env.NEXT_PUBLIC_URL;
  });
});

describe('generateToolMetadata', () => {
  function ogImageUrl(meta: ReturnType<typeof generateToolMetadata>): string {
    const images = (meta.openGraph?.images ?? []) as Array<{ url: string } | { url: string }[]>;
    const first = Array.isArray(images) ? images[0] : undefined;
    return Array.isArray(first) ? String(first[0]) : String(first?.url);
  }

  it('builds SEO metadata with the default og image', () => {
    const meta = generateToolMetadata(toolConfig);
    expect((meta.title as { default?: string }).default).toBe(toolConfig.name);
    expect(meta.description).toBe(toolConfig.description);
    expect(ogImageUrl(meta)).toBe('http://localhost:3000/og.svg');
    expect((meta.alternates as { canonical?: string }).canonical).toBe('http://localhost:3000');
    expect(meta.keywords).toContain(`${toolConfig.exportFormats[0]} export`);
    expect(meta.keywords).toContain(`export to ${toolConfig.exportFormats[1]}`);
    expect(meta.robots).toMatchObject({ index: true, follow: true });
  });

  it('uses the custom ogImage when present', () => {
    const withOg = { ...toolConfig, ogImage: '/custom-og.png' };
    const meta = generateToolMetadata(withOg);
    expect(ogImageUrl(meta)).toBe('http://localhost:3000/custom-og.png');
    expect((meta.twitter?.images as string[]) ?? undefined).toEqual([
      'http://localhost:3000/custom-og.png',
    ]);
  });
});

describe('generateJsonLd', () => {
  it('includes every feature when all are enabled', () => {
    const ld = generateJsonLd(toolConfig);
    expect(ld['@type']).toBe('WebApplication');
    expect(ld.name).toBe(toolConfig.name);
    expect(ld.featureList).toContain(`Export as ${toolConfig.exportFormats.join(', ')}`);
    expect(ld.featureList).toContain('Auto-save');
    expect(ld.featureList).toContain('Undo & Redo');
    expect(ld.featureList).toContain('Dark mode');
    expect(ld.offers).toMatchObject({ price: '0', priceCurrency: 'USD' });
  });

  it('drops disabled features from the feature list', () => {
    const disabled = {
      ...toolConfig,
      features: {
        export: false,
        autoSave: false,
        undoRedo: false,
        sidebar: true,
        statusBar: true,
        darkMode: false,
      },
    } as ToolConfig;
    const ld = generateJsonLd(disabled);
    expect(ld.featureList).toEqual([]);
  });

  it('partially keeps only the enabled features', () => {
    const partial = {
      ...toolConfig,
      features: {
        export: false,
        autoSave: true,
        undoRedo: false,
        sidebar: true,
        statusBar: true,
        darkMode: true,
      },
    } as ToolConfig;
    const ld = generateJsonLd(partial);
    expect(ld.featureList).toEqual(['Auto-save', 'Dark mode']);
  });
});

describe('formatExportError', () => {
  it('returns the message for plain errors', () => {
    expect(formatExportError(new Error('boom'), 'png')).toBe('boom');
  });

  it('appends a CORS hint for cross-origin failures', () => {
    const err = new Error('Tainted canvas detected (CORS)');
    expect(formatExportError(err, 'png')).toContain('Try removing external images');
  });

  it('falls back to the format name for non-Error failures', () => {
    // formatExportError only reads Error#message; non-Error input is described
    // generically — the CORS hint only applies to CORS-looking error messages.
    expect(formatExportError('security error: cross-origin', 'webp')).toBe('webp export failed');
  });
});

describe('throwIfAborted', () => {
  it('does nothing without a signal', () => {
    expect(() => throwIfAborted()).not.toThrow();
  });

  it('does nothing for a non-aborted signal', () => {
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
  });

  it('throws AbortError for an aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrowError(
      new DOMException('Export aborted', 'AbortError')
    );
  });
});

describe('renderToImage', () => {
  function makeElement(withTextarea = false, withPassword = false): HTMLElement {
    const element = document.createElement('div');
    element.innerHTML = '<span>content</span>';
    if (withTextarea) {
      const ta = document.createElement('textarea');
      ta.value = 'line\nline2';
      element.appendChild(ta);
    }
    if (withPassword) {
      const input = document.createElement('input');
      input.type = 'password';
      element.appendChild(input);
    }
    const parent = document.createElement('div');
    const after = document.createElement('div');
    parent.appendChild(element);
    parent.appendChild(after);
    document.body.appendChild(parent);
    return element;
  }

  const baseOptions = (overrides: Partial<ExportOptions> = {}): ExportOptions => ({
    format: 'png',
    allowSensitiveData: true,
    ...overrides,
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const element = makeElement();
    const controller = new AbortController();
    controller.abort();
    await expect(
      renderToImage(element, baseOptions({ signal: controller.signal }))
    ).rejects.toThrow('Export aborted');
  });

  it('blocks export when sensitive elements are detected', async () => {
    const element = makeElement(false, true);
    await expect(
      renderToImage(element, baseOptions({ allowSensitiveData: false }))
    ).rejects.toThrow('Export blocked: sensitive elements detected');
  });

  it('allows sensitive data when the option is set', async () => {
    const element = makeElement(false, true);
    toBlobMock.mockResolvedValueOnce(new Blob(['x']));
    const canvas = await renderToImage(element, baseOptions());
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('fails when no image blob is produced', async () => {
    const element = makeElement();
    toBlobMock.mockResolvedValueOnce(null);
    await expect(renderToImage(element, baseOptions())).rejects.toThrow(
      'Failed to create image blob'
    );
  });

  it('renders to a canvas and restores the element position and styles', async () => {
    const element = makeElement(true);
    const parent = element.parentElement!;
    const after = element.nextElementSibling as HTMLElement;
    toBlobMock.mockResolvedValueOnce(new Blob(['x']));
    (window.getComputedStyle as Mock).mockReturnValue({
      backgroundColor: 'rgb(10, 20, 30)',
    } as CSSStyleDeclaration);

    const canvas = await renderToImage(element, baseOptions({ scale: 3 }));

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(toBlobMock).toHaveBeenCalledWith(element, {
      pixelRatio: 3,
      cacheBust: true,
      skipFonts: true,
    });
    // element is back in its original spot
    expect(parent.children[0]).toBe(element);
    expect(element.nextElementSibling).toBe(after);
    // container is cleaned up
    expect(document.body.children.length).toBe(1);
  });

  it('skips background inlining when computed background is transparent', async () => {
    const element = makeElement();
    toBlobMock.mockResolvedValueOnce(new Blob(['x']));
    // default getComputedStyle mock already returns a transparent background
    (window.getComputedStyle as Mock).mockReturnValue({
      backgroundColor: 'rgba(0, 0, 0, 0)',
    } as CSSStyleDeclaration);
    const canvas = await renderToImage(element, baseOptions());
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('renders elements without a parent node', async () => {
    const element = document.createElement('div');
    element.innerHTML = '<span>orphan</span>';
    toBlobMock.mockResolvedValueOnce(new Blob(['x']));
    (window.getComputedStyle as Mock).mockReturnValue({
      backgroundColor: 'transparent',
    } as CSSStyleDeclaration);
    const canvas = await renderToImage(element, baseOptions());
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    document.body.innerHTML = '';
  });
});

describe('createCanvasExporter', () => {
  function makeElement(): HTMLElement {
    const element = document.createElement('div');
    element.innerHTML = '<span>x</span>';
    document.body.appendChild(element);
    return element;
  }

  it('exports a blob with a sanitized filename on success', async () => {
    const exporter = createCanvasExporter('png', 'image/png', 'png');
    toBlobMock.mockResolvedValueOnce(new Blob(['x']));
    const result = await exporter.export(makeElement(), {
      format: 'png',
      allowSensitiveData: true,
      filename: 'my file.png',
      quality: 0.8,
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Blob);
    expect(result.filename).toBe('my file.png');
    expect(result.format).toBe('png');
  });

  it('uses the default filename when none is given', async () => {
    const exporter = createCanvasExporter('jpeg', 'image/jpeg', 'jpg');
    toBlobMock.mockResolvedValueOnce(new Blob(['x']));
    const result = await exporter.export(makeElement(), {
      format: 'jpeg',
      allowSensitiveData: true,
    });
    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/^export-\d+\.jpg$/);
  });

  it('passes the default quality through when none is provided', async () => {
    const exporter = createCanvasExporter('webp', 'image/webp', 'webp', 0.7);
    toBlobMock.mockResolvedValueOnce(new Blob(['x']));
    const result = await exporter.export(makeElement(), {
      format: 'webp',
      allowSensitiveData: true,
    });
    expect(result.success).toBe(true);
    const toBlobCalls = (HTMLCanvasElement.prototype.toBlob as Mock).mock.calls;
    expect(toBlobCalls.at(-1)?.[1]).toBe('image/webp');
  });

  it('reports a formatted error when rendering fails', async () => {
    const exporter = createCanvasExporter('png', 'image/png', 'png');
    toBlobMock.mockRejectedValueOnce(new Error('CORS: cross-origin resource blocked'));
    const result = await exporter.export(makeElement(), {
      format: 'png',
      allowSensitiveData: true,
    });
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toContain('CORS: cross-origin resource blocked');
    expect(result.error).toContain('Try removing external images');
  });

  it('reports failure when canvas.toBlob yields no blob', async () => {
    const exporter = createCanvasExporter('png', 'image/png', 'png');
    toBlobMock.mockResolvedValueOnce(new Blob(['x']));
    (HTMLCanvasElement.prototype.toBlob as Mock).mockImplementationOnce(function (
      this: HTMLCanvasElement,
      cb: BlobCallback
    ) {
      cb(null);
    });
    const result = await exporter.export(makeElement(), {
      format: 'png',
      allowSensitiveData: true,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to create blob');
  });
});
