import { useEffect, useState } from "react";
import { formatTime } from "../lib/clock";

type ClockProps = {
  baseMs: number;      // time left as of the last server sync
  running: boolean;    // is this side's clock ticking?
  syncedAt: number;    // local Date.now() when baseMs was received
};

export const Clock = ({ baseMs, running, syncedAt }: ClockProps) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  const ms = running ? baseMs - (now - syncedAt) : baseMs;
  return (
    <div className="px-4 py-2 bg-gray-900 rounded-lg border border-gray-600 text-lg font-mono">
      {formatTime(ms)}
    </div>
  );
};