"use client";

import { useState, useCallback } from "react";
import { sweep } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type SweepPoint = {
  range_km: number;
  condition: string;
  dc_power_kw: number;
  elec_input_kw: number;
  system_eff_pct: number;
  fuel_saved_l_day: number;
};

const CONDITION_COLORS: Record<string, string> = {
  clear: "#4ade80",
  haze: "#facc15",
  smoke: "#f97316",
  rain: "#60a5fa",
  drizzle: "#a78bfa",
  light_rain: "#60a5fa",
  moderate_rain: "#3b82f6",
  heavy_rain: "#1d4ed8",
};

function pivotData(data: SweepPoint[], metric: keyof SweepPoint) {
  const byRange: Record<number, Record<string, number>> = {};
  const conditions = new Set<string>();

  for (const pt of data) {
    if (!byRange[pt.range_km]) byRange[pt.range_km] = { range_km: pt.range_km };
    byRange[pt.range_km][pt.condition] = pt[metric] as number;
    conditions.add(pt.condition);
  }

  return {
    rows: Object.values(byRange).sort((a, b) => a.range_km - b.range_km),
    conditions: Array.from(conditions),
  };
}

export default function SweepPage() {
  const [mode, setMode] = useState<"laser" | "microwave">("laser");
  const [powerKw, setPowerKw] = useState(5);
  const [metric, setMetric] = useState<keyof SweepPoint>("system_eff_pct");
  const [data, setData] = useState<SweepPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSweep = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await sweep(mode, powerKw);
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [mode, powerKw]);

  const metricLabels: Record<string, string> = {
    system_eff_pct: "System Efficiency (%)",
    dc_power_kw: "DC Power Delivered (kW)",
    fuel_saved_l_day: "Fuel Saved (L/day)",
    elec_input_kw: "Electrical Input (kW)",
  };

  const { rows, conditions } = data.length ? pivotData(data, metric) : { rows: [], conditions: [] };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Range Sweep Analysis</h1>
        <p className="text-gray-400 mt-1">
          System performance vs. range for all atmospheric conditions
        </p>
        <div className="h-px bg-gradient-to-r from-blue-500 via-purple-500 to-transparent mt-4" />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 flex flex-wrap gap-6 items-end">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Mode</label>
          <div className="flex gap-2">
            {(["laser", "microwave"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
            Power Target: <span className="text-white font-mono">{powerKw} kW</span>
          </label>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={powerKw}
            onChange={(e) => setPowerKw(Number(e.target.value))}
            className="w-48 accent-blue-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Y-Axis Metric</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as keyof SweepPoint)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {Object.entries(metricLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <button
          onClick={runSweep}
          disabled={loading}
          className="py-2 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all text-sm uppercase tracking-wider"
        >
          {loading ? "⟳ Sweeping..." : "▶ Run Sweep"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 text-red-400 text-sm mb-6">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-4">
          {metricLabels[metric]} vs Range — All Conditions
        </h2>

        {rows.length === 0 && !loading && (
          <div className="flex items-center justify-center h-64 text-gray-600">
            <p>Run a sweep to see results</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p className="animate-pulse font-mono">Computing range sweep...</p>
          </div>
        )}

        {rows.length > 0 && !loading && (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={rows} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="range_km"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                label={{ value: "Range (km)", position: "insideBottom", offset: -5, fill: "#6b7280" }}
              />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 6 }}
                labelStyle={{ color: "#9ca3af" }}
                labelFormatter={(v) => `${v} km`}
              />
              <Legend wrapperStyle={{ color: "#9ca3af" }} />
              {conditions.map((cond) => (
                <Line
                  key={cond}
                  type="monotone"
                  dataKey={cond}
                  stroke={CONDITION_COLORS[cond] || "#888"}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name={cond}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data table */}
      {rows.length > 0 && !loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-6 overflow-auto">
          <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-4">Raw Data</h2>
          <table className="w-full text-sm text-left font-mono">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                <th className="pb-2 pr-4">Range km</th>
                {conditions.map((c) => (
                  <th key={c} className="pb-2 pr-4" style={{ color: CONDITION_COLORS[c] }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-1.5 pr-4 text-white">{row.range_km}</td>
                  {conditions.map((c) => (
                    <td key={c} className="py-1.5 pr-4 text-gray-300">
                      {row[c] != null ? (row[c] as number).toFixed(2) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
