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

type LossBudget = Record<string, number | string | null>;
type RequiredHardware = Record<string, string | number>;

type FeasibilityInfo = {
  is_feasible: boolean;
  regime: string;
  rayleigh_distance_m: number | null;
  beam_radius_at_range_m: number | null;
  required_rx_aperture_m2: number | null;
  note: string;
  best_mode_for_range: "laser" | "microwave";
  best_mode_reason: string;
  darpa_prad_anchor: string;
};

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
  loss_budget?: LossBudget;
  required_hardware?: RequiredHardware;
  link_margin_db?: number;
  performance_rating?: string;
  feasibility_ok?: boolean;
  feasibility_warning?: string | null;
  feasibility?: FeasibilityInfo;
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

function PerformanceBadge({ rating }: { rating?: string }) {
  if (!rating) return null;
  const styles: Record<string, string> = {
    excellent: "bg-green-900/60 border-green-600 text-green-300",
    marginal:  "bg-yellow-900/60 border-yellow-600 text-yellow-300",
    poor:      "bg-red-900/60 border-red-600 text-red-300",
  };
  const icons: Record<string, string> = {
    excellent: "✓",
    marginal:  "⚠",
    poor:      "✗",
  };
  const cls = styles[rating] ?? "bg-gray-800 border-gray-600 text-gray-300";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold uppercase tracking-wide ${cls}`}>
      <span>{icons[rating] ?? "?"}</span>
      {rating}
    </span>
  );
}

function LossRow({ label, db, fraction }: { label: string; db?: number | null; fraction?: number | null }) {
  if (db == null && fraction == null) return null;
  const pct = fraction != null ? (fraction * 100).toFixed(2) + "%" : null;
  const dbStr = db != null ? (db >= 0 ? `+${db.toFixed(2)} dB` : `${db.toFixed(2)} dB`) : null;
  const isGain = db != null && db < 0;
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-gray-800/50">
      <span className="text-gray-400 text-xs">{label}</span>
      <div className="flex gap-3 items-center">
        {pct && <span className="text-gray-500 text-xs font-mono">{pct}</span>}
        {dbStr && (
          <span className={`text-xs font-mono font-medium ${isGain ? "text-green-400" : "text-orange-400"}`}>
            {dbStr}
          </span>
        )}
      </div>
    </div>
  );
}

function MicrowaveLinkBudget({ lb }: { lb: LossBudget }) {
  return (
    <div className="space-y-0.5">
      <LossRow label="Wall-plug → RF" db={lb.wall_plug_loss_db as number} />
      <LossRow label="Feed network loss" db={lb.feed_network_loss_db as number} />
      <LossRow label="Temp derating (45°C)" db={lb.temperature_derating_db as number} />
      <LossRow label="Phase error (Ruze)" db={lb.phase_error_loss_db as number} />
      <LossRow label="Pointing error (0.05°)" db={lb.pointing_error_loss_db as number} />
      <LossRow label="Free-space path loss" db={lb.free_space_path_loss_db as number} />
      <LossRow label="Gaseous absorption" db={lb.gaseous_absorption_db as number} />
      <LossRow label="Rain attenuation" db={lb.rain_attenuation_db as number} />
      <LossRow label="Atmospheric scintillation" db={lb.atmospheric_scintillation_db as number} />
      <LossRow label="Array gain" db={-(lb.array_gain_ideal_dbi as number)} />
      <LossRow label="RX aperture gain" db={-(lb.rx_aperture_gain_dbi as number)} />
      <LossRow label="Rectenna conversion" db={lb.rectenna_conversion_loss_db as number} />
      <LossRow label="Impedance mismatch" db={lb.impedance_mismatch_db as number} />
      <LossRow label="DC-DC conditioning" db={lb.dc_dc_conditioning_db as number} />
      {lb.total_loss_db != null && (
        <div className="flex justify-between items-center pt-1.5 mt-1 border-t border-gray-600">
          <span className="text-gray-200 text-xs font-semibold">Net system loss</span>
          <span className="text-orange-400 text-xs font-mono font-bold">+{(lb.total_loss_db as number).toFixed(2)} dB</span>
        </div>
      )}
    </div>
  );
}

function LaserLinkBudget({ lb }: { lb: LossBudget }) {
  return (
    <div className="space-y-0.5">
      <LossRow label="Wall-plug → photon" db={lb.wall_plug_loss_db as number} />
      <LossRow label="Atmospheric absorption" db={lb.atmospheric_absorption_db as number} />
      <LossRow label={`Turbulence Strehl (Cn²=${lb.Cn2_m_neg23 != null ? Number(lb.Cn2_m_neg23).toExponential(0) : "?"})`} db={lb.turbulence_strehl_db as number} />
      <LossRow label="Pointing jitter (5 µrad)" db={lb.pointing_jitter_db as number} />
      <LossRow label="Geometric capture" db={lb.geometric_collection_db as number} />
      <LossRow label="Central obscuration (20%)" db={lb.central_obscuration_db as number} />
      <LossRow label="PV base efficiency" db={lb.pv_base_efficiency_db as number} />
      <LossRow label="PV temp derating (60°C)" db={lb.pv_temp_derating_db as number} />
      <LossRow label="DC-DC conditioning" db={lb.dc_dc_conditioning_db as number} />
      {lb.total_loss_db != null && (
        <div className="flex justify-between items-center pt-1.5 mt-1 border-t border-gray-600">
          <span className="text-gray-200 text-xs font-semibold">Net system loss</span>
          <span className="text-orange-400 text-xs font-mono font-bold">+{(lb.total_loss_db as number).toFixed(2)} dB</span>
        </div>
      )}
    </div>
  );
}

function FeasibilityBanner({ f, mode }: { f: FeasibilityInfo; mode: string }) {
  const regime = f.regime;
  const isFog = f.note.includes("FOG HARD BLOCK");

  let color: string;
  let badge: string;
  let badgeClass: string;

  if (!f.is_feasible || isFog) {
    color = "bg-red-900/20 border-red-700/50 text-red-300";
    badgeClass = "bg-red-800 text-red-200";
    badge = isFog ? "🚫 FOG BLOCK" : "✗ INFEASIBLE";
  } else if (f.regime === "far-field" && mode === "microwave") {
    color = "bg-yellow-900/20 border-yellow-700/50 text-yellow-300";
    badgeClass = "bg-yellow-800 text-yellow-200";
    badge = "⚠ FAR-FIELD";
  } else {
    color = "bg-green-900/20 border-green-700/50 text-green-300";
    badgeClass = "bg-green-800 text-green-200";
    badge = "✓ FEASIBLE";
  }

  return (
    <div className={`rounded-lg border px-4 py-3 text-xs space-y-2 ${color}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${badgeClass}`}>{badge}</span>
        <span className="font-mono text-gray-300 uppercase tracking-wide">{regime.replace(/_/g, "-")}</span>
        {f.rayleigh_distance_m != null && (
          <span className="text-gray-400">Rayleigh: <span className="font-mono text-white">{f.rayleigh_distance_m.toFixed(0)} m</span></span>
        )}
      </div>
      <p className="leading-relaxed">{f.note}</p>
      {f.beam_radius_at_range_m != null && f.required_rx_aperture_m2 != null && (
        <div className="flex gap-6 pt-1 border-t border-current/20 text-gray-400">
          <span>Beam radius: <span className="text-white font-mono">{f.beam_radius_at_range_m.toFixed(1)} m</span></span>
          <span>50%-capture aperture: <span className="text-white font-mono">{f.required_rx_aperture_m2.toFixed(0)} m²</span></span>
        </div>
      )}
      <p className="text-gray-500 italic text-[10px]">Ref: {f.darpa_prad_anchor}</p>
    </div>
  );
}

function BestModePanel({ f }: { f: FeasibilityInfo }) {
  const isLaser = f.best_mode_for_range === "laser";
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3 text-xs">
      <div className="text-gray-400 uppercase tracking-wider mb-1.5">Best Mode for This Scenario</div>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded font-bold uppercase text-xs ${isLaser ? "bg-blue-800 text-blue-200" : "bg-purple-800 text-purple-200"}`}>
          {f.best_mode_for_range === "laser" ? "⚡ LASER" : "📡 MICROWAVE"}
        </span>
        <span className="text-gray-300 leading-relaxed">{f.best_mode_reason}</span>
      </div>
    </div>
  );
}

function PhysicsDetailPanel({ result }: { result: SimResult }) {
  const [open, setOpen] = useState(false);
  const lb = result.loss_budget;
  if (!lb) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-3 text-xs text-gray-400 hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-mono uppercase tracking-wider">⚙ Physics Detail / Link Budget</span>
        <span className="text-gray-600">{open ? "▲ collapse" : "▼ expand"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {result.mode === "laser" ? (
            <LaserLinkBudget lb={lb} />
          ) : (
            <MicrowaveLinkBudget lb={lb} />
          )}
          {lb.fried_r0_m != null && (
            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
              <div>Fried r₀: {((lb.fried_r0_m as number) * 100).toFixed(2)} cm</div>
              <div>Rytov variance: {(lb.rytov_variance as number)?.toExponential(3)}</div>
              <div>M² beam quality: {lb.m2_beam_quality as number}</div>
            </div>
          )}
          {result.feasibility?.rayleigh_distance_m != null && (
            <div className="mt-2 pt-2 border-t border-gray-800 text-xs text-gray-500 space-y-0.5">
              <div className="text-gray-400 font-semibold mb-1">Near/Far-Field Boundary</div>
              <div>Rayleigh distance: <span className="text-gray-200 font-mono">{result.feasibility.rayleigh_distance_m.toFixed(1)} m</span></div>
              <div>Range is <span className="text-gray-200 font-mono">{((result.range_km * 1000) / (result.feasibility.rayleigh_distance_m || 1)).toFixed(0)}×</span> beyond Rayleigh — deep far-field</div>
              {result.feasibility.beam_radius_at_range_m != null && (
                <div>Beam radius @ {result.range_km.toFixed(1)} km: <span className="text-orange-400 font-mono">{result.feasibility.beam_radius_at_range_m.toFixed(1)} m</span></div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HardwarePanel({ hw }: { hw: RequiredHardware }) {
  const entries = Object.entries(hw).filter(([k]) => k !== "type");
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
        Required Hardware — {hw.type as string}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between col-span-1 text-xs py-0.5">
            <span className="text-gray-500">{k.replace(/_/g, " ")}</span>
            <span className="text-gray-200 font-mono ml-2">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: SimResult }) {
  const chartData = [
    { name: "DC Delivered", value: result.dc_power_delivered_kw, fill: "#4ade80" },
    { name: "Elec Input", value: result.electrical_input_kw, fill: "#60a5fa" },
  ];

  const infeasible = result.feasibility_ok === false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-xs text-gray-400 font-mono uppercase tracking-widest">
          ── {result.mode.toUpperCase()} @ {result.range_km.toFixed(1)} km | {result.condition} ──
        </div>
        <PerformanceBadge rating={result.performance_rating} />
        {result.link_margin_db != null && (
          <span className={`text-xs font-mono ${result.link_margin_db >= 0 ? "text-green-400" : "text-red-400"}`}>
            {result.link_margin_db >= 0 ? "+" : ""}{result.link_margin_db.toFixed(1)} dB margin
          </span>
        )}
      </div>

      {/* Feasibility banner (v3) */}
      {result.feasibility && (
        <FeasibilityBanner f={result.feasibility} mode={result.mode} />
      )}

      {/* Legacy feasibility warning (fallback when feasibility object absent) */}
      {!result.feasibility && infeasible && result.feasibility_warning && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-xs">
          <span className="font-bold">⚠ Feasibility Warning: </span>
          {result.feasibility_warning}
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="DC Delivered"
          value={result.dc_power_delivered_kw.toFixed(2)}
          unit="kW"
          color={infeasible ? "text-red-400" : "text-green-400"}
        />
        <MetricCard
          label="System Efficiency"
          value={result.system_efficiency_pct.toFixed(2)}
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

      {/* Required Hardware */}
      {result.required_hardware && (
        <HardwarePanel hw={result.required_hardware} />
      )}

      {/* Physics Detail (expandable) */}
      {result.loss_budget && <PhysicsDetailPanel result={result} />}

      {/* Best mode recommendation */}
      {result.feasibility && <BestModePanel f={result.feasibility} />}

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
          const infeasible = r.feasibility_ok === false;
          return (
            <div key={m} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
              <div className={`flex items-center gap-2 mb-2`}>
                <span className={`text-xs font-mono ${m === "laser" ? "text-blue-400" : "text-purple-400"}`}>
                  {m.toUpperCase()}
                </span>
                <PerformanceBadge rating={r.performance_rating} />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Efficiency</span>
                  <span className="font-mono">{r.system_efficiency_pct.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">DC Power</span>
                  <span className={`font-mono ${infeasible ? "text-red-400" : "text-green-400"}`}>
                    {r.dc_power_delivered_kw.toFixed(2)} kW
                  </span>
                </div>
                {r.link_margin_db != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Link Margin</span>
                    <span className={`font-mono ${r.link_margin_db >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {r.link_margin_db >= 0 ? "+" : ""}{r.link_margin_db.toFixed(1)} dB
                    </span>
                  </div>
                )}
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

      {/* Hardware comparison */}
      <div className="grid grid-cols-2 gap-3">
        {(["laser", "microwave"] as const).map((m) => {
          const r = result[m];
          if (!r.required_hardware) return null;
          return (
            <div key={m} className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
              <div className={`text-xs font-mono mb-2 ${m === "laser" ? "text-blue-400" : "text-purple-400"}`}>
                {m.toUpperCase()} HW
              </div>
              <div className="text-xs space-y-1">
                {Object.entries(r.required_hardware)
                  .filter(([k]) => !["type", "condition_mapped"].includes(k))
                  .slice(0, 5)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-500">{k.replace(/_/g, " ")}</span>
                      <span className="text-gray-200 font-mono">{String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
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
            <div className="text-gray-400 font-mono text-xs mb-2">PHYSICS MODELS (v3 — validated 2025)</div>
            <div>• Laser: Gaussian beam + M² + Fried r₀ + Strehl + pointing jitter</div>
            <div>• Laser atmo: 0.05 dB/km (clear), 1.0 (haze), 0.2 (rain), fog=BLOCK</div>
            <div>• Microwave: Friis + 5.8 GHz phased array + Ruze phase error</div>
            <div>• MW rain: ITU-R P.838-3 (10→0.07, 25→0.22, 50→0.44 dB/km)</div>
            <div>• Rectenna: GaN power-density curve (85% @≥2W, 65% @low power)</div>
            <div>• MW: fixed realistic hardware (no back-calculation to target)</div>
            <div>• System overhead: ×0.65, capped at 35% (DARPA PRAD anchor)</div>
            <div>• Anchor: DARPA POWER PRAD 2025 — 800W @ 8.6 km, ~20% eff</div>
            <div>• Economics: DoD fully-burdened fuel $12/L, convoy $600/mile</div>
          </div>
        </div>

        {/* Results panel */}
        <div className="min-h-[500px]">
          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 py-20 bg-gray-900/30 border border-gray-800 rounded-xl">
              <div className="text-5xl mb-4">⚡</div>
              <p className="text-lg font-mono">Configure and run a simulation</p>
              <p className="text-sm mt-2">Results will appear here — hardware auto-sized to target</p>
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
