import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

type Props = {
  /** When set, shows remaining time and ends session at 0 */
  countdownSeconds?: number | null;
  /** When false, timer stays at 00:00 and does not tick (e.g. while questions are loading). */
  running?: boolean;
  paused?: boolean;
  onComplete?: () => void;
};

export function PracticeTimer({ countdownSeconds, paused, running = true, onComplete }: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    setElapsedSec(0);
    firedRef.current = false;
  }, [countdownSeconds]);

  useEffect(() => {
    if (!running) {
      setElapsedSec(0);
      firedRef.current = false;
    }
  }, [running]);

  useEffect(() => {
    if (!running || paused) return undefined;
    const id = setInterval(() => setElapsedSec((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [running, paused]);

  const remaining = useMemo(() => {
    if (countdownSeconds == null || countdownSeconds <= 0) return null;
    return Math.max(0, countdownSeconds - elapsedSec);
  }, [countdownSeconds, elapsedSec]);

  useEffect(() => {
    if (remaining !== 0 || countdownSeconds == null || countdownSeconds <= 0) return;
    if (firedRef.current) return;
    firedRef.current = true;
    onComplete?.();
  }, [remaining, countdownSeconds, onComplete]);

  const label = useMemo(() => {
    if (remaining != null) {
      return `Time left ${formatClock(remaining)}`;
    }
    return `Elapsed ${formatClock(elapsedSec)}`;
  }, [remaining, elapsedSec]);

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.text} type="defaultSemiBold">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 13,
  },
});
