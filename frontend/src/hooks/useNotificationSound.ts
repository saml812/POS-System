import { useCallback, useEffect, useRef } from "react";

export function useNotificationSound() {
  const soundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const sound = new Audio("/sounds/notif.mp3");
    sound.preload = "auto";
    soundRef.current = sound;

    const unlock = () => {
      sound
        .play()
        .then(() => {
          sound.pause();
          sound.currentTime = 0;
        })
        .catch(() => {});
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const playNotificationSound = useCallback(() => {
    const sound = soundRef.current;
    if (!sound) return;

    sound.currentTime = 0;
    void sound.play().catch(() => {});
  }, []);

  return { playNotificationSound };
}
