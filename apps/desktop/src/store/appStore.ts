import { create } from "zustand";

interface AppState {
  libraryPath: string | null;
  trackCount: number | null;
  theme: "dark" | "light";
  sidebarCollapsed: boolean;
  setLibraryConfigured: (path: string, trackCount: number) => void;
  clearLibrary: () => void;
  setTheme: (theme: "dark" | "light") => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  libraryPath: null,
  trackCount: null,
  theme: "dark",
  sidebarCollapsed: false,
  setLibraryConfigured: (path, trackCount) => set({ libraryPath: path, trackCount }),
  clearLibrary: () => set({ libraryPath: null, trackCount: null }),
  setTheme: (theme) => set({ theme }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
