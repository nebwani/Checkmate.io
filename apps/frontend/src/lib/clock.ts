export type ClockState = {
  white: number;                 // ms left, as of syncedAt
  black: number;
  turn: "w" | "b" | null;        // whose clock is ticking; null = nobody
  syncedAt: number;              // local Date.now() when this snapshot was taken
};

export function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Freeze both clocks at their true value as of `now`.
export function settleClock(c: ClockState, now: number, flagged?: "w" | "b"): ClockState {
  const elapsed = now - c.syncedAt;
  return {
    white: flagged === "w" ? 0 : c.turn === "w" ? Math.max(0, c.white - elapsed) : c.white,
    black: flagged === "b" ? 0 : c.turn === "b" ? Math.max(0, c.black - elapsed) : c.black,
    turn: null,
    syncedAt: now,
  };
}