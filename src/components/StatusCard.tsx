"use client";

import { useState } from "react";
import { METRICS, type MetricKey } from "@/lib/config";
import { sendCommand, type AiStatus, type Forecast, type WaterChange } from "@/lib/data";
import { daysFromNow, fmtDayDate, LEVEL_STYLE, type Level, type MetricEval } from "@/lib/format";
import { Button, Modal } from "./ui";

export interface WatchItem {
  level: Level;
  text: string;
}

export default function StatusCard({ evals, extraItems, ai, tdsForecast, waterChange, estopOn, now }: {
  evals: Record<MetricKey, MetricEval>;
  extraItems: WatchItem[];
  ai: AiStatus | null;
  tdsForecast: Forecast | null;
  waterChange: WaterChange | null;
  estopOn: boolean;
  now: number;
}) {
  const [pending, setPending] = useState<null | "feed" | "water_change">(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");

  const items: WatchItem[] = [];
  for (const key of Object.keys(evals) as MetricKey[]) {
    const e = evals[key];
    const name = METRICS[key].label === "pH" ? "pH" : METRICS[key].label;
    if (e.level === "bad") items.push({ level: "bad", text: `${name} is ${e.tag.toLowerCase()}` });
    else if (e.level === "watch") items.push({ level: "watch", text: `${name} is ${e.tag.toLowerCase()}` });
    else if (e.level === "unknown") items.push({ level: "watch", text: `${name} sensor has no signal` });
  }
  items.push(...extraItems);
  if (ai?.anomaly) items.push({ level: "watch", text: "AI found unusual readings" });

  // No water reading at all -> we cannot say the tank is healthy.
  const noData = Object.values(evals).every((e) => e.level === "unknown");
  const level: Level = noData
    ? "unknown"
    : items.some((i) => i.level === "bad") ? "bad" : items.length ? "watch" : "good";
  const headline = {
    good: "Your tank is healthy",
    watch: "Your tank is healthy",
    bad: "Your tank needs attention",
    unknown: "No readings from the sensor node",
  }[level];

  const reachAt = tdsForecast?.reach_at;
  const limit = tdsForecast?.limit ?? METRICS.tds.safeHi;

  async function run() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      await sendCommand(pending);
      setSent(pending === "feed" ? "Feed command sent to the gateway" : "Water change requested");
      setPending(null);
      setTimeout(() => setSent(""), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const tone = {
    good: "from-sky-50 to-emerald-50 border-emerald-200/70",
    watch: "from-sky-50 to-amber-50 border-amber-200/70",
    bad: "from-rose-50 to-orange-50 border-rose-200",
    unknown: "from-slate-50 to-slate-100 border-slate-200",
  }[level];

  return (
    <section className={`grid gap-6 rounded-2xl border bg-gradient-to-br p-6 md:grid-cols-[1fr_auto] ${tone}`}>
      <div>
        <p className="text-xs font-semibold tracking-wider text-slate-500">TANK STATUS</p>
        <h2 className={`mt-1 text-2xl font-bold tracking-tight ${level === "bad" ? "text-rose-700" : "text-slate-900"}`}>
          {estopOn ? "Emergency stop is on" : headline}
        </h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-700">
          {noData ? (
            "Check that the sensor node is powered on and its probes are plugged in. Readings appear here as soon as the gateway receives them."
          ) : items.length === 0 ? (
            "All readings are in the safe range."
          ) : (
            <>
              {items.length === 1 ? "1 thing" : `${items.length} things`} to keep an eye on:{" "}
              {items.map((it, i) => (
                <span key={i}>
                  <b className={LEVEL_STYLE[it.level].text}>{it.text}</b>
                  {i < items.length - 2 ? ", " : i === items.length - 2 ? " and " : "."}
                </span>
              ))}
            </>
          )}{" "}
          {ai?.summary
            ? ai.summary
            : ai && ai.anomaly === false
              ? "AI found no unusual readings in the last 24 hours."
              : null}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setPending("feed")} disabled={estopOn}>
            Feed now
          </Button>
          <Button onClick={() => setPending("water_change")} disabled={estopOn || waterChange?.running}>
            {waterChange?.running ? `Water change: ${waterChange.step ?? "running"}…` : "Change water now"}
          </Button>
          {sent && <span className="self-center text-sm text-emerald-700">✓ {sent}</span>}
        </div>
      </div>

      <div className="min-w-[220px] rounded-xl bg-white/80 p-4 ring-1 ring-slate-200/70">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-wider text-slate-500">NEXT WATER CHANGE</p>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200">
            AI forecast
          </span>
        </div>
        {reachAt ? (
          <>
            <p className="mt-2 text-2xl font-bold text-slate-900">{fmtDayDate(reachAt)}</p>
            <p className="mt-1 text-sm text-slate-600">
              {daysFromNow(reachAt, now)}, when TDS reaches {limit} ppm
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-lg font-semibold text-slate-400">No forecast yet</p>
            <p className="mt-1 text-sm text-slate-500">
              {tdsForecast ? `TDS stays below ${limit} ppm for the forecast period` : "The AI forecast has not run yet"}
            </p>
          </>
        )}
      </div>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending === "feed" ? "Feed the fish now?" : "Start a water change now?"}
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="primary" onClick={run} disabled={busy}>
              {busy ? "Sending…" : pending === "feed" ? "Feed now" : "Start"}
            </Button>
          </>
        }
      >
        {pending === "feed"
          ? "The feeder drops one portion. This counts towards today's feeding."
          : "The drain pump removes about 20% of the water, then the refill pump tops it up from the fresh-water tank. It stops by itself if the water level sensor sees a problem."}
        {error && <p className="mt-3 text-rose-600">Could not send: {error}</p>}
      </Modal>
    </section>
  );
}
