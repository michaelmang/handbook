"use client";

import { useEffect, useMemo, useRef } from "react";
import type {
  ImportProgressEvent,
  ImportProgressPhase,
} from "@/lib/import/import-progress";

interface StepDef {
  phase: ImportProgressPhase;
  label: string;
}

const STEPS: StepDef[] = [
  { phase: "read", label: "Load document" },
  { phase: "extract", label: "Render document" },
  { phase: "done", label: "Ready to capture" },
];

function stepIndex(phase: ImportProgressPhase): number {
  if (phase === "done" || phase === "error") return STEPS.length;
  const idx = STEPS.findIndex((s) => s.phase === phase);
  return idx === -1 ? 0 : idx;
}

function hapticTick(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(8);
    } catch {
      /* ignore */
    }
  }
}

export function DocxImportProgress({
  events,
  active,
}: {
  events: ImportProgressEvent[];
  active: boolean;
}) {
  const lastEvent = events[events.length - 1];
  const currentPhase = lastEvent?.phase ?? "read";
  const activeIdx = stepIndex(currentPhase);
  const vibratedRef = useRef<Set<string>>(new Set());

  const eventsByPhase = useMemo(() => {
    const map = new Map<ImportProgressPhase, ImportProgressEvent>();
    for (const e of events) {
      map.set(e.phase, e);
    }
    return map;
  }, [events]);

  useEffect(() => {
    if (!active) return;
    for (const e of events) {
      if (e.status !== "complete") continue;
      const key = `${e.phase}:complete`;
      if (vibratedRef.current.has(key)) continue;
      vibratedRef.current.add(key);
      hapticTick();
    }
  }, [events, active]);

  const chunkEvent = eventsByPhase.get("pass_a");
  const chunkPct =
    chunkEvent?.current != null &&
    chunkEvent.total != null &&
    chunkEvent.total > 0
      ? Math.round((chunkEvent.current / chunkEvent.total) * 100)
      : null;

  const overallPct = Math.min(
    100,
    Math.round(((activeIdx + (lastEvent?.status === "complete" ? 1 : 0.35)) / STEPS.length) * 100)
  );

  return (
    <div
      className="overflow-hidden rounded-xl border border-stone-200/80 bg-gradient-to-b from-stone-50 to-white shadow-sm"
      role="status"
      aria-live="polite"
      aria-busy={active}
    >
      <div className="border-b border-stone-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-stone-800">
            {lastEvent?.message ?? "Preparing import…"}
          </p>
          <span className="shrink-0 font-mono text-xs tabular-nums text-stone-400">
            {overallPct}%
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-200/80">
          <div
            className="h-full rounded-full bg-stone-800 transition-all duration-500 ease-out"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        {lastEvent?.detail && (
          <p className="mt-2 text-xs text-stone-500 animate-pulse">
            {lastEvent.detail}
          </p>
        )}
      </div>

      <ol className="px-4 py-3">
        {STEPS.map((step, i) => {
          const event = eventsByPhase.get(step.phase);
          const isDone =
            i < activeIdx ||
            (i === activeIdx && event?.status === "complete");
          const isActive = i === activeIdx && !isDone;
          const isPending = i > activeIdx;

          return (
            <li
              key={step.phase}
              className="relative flex gap-3 pb-3 last:pb-0"
            >
              {i < STEPS.length - 1 && (
                <span
                  className={`absolute left-[9px] top-5 h-[calc(100%-12px)] w-px ${
                    isDone ? "bg-stone-300" : "bg-stone-200"
                  }`}
                  aria-hidden
                />
              )}
              <StepIcon done={isDone} active={isActive} pending={isPending} />
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={`text-sm leading-tight ${
                    isActive
                      ? "font-medium text-stone-900"
                      : isDone
                        ? "text-stone-600"
                        : "text-stone-400"
                  }`}
                >
                  {step.label}
                  {step.phase === "pass_a" &&
                    isActive &&
                    chunkEvent?.current != null &&
                    chunkEvent.total != null && (
                      <span className="ml-2 font-mono text-xs text-stone-400">
                        {chunkEvent.current}/{chunkEvent.total}
                      </span>
                    )}
                </p>
                {event?.detail && (isActive || isDone) && (
                  <p className="mt-0.5 truncate text-xs text-stone-500">
                    {event.detail}
                  </p>
                )}
                {step.phase === "pass_a" && isActive && chunkPct != null && (
                  <div className="mt-1.5 h-0.5 max-w-[8rem] overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full rounded-full bg-stone-500 transition-all duration-300"
                      style={{ width: `${chunkPct}%` }}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepIcon({
  done,
  active,
  pending,
}: {
  done: boolean;
  active: boolean;
  pending: boolean;
}) {
  if (done) {
    return (
      <span className="relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-stone-800 text-white">
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (active) {
    return (
      <span className="relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-stone-400/30" />
        <span className="relative h-[18px] w-[18px] rounded-full border-2 border-stone-800 border-t-transparent animate-spin" />
      </span>
    );
  }

  return (
    <span
      className={`relative z-10 h-[18px] w-[18px] shrink-0 rounded-full border ${
        pending ? "border-stone-200 bg-stone-50" : "border-stone-300 bg-white"
      }`}
    />
  );
}
