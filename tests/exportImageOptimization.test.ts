import { describe, it, expect } from 'vitest';
import { QUALITY_PRESETS } from '../src/export/printer';
import type { ImageQualityPreset } from '../src/export/types';

describe('Image Optimization Quality Presets', () => {
  it('defines valid dimensions and quality ratios for high, medium, and low', () => {
    expect(QUALITY_PRESETS.high.maxDimension).toBe(3840);
    expect(QUALITY_PRESETS.high.quality).toBe(0.85);

    expect(QUALITY_PRESETS.medium.maxDimension).toBe(1920);
    expect(QUALITY_PRESETS.medium.quality).toBe(0.8);

    expect(QUALITY_PRESETS.low.maxDimension).toBe(1280);
    expect(QUALITY_PRESETS.low.quality).toBe(0.7);
  });

  it('preserves ordering such that high > medium > low in dimension and quality', () => {
    expect(QUALITY_PRESETS.high.maxDimension).toBeGreaterThan(
      QUALITY_PRESETS.medium.maxDimension,
    );
    expect(QUALITY_PRESETS.medium.maxDimension).toBeGreaterThan(
      QUALITY_PRESETS.low.maxDimension,
    );

    expect(QUALITY_PRESETS.high.quality).toBeGreaterThan(
      QUALITY_PRESETS.medium.quality,
    );
    expect(QUALITY_PRESETS.medium.quality).toBeGreaterThan(
      QUALITY_PRESETS.low.quality,
    );
  });

  it('all quality settings are between 0.1 and 1.0', () => {
    const presets: Exclude<ImageQualityPreset, 'original'>[] = [
      'high',
      'medium',
      'low',
    ];
    for (const preset of presets) {
      const cfg = QUALITY_PRESETS[preset];
      expect(cfg.quality).toBeGreaterThan(0);
      expect(cfg.quality).toBeLessThanOrEqual(1);
      expect(cfg.maxDimension).toBeGreaterThan(500);
    }
  });
});
