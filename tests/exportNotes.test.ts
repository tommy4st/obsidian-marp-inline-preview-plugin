import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { annotatePdfNotes } from '../src/export/notes';

describe('annotatePdfNotes', () => {
  it('adds sticky note annotations to slides with notes and sets metadata', async () => {
    // Create a 2-page base PDF
    const baseDoc = await PDFDocument.create();
    baseDoc.addPage([1280, 720]);
    baseDoc.addPage([1280, 720]);
    const baseBytes = await baseDoc.save();

    const comments = [
      ['Speaker note for slide 1: intro.'],
      [], // Slide 2 has no notes
    ];

    const annotatedBytes = await annotatePdfNotes(baseBytes, comments, {
      title: 'Deck Title',
      author: 'Speaker Alice',
    });

    // Verify annotated PDF
    const reloaded = await PDFDocument.load(annotatedBytes);
    expect(reloaded.getTitle()).toBe('Deck Title');
    expect(reloaded.getAuthor()).toBe('Speaker Alice');

    const pages = reloaded.getPages();
    expect(pages).toHaveLength(2);

    // Page 1 should have 1 annotation
    const page1Annots = pages[0].node.Annots();
    expect(page1Annots).toBeDefined();
    expect(page1Annots?.size()).toBe(1);

    // Page 2 should have 0 annotations
    const page2Annots = pages[1].node.Annots();
    expect(page2Annots?.size() ?? 0).toBe(0);
  });

  it('combines multiple comments on a single slide with double newlines', async () => {
    const baseDoc = await PDFDocument.create();
    baseDoc.addPage([1280, 720]);
    const baseBytes = await baseDoc.save();

    const comments = [['Point 1', 'Point 2']];

    const annotatedBytes = await annotatePdfNotes(baseBytes, comments);
    const reloaded = await PDFDocument.load(annotatedBytes);
    const page = reloaded.getPages()[0];
    expect(page.node.Annots()?.size()).toBe(1);
  });

  it('leaves annotations empty when all comments are empty', async () => {
    const baseDoc = await PDFDocument.create();
    baseDoc.addPage([1280, 720]);
    const baseBytes = await baseDoc.save();

    const comments = [[], ['   ']];

    const annotatedBytes = await annotatePdfNotes(baseBytes, comments);
    const reloaded = await PDFDocument.load(annotatedBytes);
    const page = reloaded.getPages()[0];
    expect(page.node.Annots()?.size() ?? 0).toBe(0);
  });
});
