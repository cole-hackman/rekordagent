import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptAllSafe,
  acceptChange,
  exportAcceptedChanges,
  listChanges,
  rejectAll,
  rejectChange,
} from "../ipc";
import type { StagedChange } from "../agent/types";

export function useStagedChanges(libraryPath: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["staged-changes", libraryPath];

  const query = useQuery<StagedChange[], Error>({
    queryKey,
    queryFn: () => listChanges(libraryPath),
    enabled: libraryPath !== null,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["staged-changes"] });

  const acceptOne = useMutation({
    mutationFn: acceptChange,
    onSuccess: invalidate,
  });
  const rejectOne = useMutation({
    mutationFn: rejectChange,
    onSuccess: invalidate,
  });
  const acceptSafe = useMutation({
    mutationFn: () => acceptAllSafe(libraryPath),
    onSuccess: invalidate,
  });
  const rejectProposed = useMutation({
    mutationFn: () => rejectAll(libraryPath),
    onSuccess: invalidate,
  });
  const exportAccepted = useMutation({
    mutationFn: () => exportAcceptedChanges(libraryPath!),
    onSuccess: invalidate,
  });

  return {
    ...query,
    acceptChange: acceptOne.mutate,
    rejectChange: rejectOne.mutate,
    acceptAllSafe: acceptSafe.mutate,
    rejectAll: rejectProposed.mutate,
    exportAcceptedChanges: exportAccepted.mutate,
    exportResult: exportAccepted.data ?? null,
    isMutating:
      acceptOne.isPending ||
      rejectOne.isPending ||
      acceptSafe.isPending ||
      rejectProposed.isPending ||
      exportAccepted.isPending,
  };
}
