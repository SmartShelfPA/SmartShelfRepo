export type FlatTocEntry = { href: string; label: string };

type EpubJsTocItem = {
  label?: string;
  href?: string;
  subitems?: EpubJsTocItem[];
};

export function flattenEpubToc(raw: unknown): FlatTocEntry[] {
  const out: FlatTocEntry[] = [];

  const walk = (items: unknown, depth: number) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const it = item as EpubJsTocItem;
      const label = typeof it.label === 'string' ? it.label : '';
      const href = typeof it.href === 'string' ? it.href : '';
      if (href.length > 0) {
        out.push({ href, label: label || `Section ${out.length + 1}` });
      }
      const children = (it as { children?: EpubJsTocItem[] }).children;
      const nested: EpubJsTocItem[] = Array.isArray(it.subitems)
        ? it.subitems
        : Array.isArray(children)
          ? children
          : [];
      if (nested.length > 0) {
        walk(nested, depth + 1);
      }
    });
  };

  walk(raw, 0);
  return out;
}
