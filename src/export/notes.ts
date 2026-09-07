import { PDFDocument, PDFHexString, PDFString } from 'pdf-lib';

export interface MetadataOptions {
  title?: string;
  author?: string;
}

/**
 * Embeds presenter notes as standard PDF text annotations (/Subtype /Text)
 * on each slide page that contains notes, matching marp-cli --pdf-notes behavior.
 */
export async function annotatePdfNotes(
  pdfBuffer: Uint8Array,
  comments: string[][],
  metadata?: MetadataOptions,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  if (metadata?.title) {
    pdfDoc.setTitle(metadata.title);
  }
  if (metadata?.author) {
    pdfDoc.setAuthor(metadata.author);
  }

  for (let i = 0; i < pages.length; i++) {
    const slideNotes = comments[i]?.join('\n\n').trim();
    if (!slideNotes) continue;

    const noteAnnot = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [20, 20, 40, 40],
      Contents: PDFHexString.fromText(slideNotes),
      Name: 'Comment',
      Subj: PDFString.of('Presenter Note'),
      T: metadata?.author ? PDFHexString.fromText(metadata.author) : undefined,
      C: [1, 0.92, 0.42], // Yellow icon
    });

    pages[i].node.addAnnot(pdfDoc.context.register(noteAnnot));
  }

  return await pdfDoc.save();
}
