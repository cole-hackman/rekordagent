import { create } from "zustand";

interface AppState {
  libraryPath: string | null;
  trackCount: number | null;
  setLibraryConfigured: (path: string, trackCount: number) => void;
  clearLibrary: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  libraryPath: null,
  trackCount: null,
  setLibraryConfigured: (path, trackCount) => set({ libraryPath: path, trackCount }),
  clearLibrary: () => set({ libraryPath: null, trackCount: null }),
}));
