import { create } from 'zustand';

type DesktopChromeState = {
  searchOpen: boolean;
  sidebarCollapsed: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
};

export const useDesktopChromeStore = create<DesktopChromeState>((set) => ({
  searchOpen: false,
  sidebarCollapsed: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
