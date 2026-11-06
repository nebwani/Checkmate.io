const moveSound = typeof Audio !== "undefined" ? new Audio("/MoveSound.mp3") : null;

export function playMoveSound() {
  if (!moveSound) return;
  moveSound.currentTime = 0;
  moveSound.play().catch(() => {});   // the browser may block autoplay; don't throw
}