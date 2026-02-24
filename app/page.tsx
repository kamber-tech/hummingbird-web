"use client";

import { useState } from "react";
import { simulate } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type SimResult = {
  mode: string;
  range_km: number;
  condition: string;
  dc_power_delivered_kw: number;
  electrical_input_kw: number;
  system_efficiency_pct: number;
  wpt_coverage_pct: number;
  fuel_saved_l_day: number;
  fuel_saved_l_yr: number;
  fuel_cost_saved_yr_usd: number;
  gen_hours_saved_yr: number;
  convoys_eliminated_yr: number;
  convoy_cost_saved_yr_usd: number;
  total_value_yr_usd: number;
  target_power_kw: number;
};

type CompareResult = {
  mode: "compare";
  laser: SimResult;
  microwave: SimResult;
};

function fmt(n: number, digits = 1) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(digits)}k`;
  return n.toFixed(digits);
}

function MetricCard({
  label,
  value,
  unit,
  color = "text-green-400",
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="metric-card transition-all">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-mono font-bold ${color}`}>
        {value}
        {unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: SimResult }) {
  const chartData = [
    { name: "DC Delivered", value: result.dc_power_delivered_kw, fill: "#4ade80" },
    { name: "Elec Input", value: result.electrical_input_kw, fill: "#60a5fa" },
  ];

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-400 font-mono uppercase tracking-widest">
        ── {result.mode.toUpperCase()} @ {result.range_km.toFixed(1)} km | {result.condition} ──
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="DC Delivered"
          value={result.dc_power_delivered_kw.toFixed(2)}
          unit="kW"
          color="text-green-400"
        />
        <MetricCard
          label="System Efficiency"
          value={result.system_efficiency_pct.toFixed(1)}
          unit="%"
          color="text-blue-400"
        />
        <MetricCard
          label="Fuel Saved"
          value={result.fuel_saved_l_day.toFixed(1)}
          unit="L/day"
          color="text-yellow-400"
        />
        <MetricCard
          label="FOB Coverage"
          value={result.wpt_coverage_pct.toFixed(0)}
          unit="%"
          color="text-purple-400"
        />
        <MetricCard
          label="Convoys Eliminated"
          value={result.convoys_eliminated_yr.toFixed(0)}
          unit="/yr"
          color="text-red-400"
        />
        <MetricCard
          label="Total Value"
          value={`$${fmt(result.total_value_yr_usd)}`}
          unit="/yr"
          color="text-orange-400"
        />
      </div>

      {/* Mini power chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Power Balance (kW)</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 6 }}
              labelStyle={{ color: "#9ca3af" }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Savings breakdown */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-sm space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Annual Savings Breakdown</div>
        <div className="flex justify-between">
          <span className="text-gray-400">Fuel cost saved</span>
          <span className="text-green-400 font-mono">${result.fuel_cost_saved_yr_usd.toLocaleString(undefined, {maximumFractionDigits: 0})}/yr</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Convoy cost saved</span>
          <span className="text-green-400 font-mono">${result.convoy_cost_saved_yr_usd.toLocaleString(undefined, {maximumFractionDigits: 0})}/yr</span>
        </div>
        <div className="flex justify-between border-t border-gray-700 pt-2">
          <span className="text-gray-200 font-medium">Total value</span>
          <span className="text-orange-400 font-mono font-bold">${result.total_value_yr_usd.toLocaleString(undefined, {maximumFractionDigits: 0})}/yr</span>
        </div>
      </div>
    </div>
  );
}

function ComparePanel({ result }: { result: CompareResult }) {
  const compData = [
    { name: "Efficiency %", laser: result.laser.system_efficiency_pct, microwave: result.microwave.system_efficiency_pct },
    { name: "DC Delivered kW", laser: result.laser.dc_power_delivered_kw, microwave: result.microwave.dc_power_delivered_kw },
    { name: "Fuel L/day", laser: result.laser.fuel_saved_l_day, microwave: result.microwave.fuel_saved_l_day },
  ];

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-400 font-mono uppercase tracking-widest">── LASER vs MICROWAVE COMPARISON ──</div>

      <div className="grid grid-cols-2 gap-3">
        {(["laser", "microwave"] as const).map((m) => {
          const r = result[m];
          return (
            <div key={m} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
              <div className={`text-xs font-mono mb-2 ${m === "laser" ? "text-blue-400" : "text-purple-400"}`}>
                {m.toUpperCase()}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Efficiency</span>
                  <span className="font-mono">{r.system_efficiency_pct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">DC Power</span>
                  <span className="font-mono">{r.dc_power_delivered_kw.toFixed(2)} kW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Value/yr</span>
                  <span className="font-mono text-green-400">${fmt(r.total_value_yr_usd)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Side-by-Side Metrics</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={compData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 6 }}
            />
            <Bar dataKey="laser" fill="#60a5fa" name="Laser" radius={[2, 2, 0, 0]} />
            <Bar dataKey="microwave" fill="#c084fc" name="Microwave" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function SimulatorPage() {
  const [mode, setMode] = useState<"laser" | "microwave" | "compare">("laser");
  const [rangeM, setRangeM] = useState(2000);
  const [powerKw, setPowerKw] = useState(5);
  const [condition, setCondition] = useState("clear");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | CompareResult | null>(null);

  async function runSim() {
    setLoading(true);
    setError(null);
    try {
      const data = await simulate({ mode, range_m: rangeM, power_kw: powerKw, condition });
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Hummingbird Sim
        </h1>
        <p className="text-gray-400 mt-1 text-lg">
          Wireless Power Transmission for Defense Logistics
        </p>
        <div className="h-px bg-gradient-to-r from-green-500 via-blue-500 to-transparent mt-4" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
        {/* Controls panel */}
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-5">
              ── SIMULATION PARAMETERS ──
            </h2>

            {/* Mode */}
            <div className="mb-5">
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                Transmission Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["laser", "microwave", "compare"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      mode === m
                        ? "bg-green-600 text-white shadow-lg shadow-green-900/50"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Range slider */}
            <div className="mb-5">
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                Range: <span className="text-white font-mono">{(rangeM / 1000).toFixed(1)} km</span>
              </label>
              <input
                type="range"
                min={500}
                max={10000}
                step={100}
                value={rangeM}
                onChange={(e) => setRangeM(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0.5 km</span>
                <span>10 km</span>
              </div>
            </div>

            {/* Power slider */}
            <div className="mb-5">
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                Target Power: <span className="text-white font-mono">{powerKw} kW</span>
              </label>
              <input
                type="range"
                min={1}
                max={50}
                step={0.5}
                value={powerKw}
                onChange={(e) => setPowerKw(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>1 kW</span>
                <span>50 kW</span>
              </div>
            </div>

            {/* Condition */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                Atmospheric Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
              >
                <option value="clear">Clear</option>
                <option value="haze">Haze</option>
                <option value="smoke">Smoke</option>
                <option value="rain">Rain</option>
              </select>
            </div>

            <button
              onClick={runSim}
              disabled={loading}
              className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all text-sm uppercase tracking-wider shadow-lg shadow-green-900/30"
            >
              {loading ? "⟳ Computing..." : "▶ Run Simulation"}
            </button>
          </div>

          {/* Info */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
            <div className="text-gray-400 font-mono text-xs mb-2">PHYSICS MODELS</div>
            <div>• Laser: Gaussian beam propagation (IEC 60825-1)</div>
            <div>• Microwave: Friis/phased array (5.8 GHz)</div>
            <div>• Atmo: Beer-Lambert attenuation</div>
            <div>• Economics: DoD fully-burdened fuel at $12/L</div>
            <div>• Convoy: $600/convoy-mile (RAND estimate)</div>
          </div>
        </div>

        {/* Results panel */}
        <div className="min-h-[500px]">
          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 py-20 bg-gray-900/30 border border-gray-800 rounded-xl">
              <div className="text-5xl mb-4">⚡</div>
              <p className="text-lg font-mono">Configure and run a simulation</p>
              <p className="text-sm mt-2">Results will appear here</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 text-red-400 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <div className="text-4xl animate-pulse mb-4">⟳</div>
              <p className="text-gray-400 font-mono">Running physics simulation...</p>
            </div>
          )}

          {result && !loading && (
            <div>
              {result.mode === "compare" ? (
                <ComparePanel result={result as CompareResult} />
              ) : (
                <ResultPanel result={result as SimResult} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
