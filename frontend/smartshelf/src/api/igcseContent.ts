/**
 * @deprecated Re-export study-agent catalog API. Prefer `@/src/api/igcseCatalog` directly.
 */
export {
  fetchIgcsSubjects,
  fetchIgcsChapters,
  fetchIgcsSetsForChapter,
  fetchIgcsSetDetail,
  pickPrimarySet,
} from '@/src/api/igcseCatalog';

export type {
  IgcseCatalogSubject,
  IgcseCatalogChapter,
  IgcseGeneratedSetSummary,
  IgcseGeneratedSetDetail,
} from '@/src/types/igcseCatalog';
