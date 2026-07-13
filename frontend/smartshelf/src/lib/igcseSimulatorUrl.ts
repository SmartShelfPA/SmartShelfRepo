/** Default public demo (override with EXPO_PUBLIC_IGCSE_SIMULATOR_BASE_URL). */
const DEFAULT_SIMULATOR_BASE = 'https://deepakp1308.github.io/igcse-study-agent/';

/** GitHub Pages (or local Vite preview) base for the static exam simulator. */
export function getIgcsSimulatorBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_IGCSE_SIMULATOR_BASE_URL?.trim();
  const base = (fromEnv || DEFAULT_SIMULATOR_BASE).trim();
  if (!base) return DEFAULT_SIMULATOR_BASE;
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Build a simulator URL for the in-app WebView.
 * @param setSlug e.g. `chemistry-the-mole` (from `simulator_set_id` / `?set=` on GitHub Pages)
 * @param explicitUrl Full URL from Django catalog when already published
 */
export function buildIgcsSimulatorUrl(setSlug?: string, explicitUrl?: string): string {
  const explicit = (explicitUrl ?? '').trim();
  const slug = (setSlug ?? '').trim();

  if (explicit) {
    if (slug && !/[?&]set=/i.test(explicit)) {
      const join = explicit.includes('?') ? '&' : '?';
      return `${explicit}${join}set=${encodeURIComponent(slug)}`;
    }
    return explicit;
  }

  const base = getIgcsSimulatorBaseUrl();
  if (!slug) return base;

  const join = base.includes('?') ? '&' : '?';
  return `${base}${join}set=${encodeURIComponent(slug)}`;
}

/** Hub tile default set from EXPO_PUBLIC_IGCSE_SIMULATOR_DEFAULT_SET. */
export function getIgcsSimulatorHubUrl(): string {
  const defaultSet = process.env.EXPO_PUBLIC_IGCSE_SIMULATOR_DEFAULT_SET?.trim();
  return buildIgcsSimulatorUrl(defaultSet || undefined);
}
