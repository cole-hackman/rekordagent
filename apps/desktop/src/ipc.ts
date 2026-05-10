import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export async function pickLibraryPath(): Promise<string | null> {
  const result = await open({
    title: "Locate master.db",
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
    multiple: false,
    directory: false,
  });
  if (result === null || result === undefined) return null;
  return typeof result === "string" ? result : null;
}

export async function validateLibraryPath(path: string): Promise<number> {
  return invoke<number>("validate_library_path", { path });
}

export async function getLibraryPath(): Promise<string | null> {
  return invoke<string | null>("get_library_path");
}

export async function setLibraryPath(path: string): Promise<void> {
  return invoke<void>("set_library_path", { path });
}
