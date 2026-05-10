import { useState, useEffect, useCallback } from "react";
import { playTrack, pauseAudio, resumeAudio } from "../ipc";
import type { Track } from "../types";

export function useAudioPlayer(selectedTrack: Track | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  const play = useCallback(async (track: Track) => {
    if (!track.folder_path) return;
    try {
      await playTrack(track.folder_path);
      setIsPlaying(true);
      setCurrentPath(track.folder_path);
    } catch (e) {
      console.error("play error", e);
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await pauseAudio();
      setIsPlaying(false);
    } catch (e) {
      console.error("pause error", e);
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      await resumeAudio();
      setIsPlaying(true);
    } catch (e) {
      console.error("resume error", e);
    }
  }, []);

  const toggleCurrent = useCallback(async () => {
    if (!selectedTrack) return;
    if (currentPath !== selectedTrack.folder_path) {
      await play(selectedTrack);
    } else if (isPlaying) {
      await pause();
    } else {
      await resume();
    }
  }, [selectedTrack, currentPath, isPlaying, play, pause, resume]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      e.preventDefault();
      void toggleCurrent();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCurrent]);

  const isCurrentTrack = useCallback(
    (track: Track) =>
      track.folder_path !== null && track.folder_path === currentPath,
    [currentPath],
  );

  return { isPlaying, currentPath, play, pause, resume, toggleCurrent, isCurrentTrack };
}
