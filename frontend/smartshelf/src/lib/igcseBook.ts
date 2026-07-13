import type { ProtectedPdfAsset } from '@/src/api/protectedPdfs';
import { addBook, getBookById, type Book } from '@/src/store/books';

export function igcseBookId(assetId: string): string {
  return `igcse:${assetId}`;
}

export function isIgcsCollectionBookId(bookId: string): boolean {
  return bookId.startsWith('igcse:');
}

export function igcseAssetIdFromBookId(bookId: string): string | null {
  return isIgcsCollectionBookId(bookId) ? bookId.slice('igcse:'.length) : null;
}

export function protectedPdfToBook(asset: ProtectedPdfAsset): Book {
  return {
    id: igcseBookId(asset.id),
    title: asset.title,
    subject: asset.subject || 'IGCSE',
    examTags: ['IGCSE'],
    igcseAssetId: asset.id,
  };
}

/** Ensure the IGCSE asset exists in the shared books store (for collections). */
export function ensureIgcsBookInStore(asset: ProtectedPdfAsset): Book {
  const book = protectedPdfToBook(asset);
  const existing = getBookById(book.id);
  if (!existing) {
    addBook(book);
    return book;
  }
  return existing;
}
