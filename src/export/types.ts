export type ImageQualityPreset = 'original' | 'high' | 'medium' | 'low';

export interface PdfExportOptions {
  includeNotes: boolean;
  imageQuality: ImageQualityPreset;
  targetPath: string;
  openAfterExport: boolean;
}
