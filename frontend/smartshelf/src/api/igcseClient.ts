/**
 * @deprecated Use `@/src/api/igcseCatalog` for study-agent IGCSE content.
 * Legacy live-proxy helpers throw at runtime.
 */
export {
  fetchIgcsSubjects as getIGCSESubjects,
  fetchIgcsChapters as getIGCSEChapters,
  fetchIgcsSetsForChapter,
  fetchIgcsSetDetail,
} from '@/src/api/igcseCatalog';

const REMOVED =
  'This IGCSE endpoint was removed. Use igcseCatalog (chapters, sets) instead of the live Open IGCSE API.';

export async function getIGCSETopics(_subject: string): Promise<never> {
  throw new Error(REMOVED);
}

export async function getIGCSEQuestions(
  _subject: string,
  _topic: string,
  _options?: unknown
): Promise<never> {
  throw new Error(REMOVED);
}

export async function searchIGCSE(_query: string, _scopes?: string[]): Promise<never> {
  throw new Error(REMOVED);
}
