"use client";

import { useMemo } from "react";

const TUTOR_BACKGROUNDS = [
  "/tutor-backgrounds/HF0aS-wWQAAv3Jj.jpeg",
  "/tutor-backgrounds/HF4WSpPWIAAe0iD.jpeg",
  "/tutor-backgrounds/HF9M6VnbcAA4U-h.jpeg",
  "/tutor-backgrounds/HF-EhUVWEAA5if8.jpeg",
  "/tutor-backgrounds/HFqZHfCWMAAnAAA.jpeg",
  "/tutor-backgrounds/HFvJQ7Ta8AArf5R.jpeg",
  "/tutor-backgrounds/HFvnuvVbQAA2SDn.jpeg",
  "/tutor-backgrounds/HGbluisWAAAJ0Ph.jpeg",
  "/tutor-backgrounds/HGCA0zubAAEX0no.jpeg",
  "/tutor-backgrounds/HGDMJJrW4AA7PJn.jpeg",
  "/tutor-backgrounds/HGEyY6eXYAEG6n5.jpeg",
  "/tutor-backgrounds/HGG93FKWcAA3LgA.jpeg",
  "/tutor-backgrounds/HGGzQt4XwAAyUsf.jpeg",
  "/tutor-backgrounds/HGHQJOtWgAAOGtm.jpeg",
  "/tutor-backgrounds/HGKAWi6WgAAV7wr.jpeg",
];

/**
 * Picks a random background image once per mount and renders it as a
 * faint, heavily-blurred layer — like looking through frosted glass.
 * Covers the entire tutor panel. The image is chosen once per session
 * start (component mount) and stays fixed.
 */
export function TutorBackground() {
  const src = useMemo(
    () => TUTOR_BACKGROUNDS[Math.floor(Math.random() * TUTOR_BACKGROUNDS.length)],
    [],
  );

  return (
    <div className="tutor-bg" aria-hidden="true">
      <img
        src={src}
        alt=""
        // Eager decode — these are decorative and shouldn't lazy-load
        // since they're immediately visible.
        decoding="async"
        className="tutor-bg-img"
      />
    </div>
  );
}
