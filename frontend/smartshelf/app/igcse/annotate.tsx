import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** On web/desktop the pen, highlighter and note tools live inside the PDF reader itself. */
export default function AnnotatePdfWebFallback() {
  const router = useRouter();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/igcse');
  }, [router]);
  return null;
}
