import { useCallback, useEffect, useState } from 'react';

import { fetchIgcsSubjects } from '@/src/api/igcseCatalog';
import { fetchIgcsTextbooks } from '@/src/api/igcseBooks';
import type { IgcseCatalogSubject } from '@/src/types/igcseCatalog';
import type { IgcsTextbook } from '@/src/types/igcse';

export function useIgcsShelfHub() {
  const [books, setBooks] = useState<IgcsTextbook[]>([]);
  const [subjects, setSubjects] = useState<IgcseCatalogSubject[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setBooksLoading(true);
    setSubjectsLoading(true);
    setBooksError(null);
    setSubjectsError(null);

    const [booksResult, subjectsResult] = await Promise.allSettled([
      fetchIgcsTextbooks(),
      fetchIgcsSubjects(),
    ]);

    if (booksResult.status === 'fulfilled') {
      setBooks(booksResult.value);
    } else {
      setBooks([]);
      setBooksError(
        booksResult.reason instanceof Error
          ? booksResult.reason.message
          : 'Failed to load textbooks'
      );
    }

    if (subjectsResult.status === 'fulfilled') {
      setSubjects(subjectsResult.value);
    } else {
      setSubjects([]);
      setSubjectsError(
        subjectsResult.reason instanceof Error
          ? subjectsResult.reason.message
          : 'Failed to load study resources'
      );
    }

    setBooksLoading(false);
    setSubjectsLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loading = booksLoading && subjectsLoading;
  const hasAnyContent = books.length > 0 || subjects.length > 0;
  const allFailed =
    !booksLoading &&
    !subjectsLoading &&
    Boolean(booksError) &&
    Boolean(subjectsError) &&
    !hasAnyContent;

  return {
    books,
    subjects,
    booksLoading,
    subjectsLoading,
    booksError,
    subjectsError,
    loading,
    hasAnyContent,
    allFailed,
    refetch,
    booksEmpty: !booksLoading && !booksError && books.length === 0,
    subjectsEmpty: !subjectsLoading && !subjectsError && subjects.length === 0,
  };
}
