import type { TrackContextMenuAction } from "./TrackContextMenu";

export const CONTEXT_MENU_SEPARATOR: TrackContextMenuAction = {
  id: "__separator__",
  label: "",
  onSelect: () => {},
};
