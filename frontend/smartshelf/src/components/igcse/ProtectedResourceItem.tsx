import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import type { ProtectedPdfAsset } from '@/src/api/protectedPdfs';
import { ProtectedPdfCard } from '@/src/components/igcse/ProtectedPdfCard';
import { useKitTheme } from '@/src/components/ui/kit';
import { useProtectedPdfDownload } from '@/src/hooks/useProtectedPdfDownload';

/** A protected PDF row that downloads on first tap and opens in the reader afterwards. */
export function ProtectedResourceItem({ asset }: { asset: ProtectedPdfAsset }) {
  const router = useRouter();
  const t = useKitTheme();
  const { status, error, download, remove, prepareOpen } = useProtectedPdfDownload(asset);

  const open = useCallback(async () => {
    if (status !== 'done' && status !== 'expired') {
      void download();
      return;
    }
    const result = await prepareOpen();
    if (result.ok) {
      router.push({
        pathname: '/igcse/pdf-reader',
        params: { localUri: result.localUri, bookId: asset.id, title: asset.title },
      } as unknown as Href);
    } else if (result.reason === 'stale' || result.reason === 'not_downloaded') {
      void download();
    } else {
      Alert.alert('Cannot open', result.message);
    }
  }, [status, download, prepareOpen, router, asset.id, asset.title]);

  return (
    <ProtectedPdfCard
      asset={asset}
      status={status}
      error={error}
      onPrimary={open}
      onDownload={() => void download()}
      onRemove={() => void remove()}
      textColor={t.text}
      mutedColor={t.muted}
      tintColor={t.tint}
      cardBg={t.card}
      tagBg={t.border}
    />
  );
}
