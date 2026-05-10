import { create } from "zustand";

interface AppState {
  libraryPath: string | null;
  trackCount: number | null;
  theme: "dark" | "light";
  setLibraryConfigured: (path: string, trackCount: number) => void;
  clearLibrary: () => void;
  setTheme: (theme: "dark" | "light") => void;
}

export const useAppStore = create<AppState>((set) => ({
  libraryPath: null,
  trackCount: null,
  theme: "dark",
  setLibraryConfigured: (path, trackCount) => set({ libraryPath: path, trackCount }),
  clearLibrary: () => set({ libraryPath: null, trackCount: null }),
  setTheme: (theme) => set({ theme }),
}));
