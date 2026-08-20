import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { useAuthStore } from '@/src/store/auth';
import { useDesktopChromeStore } from '@/src/store/desktopChrome';

type NavItem = {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  href: Href;
  match: (path: string) => boolean;
};

const STUDENT_ITEMS: NavItem[] = [
  {
    key: 'home',
    label: 'Home',
    icon: 'home',
    href: '/(tabs)',
    match: (p) => p === '/' || p === '/(tabs)' || p.endsWith('/(tabs)') || p === '/(tabs)/index',
  },
  {
    key: 'shelf',
    label: 'My Shelf',
    icon: 'menu-book',
    href: '/(tabs)/bookshelf',
    match: (p) => p.includes('bookshelf') || p.startsWith('/shelf/'),
  },
  {
    key: 'downloads',
    label: 'Downloads',
    icon: 'download-done',
    href: '/downloads',
    match: (p) => p.includes('/downloads'),
  },
  {
    key: 'igcse',
    label: 'IGCSE',
    icon: 'auto-stories',
    href: '/igcse',
    match: (p) => p.startsWith('/igcse'),
  },
  {
    key: 'practice',
    label: 'Practice',
    icon: 'edit-note',
    href: '/practice/waec',
    match: (p) => p.startsWith('/practice'),
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'person',
    href: '/(tabs)/profile',
    match: (p) => p.includes('profile') || p.includes('privacy'),
  },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.key === 'home') {
    return (
      pathname === '/' ||
      pathname === '/(tabs)' ||
      pathname === '/(tabs)/index' ||
      pathname.endsWith('/(tabs)') ||
      (pathname.length > 0 &&
        !STUDENT_ITEMS.some((other) => other.key !== 'home' && other.match(pathname)))
    );
  }
  return item.match(pathname);
}

export function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const user = useAuthStore((s) => s.user);
  const collapsed = useDesktopChromeStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useDesktopChromeStore((s) => s.toggleSidebar);
  const openSearch = useDesktopChromeStore((s) => s.openSearch);

  const role = user?.role;
  const items =
    role === 'staff' || role === 'parent'
      ? STUDENT_ITEMS.filter((item) => item.key === 'home' || item.key === 'profile').map((item) =>
          item.key === 'home'
            ? {
                ...item,
                href: (role === 'staff' ? '/teacher' : '/parent') as Href,
                match: (p: string) => p.includes(role === 'staff' ? '/teacher' : '/parent'),
              }
            : item
        )
      : STUDENT_ITEMS;

  return (
    <View style={[styles.rail, collapsed && styles.railCollapsed]}>
      <TouchableOpacity
        style={styles.brand}
        onPress={() => router.push(items[0]?.href ?? '/(tabs)')}
        activeOpacity={0.85}>
        <Image
          source={require('@/assets/images/ss-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        {collapsed ? null : (
          <ThemedText style={styles.brandText} numberOfLines={1}>
            SmartShelf
          </ThemedText>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.searchBtn} onPress={openSearch} activeOpacity={0.85}>
        <MaterialIcons name="search" size={20} color="#f2f2f2" />
        {collapsed ? null : (
          <ThemedText style={styles.searchLabel} numberOfLines={1}>
            Search  ⌘K
          </ThemedText>
        )}
      </TouchableOpacity>

      <View style={styles.nav}>
        {items.map((item) => {
          const active = isActive(item, pathname);
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => router.push(item.href)}
              activeOpacity={0.85}
              accessibilityLabel={item.label}>
              <MaterialIcons name={item.icon} size={22} color={active ? '#00FF41' : '#cfcfcf'} />
              {collapsed ? null : (
                <ThemedText style={[styles.itemLabel, active && styles.itemLabelActive]} numberOfLines={1}>
                  {item.label}
                </ThemedText>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.collapse} onPress={toggleSidebar} activeOpacity={0.85}>
        <MaterialIcons
          name={collapsed ? 'chevron-right' : 'chevron-left'}
          size={22}
          color="#9a9a9a"
        />
        {collapsed ? null : (
          <ThemedText style={styles.collapseLabel}>Collapse  ⌘B</ThemedText>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 232,
    backgroundColor: '#181818',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#2a2a2a',
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  railCollapsed: {
    width: 72,
    paddingHorizontal: 8,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  logo: { width: 28, height: 28 },
  brandText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  searchLabel: { color: '#bdbdbd', fontSize: 13, fontWeight: '600' },
  nav: { flex: 1, gap: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  itemActive: { backgroundColor: '#242424' },
  itemLabel: { color: '#d6d6d6', fontSize: 14, fontWeight: '700' },
  itemLabelActive: { color: '#00FF41' },
  collapse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  collapseLabel: { color: '#8d8d8d', fontSize: 12, fontWeight: '600' },
});
