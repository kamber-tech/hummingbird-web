"use client";

import { useState, useEffect, useRef } from "react";
import { simulate, simulateSpace, simulateOptimized } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

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

type SpaceResult = {
  mode: "space_laser" | "space_microwave";
  orbit: string;
  orbit_name: string;
  altitude_km: number;
  target_power_kw: number;
  dc_power_delivered_kw: number;
  electrical_input_kw: number;
  system_efficiency_pct: number;
  beam_radius_at_ground_m: number;
  condition: string;
  wpt_coverage_pct: number;
  fuel_saved_l_day: number;
  fuel_saved_l_yr: number;
  convoys_eliminated_yr: number;
  fuel_cost_saved_yr_usd: number;
  convoy_cost_saved_yr_usd: number;
  total_value_yr_usd: number;
  required_hardware?: Record<string, string | number>;
  link_budget?: Record<string, number>;
  context?: Record<string, string>;
  error?: string;
};

type OptimizedResult = {
  mode: "optimized";
  base: SimResult;
  optimized: SimResult & {
    optimizations_applied: string[];
    improvement_notes: string[];
    baseline_efficiency_pct: number;
    efficiency_gain_factor: number;
  };
  improvement_summary: {
    baseline_eff_pct: number;
    optimized_eff_pct: number;
    gain_factor: number;
    notes: string[];
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, digits = 1) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(digits)}k`;
  return n.toFixed(digits);
}

// ── Primitive components ───────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
      {children}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="py-2 rounded-lg text-sm font-medium transition-all"
      style={
        active
          ? { background: "var(--accent)", color: "#fff" }
          : {
              background: "var(--surface-2)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }
      }
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
      }}
    >
      {children}
    </button>
  );
}

function KPI({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className="text-xl font-semibold"
        style={{ color: highlight ? "var(--green)" : "var(--text)" }}
      >
        {value}
      </div>
      <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
        {sub}
      </div>
    </div>
  );
}

function StatusBadge({ feasible, eff }: { feasible: boolean; eff: number }) {
  if (!feasible || eff < 0.1)
    return (
      <span className="px-2.5 py-1 rounded-md text-xs font-semibold border"
        style={{ background: "rgba(127,29,29,0.4)", color: "#f87171", borderColor: "#7f1d1d" }}>
        Infeasible
      </span>
    );
  if (eff < 3)
    return (
      <span className="px-2.5 py-1 rounded-md text-xs font-semibold border"
        style={{ background: "rgba(120,53,15,0.4)", color: "#fbbf24", borderColor: "#78350f" }}>
        Marginal
      </span>
    );
  return (
    <span className="px-2.5 py-1 rounded-md text-xs font-semibold border"
      style={{ background: "rgba(20,83,45,0.4)", color: "#4ade80", borderColor: "#14532d" }}>
      Viable
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-subtle)" }}>
        {label}
      </div>
      <div className="text-xl font-semibold mt-0.5" style={{ color: "var(--text)" }}>
        {value}
      </div>
      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
        {sub}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-mono text-sm" style={{ color: "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

// ── Result sub-components ─────────────────────────────────────────────────────

function PlainEnglishSummary({ result }: { result: SimResult }) {
  const eff = result.system_efficiency_pct;
  const dc = result.dc_power_delivered_kw;
  const convoys = result.convoys_eliminated_yr;
  const fuelDay = result.fuel_saved_l_day;
  const feasible = result.feasibility_ok !== false;

  let text = "";
  if (!feasible || dc < 0.1) {
    text = `At ${result.range_km.toFixed(1)} km in ${result.condition} conditions, ${result.mode} WPT cannot deliver useful power with this hardware configuration. ${result.feasibility?.best_mode_reason || ""}`;
  } else if (eff < 5) {
    text = `This scenario is physically possible but marginal — only ${eff.toFixed(1)}% of input power reaches the receiver. For tactical FOB use, consider adjusting range or switching to ${result.feasibility?.best_mode_for_range ?? "the other mode"}.`;
  } else {
    const convoyLine =
      convoys >= 1
        ? `This would eliminate approximately ${Math.round(convoys)} fuel resupply mission${Math.round(convoys) !== 1 ? "s" : ""} per year — each one a potential IED exposure event for the convoy crew.`
        : `This partially offsets generator fuel demand, saving ${fuelDay.toFixed(0)} L/day.`;
    text = `At ${eff.toFixed(0)}% end-to-end efficiency, this system delivers ${dc.toFixed(1)} kW to the FOB — ${result.wpt_coverage_pct != null ? `covering ${result.wpt_coverage_pct.toFixed(0)}% of base power needs. ` : ""}${convoyLine}`;
  }

  return (
    <div
      className="rounded-xl px-4 py-3 text-sm leading-relaxed"
      style={{
        background: "var(--accent-dim)",
        border: "1px solid rgba(99,102,241,0.2)",
        color: "var(--text-muted)",
      }}
    >
      {text}
    </div>
  );
}

function BestModeNote({ f }: { f: FeasibilityInfo }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="text-xs uppercase tracking-wider mt-0.5 shrink-0"
        style={{ color: "var(--text-subtle)" }}
      >
        Recommendation
      </div>
      <div className="text-sm" style={{ color: "var(--text-muted)" }}>
        <span className="font-medium capitalize" style={{ color: "var(--text)" }}>
          {f.best_mode_for_range}
        </span>{" "}
        is better suited for this scenario. {f.best_mode_reason}
      </div>
    </div>
  );
}

function PowerChart({ result }: { result: SimResult }) {
  const data = [
    { name: "Input", value: result.electrical_input_kw },
    { name: "Delivered", value: result.dc_power_delivered_kw },
  ];
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="text-xs font-medium uppercase tracking-wider mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        Power Balance (kW)
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
          <XAxis dataKey="name" tick={{ fill: "#8888a0", fontSize: 11 }} />
          <YAxis tick={{ fill: "#8888a0", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#18181f",
              border: "1px solid #252530",
              borderRadius: 8,
              fontSize: 12,
              color: "#f0f0f5",
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            <Cell fill="#3b82f6" />
            <Cell fill="#22c55e" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HardwarePanel({ hw }: { hw: RequiredHardware }) {
  const entries = Object.entries(hw).filter(
    ([k]) => !["type", "condition_mapped"].includes(k)
  );
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="text-xs font-medium uppercase tracking-wider mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        Required Hardware — {hw.type as string}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span style={{ color: "var(--text-muted)" }}>{k.replace(/_/g, " ")}</span>
            <span className="font-mono" style={{ color: "var(--text)" }}>
              {String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LossRow({
  label,
  db,
}: {
  label: string;
  db?: number | null;
}) {
  if (db == null) return null;
  const isGain = db < 0;
  const str = db >= 0 ? `+${db.toFixed(2)} dB` : `${db.toFixed(2)} dB`;
  return (
    <div className="flex justify-between items-center py-0.5" style={{ borderBottom: "1px solid rgba(37,37,48,0.5)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-xs font-mono" style={{ color: isGain ? "var(--green)" : "#fb923c" }}>{str}</span>
    </div>
  );
}

function LinkBudgetCollapsible({ result }: { result: SimResult }) {
  const [open, setOpen] = useState(false);
  const lb = result.loss_budget;
  if (!lb) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-5 py-3 text-xs transition-colors"
        style={{ color: "var(--text-muted)" }}
      >
        <span className="uppercase tracking-wider font-medium">Link Budget / Physics Detail</span>
        <span style={{ color: "var(--text-subtle)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-0.5">
          {result.mode === "laser" ? (
            <>
              <LossRow label="Wall-plug → photon" db={lb.wall_plug_loss_db as number} />
              <LossRow label="Atmospheric absorption" db={lb.atmospheric_absorption_db as number} />
              <LossRow label="Turbulence Strehl" db={lb.turbulence_strehl_db as number} />
              <LossRow label="Pointing jitter (5 µrad)" db={lb.pointing_jitter_db as number} />
              <LossRow label="Geometric capture" db={lb.geometric_collection_db as number} />
              <LossRow label="Central obscuration" db={lb.central_obscuration_db as number} />
              <LossRow label="PV base efficiency" db={lb.pv_base_efficiency_db as number} />
              <LossRow label="PV temp derating" db={lb.pv_temp_derating_db as number} />
              <LossRow label="DC-DC conditioning" db={lb.dc_dc_conditioning_db as number} />
            </>
          ) : (
            <>
              <LossRow label="Wall-plug → RF" db={lb.wall_plug_loss_db as number} />
              <LossRow label="Feed network loss" db={lb.feed_network_loss_db as number} />
              <LossRow label="Temperature derating" db={lb.temperature_derating_db as number} />
              <LossRow label="Phase error (Ruze)" db={lb.phase_error_loss_db as number} />
              <LossRow label="Pointing error" db={lb.pointing_error_loss_db as number} />
              <LossRow label="Free-space path loss" db={lb.free_space_path_loss_db as number} />
              <LossRow label="Gaseous absorption" db={lb.gaseous_absorption_db as number} />
              <LossRow label="Rain attenuation" db={lb.rain_attenuation_db as number} />
              <LossRow label="Atmospheric scintillation" db={lb.atmospheric_scintillation_db as number} />
              <LossRow label="Array gain" db={lb.array_gain_ideal_dbi != null ? -(lb.array_gain_ideal_dbi as number) : null} />
              <LossRow label="RX aperture gain" db={lb.rx_aperture_gain_dbi != null ? -(lb.rx_aperture_gain_dbi as number) : null} />
              <LossRow label="Rectenna conversion" db={lb.rectenna_conversion_loss_db as number} />
              <LossRow label="Impedance mismatch" db={lb.impedance_mismatch_db as number} />
              <LossRow label="DC-DC conditioning" db={lb.dc_dc_conditioning_db as number} />
            </>
          )}
          {lb.total_loss_db != null && (
            <div className="flex justify-between items-center pt-2 mt-1" style={{ borderTop: "1px solid var(--border-bright)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>Net system loss</span>
              <span className="text-xs font-mono font-bold" style={{ color: "#fb923c" }}>
                +{(lb.total_loss_db as number).toFixed(2)} dB
              </span>
            </div>
          )}
          {lb.fried_r0_m != null && (
            <div className="mt-3 pt-3 text-xs space-y-1" style={{ borderTop: "1px solid var(--border)", color: "var(--text-subtle)" }}>
              <div>Fried r₀: {((lb.fried_r0_m as number) * 100).toFixed(2)} cm</div>
              <div>Rytov variance: {(lb.rytov_variance as number)?.toExponential(3)}</div>
              <div>M² beam quality: {lb.m2_beam_quality as number}</div>
            </div>
          )}
          {result.feasibility?.rayleigh_distance_m != null && (
            <div className="mt-3 pt-3 text-xs space-y-1" style={{ borderTop: "1px solid var(--border)", color: "var(--text-subtle)" }}>
              <div style={{ color: "var(--text-muted)" }} className="font-medium mb-1">Near/Far-Field Boundary</div>
              <div>Rayleigh distance: <span className="font-mono" style={{ color: "var(--text)" }}>{result.feasibility.rayleigh_distance_m.toFixed(1)} m</span></div>
              <div>Range is <span className="font-mono" style={{ color: "var(--text)" }}>{((result.range_km * 1000) / (result.feasibility.rayleigh_distance_m || 1)).toFixed(0)}×</span> beyond Rayleigh — deep far-field</div>
              {result.feasibility.beam_radius_at_range_m != null && (
                <div>Beam radius @ {result.range_km.toFixed(1)} km: <span className="font-mono" style={{ color: "#fb923c" }}>{result.feasibility.beam_radius_at_range_m.toFixed(1)} m</span></div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result }: { result: SimResult }) {
  const feasible = result.feasibility_ok !== false;
  const eff = result.system_efficiency_pct;

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge feasible={feasible} eff={eff} />
        <span className="text-sm" style={{ color: "var(--text-subtle)" }}>
          {result.mode} · {result.range_km.toFixed(1)} km · {result.condition}
        </span>
        {result.link_margin_db != null && (
          <span
            className="text-xs font-mono ml-auto"
            style={{ color: result.link_margin_db >= 0 ? "var(--green)" : "var(--red)" }}
          >
            {result.link_margin_db >= 0 ? "+" : ""}
            {result.link_margin_db.toFixed(1)} dB link margin
          </span>
        )}
      </div>

      {/* Feasibility note */}
      {result.feasibility?.note && (
        <div
          className="text-xs px-4 py-3 rounded-lg"
          style={
            feasible
              ? {
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  background: "var(--surface)",
                }
              : {
                  border: "1px solid rgba(127,29,29,0.6)",
                  color: "#fca5a5",
                  background: "rgba(127,29,29,0.15)",
                }
          }
        >
          {result.feasibility.note}
        </div>
      )}

      {/* Key numbers — convoys FIRST (primary DoD value prop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KPI
          label="Convoys eliminated"
          value={`${result.convoys_eliminated_yr.toFixed(0)}/yr`}
          sub="↓ IED exposure per mission"
          highlight={feasible && result.convoys_eliminated_yr >= 1}
        />
        <KPI
          label="Fuel resupply saved"
          value={`${result.fuel_saved_l_day.toFixed(0)} L/day`}
          sub="generator diesel offset"
        />
        <KPI
          label="FOB coverage"
          value={`${result.wpt_coverage_pct.toFixed(0)}%`}
          sub="of base power needs"
        />
        <KPI
          label="Power delivered"
          value={`${result.dc_power_delivered_kw.toFixed(2)} kW`}
          sub="DC at the receiver"
          highlight={feasible && result.dc_power_delivered_kw >= 0.1}
        />
        <KPI
          label="System efficiency"
          value={`${result.system_efficiency_pct.toFixed(1)}%`}
          sub="wall plug → DC"
        />
        <KPI
          label="Annual value"
          value={`$${fmt(result.total_value_yr_usd)}`}
          sub="fuel + convoy savings"
        />
      </div>

      {/* Plain-English interpretation */}
      <PlainEnglishSummary result={result} />

      {/* Power chart */}
      <PowerChart result={result} />

      {/* Hardware needed */}
      {result.required_hardware && <HardwarePanel hw={result.required_hardware} />}

      {/* Link budget (collapsed by default) */}
      <LinkBudgetCollapsible result={result} />

      {/* Best mode */}
      {result.feasibility && <BestModeNote f={result.feasibility} />}
    </div>
  );
}

function CompareChart({ laser, microwave }: { laser: SimResult; microwave: SimResult }) {
  const data = [
    {
      name: "Efficiency %",
      Laser: parseFloat(laser.system_efficiency_pct.toFixed(2)),
      Microwave: parseFloat(microwave.system_efficiency_pct.toFixed(2)),
    },
    {
      name: "DC kW",
      Laser: parseFloat(laser.dc_power_delivered_kw.toFixed(2)),
      Microwave: parseFloat(microwave.dc_power_delivered_kw.toFixed(2)),
    },
    {
      name: "Fuel L/day",
      Laser: parseFloat(laser.fuel_saved_l_day.toFixed(1)),
      Microwave: parseFloat(microwave.fuel_saved_l_day.toFixed(1)),
    },
  ];
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="text-xs font-medium uppercase tracking-wider mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        Side-by-Side Metrics
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
          <XAxis dataKey="name" tick={{ fill: "#8888a0", fontSize: 10 }} />
          <YAxis tick={{ fill: "#8888a0", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              background: "#18181f",
              border: "1px solid #252530",
              borderRadius: 8,
              fontSize: 12,
              color: "#f0f0f5",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8888a0" }} />
          <Bar dataKey="Laser" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Microwave" fill="#a78bfa" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComparePanel({ result }: { result: CompareResult }) {
  const laserBetter =
    result.laser.system_efficiency_pct >= result.microwave.system_efficiency_pct;

  return (
    <div className="space-y-5">
      <div className="text-sm" style={{ color: "var(--text-muted)" }}>
        Laser vs Microwave at the same scenario
      </div>

      {/* Side-by-side summary cards */}
      <div className="grid grid-cols-2 gap-4">
        {(["laser", "microwave"] as const).map((m) => {
          const r = result[m];
          const winner = m === "laser" ? laserBetter : !laserBetter;
          return (
            <div
              key={m}
              className="rounded-xl p-5"
              style={
                winner
                  ? {
                      border: "1px solid var(--accent)",
                      background: "var(--accent-dim)",
                    }
                  : {
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                    }
              }
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold capitalize" style={{ color: "var(--text)" }}>
                  {m}
                </span>
                {winner && (
                  <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                    Recommended
                  </span>
                )}
              </div>
              <div className="space-y-2 mb-4">
                <Row label="Efficiency" value={`${r.system_efficiency_pct.toFixed(1)}%`} />
                <Row label="DC delivered" value={`${r.dc_power_delivered_kw.toFixed(2)} kW`} />
                <Row label="Fuel saved" value={`${r.fuel_saved_l_day.toFixed(0)} L/day`} />
                <Row label="Annual value" value={`$${fmt(r.total_value_yr_usd)}`} />
              </div>
              <StatusBadge feasible={r.feasibility_ok !== false} eff={r.system_efficiency_pct} />
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <CompareChart laser={result.laser} microwave={result.microwave} />

      {/* Takeaway */}
      <div
        className="rounded-xl px-4 py-4 text-sm"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <span className="font-medium" style={{ color: "var(--text)" }}>
          Takeaway:{" "}
        </span>
        {laserBetter
          ? `Laser delivers ${(
              result.laser.system_efficiency_pct /
              Math.max(result.microwave.system_efficiency_pct, 0.01)
            ).toFixed(0)}x more efficiently at this range in ${result.laser.condition} conditions.`
          : `Microwave holds up better in ${result.microwave.condition} conditions — laser is more severely attenuated.`}
      </div>
    </div>
  );
}

function SpaceResultPanel({ result }: { result: SpaceResult }) {
  const isLeo = result.altitude_km < 2000;
  const isGeo = result.altitude_km >= 20000;
  const eff = result.system_efficiency_pct;
  const dc = result.dc_power_delivered_kw;
  const hw = result.required_hardware;
  const lb = result.link_budget;
  const ctx = result.context;
  const isLaser = result.mode === "space_laser";
  const [lbOpen, setLbOpen] = useState(false);

  const infra = isGeo
    ? "National-grid scale. GEO requires km-scale orbital arrays and km² ground rectennas — the ESA SOLARIS / JAXA SSPS program."
    : isLeo
    ? "Feasibility-demonstration scale. LEO laser WPT is proven — NRL PRAM flew on ISS in 2021. 2–10 m apertures are realistic."
    : "Mid-scale. MEO is a stepping stone between LEO demos and GEO operational deployment.";

  return (
    <div className="space-y-5">
      {/* Header banner */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-subtle)" }}>
              Future scale · Space-to-Earth WPT
            </div>
            <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              {result.orbit_name}
            </div>
            <div className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {result.altitude_km.toLocaleString()} km altitude · {isLaser ? "1070 nm laser" : "5.8 GHz microwave"} · {result.condition}
            </div>
          </div>
          <span
            className="shrink-0 text-xs px-3 py-1 rounded-full font-medium"
            style={
              isLeo
                ? { background: "rgba(20,83,45,0.4)", color: "#4ade80", border: "1px solid #14532d" }
                : isGeo
                ? { background: "rgba(120,53,15,0.4)", color: "#fbbf24", border: "1px solid #78350f" }
                : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }
            }
          >
            {isLeo ? "Demo-ready" : isGeo ? "Future scale" : "Mid-term"}
          </span>
        </div>
      </div>

      {/* Error / fog block */}
      {result.error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(127,29,29,0.15)", border: "1px solid rgba(127,29,29,0.6)", color: "#fca5a5" }}>
          {result.error}
        </div>
      )}

      {/* Infrastructure context */}
      <div
        className="rounded-xl px-4 py-3 text-sm leading-relaxed"
        style={{ background: "var(--accent-dim)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--text-muted)" }}
      >
        {infra}
        {ctx?.note && <span className="block mt-1">{ctx.note}</span>}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KPI
          label="DC delivered"
          value={`${dc.toFixed(dc < 1 ? 3 : 1)} kW`}
          sub="at the ground receiver"
          highlight={dc > 0.01}
        />
        <KPI
          label="System efficiency"
          value={`${eff.toFixed(2)}%`}
          sub="wall-plug → DC"
        />
        <KPI
          label="Beam radius at ground"
          value={result.beam_radius_at_ground_m != null
            ? result.beam_radius_at_ground_m >= 1000
              ? `${(result.beam_radius_at_ground_m / 1000).toFixed(1)} km`
              : `${result.beam_radius_at_ground_m.toFixed(1)} m`
            : "—"}
          sub={isLaser ? "1/e² beam radius" : "3 dB beam radius"}
        />
        {hw && (
          <>
            {isLaser ? (
              <>
                <KPI label="TX aperture" value={`${hw.laser_aperture_m} m`} sub="orbital telescope" />
                <KPI label="RX aperture" value={`${hw.rx_aperture_m} m`} sub="ground PV telescope" />
                <KPI label="Capture" value={`${Number(hw.geometric_capture_pct).toFixed(3)}%`} sub="of transmitted beam" />
              </>
            ) : (
              <>
                <KPI label="TX array" value={`${Number(hw.tx_array_diameter_m) >= 1000 ? (Number(hw.tx_array_diameter_m)/1000).toFixed(1)+"km" : hw.tx_array_diameter_m+"m"}`} sub="orbital array diameter" />
                <KPI label="Rectenna" value={`${(Number(hw.required_rx_area_m2)/1e6).toFixed(2)} km²`} sub="ground receive area" />
                <KPI label="TX RF power" value={`${Number(hw.required_rf_power_gw).toFixed(3)} GW`} sub="orbital transmit" />
              </>
            )}
          </>
        )}
      </div>

      {/* Link budget (collapsible) */}
      {lb && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <button
            onClick={() => setLbOpen(!lbOpen)}
            className="w-full flex justify-between items-center px-5 py-3 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="uppercase tracking-wider font-medium">Link Budget</span>
            <span style={{ color: "var(--text-subtle)" }}>{lbOpen ? "▲" : "▼"}</span>
          </button>
          {lbOpen && (
            <div className="px-5 pb-4 space-y-0.5">
              {Object.entries(lb).map(([k, v]) => (
                <LossRow key={k} label={k.replace(/_/g, " ")} db={v as number} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hardware panel */}
      {hw && (
        <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Infrastructure Required — {hw.type}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {Object.entries(hw).filter(([k]) => k !== "type").map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span style={{ color: "var(--text-muted)" }}>{k.replace(/_/g, " ")}</span>
                <span className="font-mono" style={{ color: "var(--text)" }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real-world references */}
      {ctx && (
        <div className="rounded-xl p-4 text-xs space-y-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="uppercase tracking-wider font-medium mb-2" style={{ color: "var(--text-subtle)" }}>Real-world anchors</div>
          {Object.entries(ctx).filter(([k]) => k.endsWith("_ref")).map(([k, v]) => (
            <div key={k} style={{ color: "var(--text-muted)" }}>▸ {v}</div>
          ))}
          {isGeo && (
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)", color: "var(--text-subtle)" }}>
              Proving the FOB case first with ground-based WPT de-risks the space program — same RF/laser physics, 
              same regulatory frameworks, same PV receiver technology. LEO demos scale to GEO deployment.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OptimizedResultPanel({ result }: { result: OptimizedResult }) {
  const { base, optimized, improvement_summary: imp } = result;
  const gained = imp.gain_factor;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl px-5 py-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-subtle)" }}>
          Optimized scenario — {base.mode} · {base.range_km.toFixed(1)} km · {base.condition}
        </div>
        <div className="flex items-baseline gap-3 mt-1">
          <span className="text-2xl font-bold" style={{ color: "var(--green)" }}>{imp.optimized_eff_pct.toFixed(1)}%</span>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>vs {imp.baseline_eff_pct.toFixed(1)}% baseline</span>
          <span className="ml-auto text-sm font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(20,83,45,0.4)", color: "#4ade80" }}>
            {gained}× improvement
          </span>
        </div>
      </div>

      {/* Side-by-side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>Baseline</div>
          <div className="space-y-2">
            <Row label="Efficiency" value={`${base.system_efficiency_pct.toFixed(1)}%`} />
            <Row label="DC delivered" value={`${base.dc_power_delivered_kw.toFixed(2)} kW`} />
            <Row label="Convoys cut" value={`${base.convoys_eliminated_yr?.toFixed(0) ?? "—"}/yr`} />
            <Row label="Annual value" value={`$${fmt(base.total_value_yr_usd)}`} />
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ border: "1px solid var(--accent)", background: "var(--accent-dim)" }}>
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--accent)" }}>Optimized</div>
          <div className="space-y-2">
            <Row label="Efficiency" value={`${optimized.system_efficiency_pct.toFixed(1)}%`} />
            <Row label="DC delivered" value={`${optimized.dc_power_delivered_kw.toFixed(2)} kW`} />
            <Row label="Convoys cut" value={`${optimized.convoys_eliminated_yr?.toFixed(0) ?? "—"}/yr`} />
            <Row label="Annual value" value={`$${fmt(optimized.total_value_yr_usd)}`} />
          </div>
        </div>
      </div>

      {/* What was applied */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-subtle)" }}>Optimizations applied</div>
        {imp.notes.map((note, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span style={{ color: "var(--green)" }}>✓</span>
            <span style={{ color: "var(--text-muted)" }}>{note}</span>
          </div>
        ))}
        {imp.notes.length === 0 && (
          <div className="text-sm" style={{ color: "var(--text-subtle)" }}>No applicable optimizations for this mode/condition.</div>
        )}
      </div>

      {/* Physics note */}
      <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "var(--accent-dim)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--text-subtle)" }}>
        Efficiency capped at 35% (above demonstrated state-of-art: DARPA PRAD 20%, JAXA MW 22%). 
        Optimized figures represent best-case hardware configurations; real deployments will vary.
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  // ── Primary mode defaults: laser, 2 km, 15 kW (typical small FOB), clear ──
  type AppMode = "laser" | "microwave" | "compare" | "space" | "optimized";
  const [mode, setMode] = useState<AppMode>("laser");
  const [rangeM, setRangeM] = useState(2000);
  const [powerKw, setPowerKw] = useState(15);
  const [condition, setCondition] = useState("clear");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | CompareResult | SpaceResult | OptimizedResult | null>(null);

  // Space mode sub-state
  const [orbit, setOrbit] = useState("leo");
  const [spaceMode, setSpaceMode] = useState<"laser" | "microwave">("laser");

  // Optimized mode sub-state
  const [baseMode, setBaseMode] = useState<"laser" | "microwave">("laser");
  const [optimizations, setOptimizations] = useState<string[]>(["adaptive_optics", "inp_cells", "large_aperture"]);

  function toggleOpt(key: string) {
    setOptimizations((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function runSim() {
    setLoading(true);
    setError(null);
    try {
      let data: unknown;
      if (mode === "space") {
        data = await simulateSpace({
          mode: spaceMode,
          orbit,
          power_kw: powerKw,
          condition,
        });
      } else if (mode === "optimized") {
        data = await simulateOptimized({
          mode: baseMode,
          range_m: rangeM,
          power_kw: powerKw,
          condition,
          optimizations,
        });
      } else if (mode === "compare") {
        data = await simulate({ mode: "compare", range_m: rangeM, power_kw: powerKw, condition });
      } else {
        data = await simulate({ mode, range_m: rangeM, power_kw: powerKw, condition });
      }
      setResult(data as SimResult | CompareResult | SpaceResult | OptimizedResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // Auto-run the default FOB scenario on first load
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (!didAutoRun.current) {
      didAutoRun.current = true;
      runSim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modeDesc: Record<AppMode, string> = {
    laser: "Near-infrared beam (1070 nm). Best efficiency at range in clear conditions.",
    microwave: "5.8 GHz phased array. All-weather, effective within ~500 m with portable hardware.",
    compare: "Run both modes side by side at the same scenario parameters.",
    space: "Future scale — Space-to-Earth WPT from LEO/GEO. Proving the FOB case first de-risks this.",
    optimized: "Apply best-case hardware upgrades (AO, InP cells, larger apertures) to see ceiling efficiency.",
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <span className="font-semibold text-lg tracking-tight" style={{ color: "var(--text)" }}>
              Aether
            </span>
            <span className="text-sm ml-3" style={{ color: "var(--text-muted)" }}>
              WPT Simulator
            </span>
          </div>
          <span
            className="text-xs px-3 py-1 rounded-full"
            style={{ color: "var(--text-subtle)", background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            Physics v3 · 2025
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero — FOB-first framing */}
        <div className="mb-10 max-w-2xl">
          <h1 className="text-3xl font-bold leading-snug" style={{ color: "var(--text)" }}>
            Deliver power to a forward operating base —<br />
            <span style={{ color: "var(--accent)" }}>no fuel convoys required</span>
          </h1>
          <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Aether models laser and microwave wireless power transmission for defense logistics.
            Calculate how much power reaches the FOB, what hardware it takes, and how many
            dangerous resupply missions it eliminates.
          </p>
          <div className="flex gap-8 mt-6 flex-wrap">
            <Stat label="Convoys eliminated/yr" value="48+" sub="per 15 kW laser system" />
            <Stat label="Fuel saved per day" value="300+ L" sub="diesel offset at 2 km" />
            <Stat label="Real-world anchor" value="800 W @ 8.6 km" sub="DARPA POWER PRAD 2025" />
          </div>
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-8">
          {/* Config Panel */}
          <div
            className="rounded-xl p-6 space-y-6 sticky top-6 self-start"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Mode selector — primary modes first, space as secondary */}
            <div>
              <Label>Mode</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(["laser", "microwave", "compare"] as const).map((m) => (
                  <ModeButton key={m} active={mode === m} onClick={() => setMode(m)}>
                    {m === "laser" ? "Laser" : m === "microwave" ? "Microwave" : "Compare"}
                  </ModeButton>
                ))}
              </div>
              {/* Space and Optimized as secondary/advanced options */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <ModeButton active={mode === "optimized"} onClick={() => setMode("optimized")}>
                  Optimized ↑
                </ModeButton>
                <ModeButton active={mode === "space"} onClick={() => setMode("space")}>
                  ✦ Space scale
                </ModeButton>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                {modeDesc[mode]}
              </p>
            </div>

            {/* Space sub-controls */}
            {mode === "space" && (
              <div className="space-y-4">
                <div>
                  <Label>Orbit</Label>
                  <select
                    value={orbit}
                    onChange={(e) => setOrbit(e.target.value)}
                    className="mt-2 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    <option value="iss_leo">ISS / LEO (408 km)</option>
                    <option value="leo">Standard LEO (600 km)</option>
                    <option value="meo">Medium Earth Orbit (10,000 km)</option>
                    <option value="geo">Geostationary GEO (35,786 km)</option>
                  </select>
                </div>
                <div>
                  <Label>Space link type</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <ModeButton active={spaceMode === "laser"} onClick={() => setSpaceMode("laser")}>
                      Laser
                    </ModeButton>
                    <ModeButton active={spaceMode === "microwave"} onClick={() => setSpaceMode("microwave")}>
                      Microwave
                    </ModeButton>
                  </div>
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {orbit === "geo"
                    ? "GEO requires km-scale orbital arrays and km² rectennas — ESA SOLARIS / JAXA SSPS scale. Long-term national-grid opportunity."
                    : "LEO laser WPT is proven — NRL PRAM flew on ISS in 2021. 2–10 m apertures are realistic for near-term demos."}
                </p>
              </div>
            )}

            {/* Optimized sub-controls */}
            {mode === "optimized" && (
              <div className="space-y-4">
                <div>
                  <Label>Base mode</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <ModeButton active={baseMode === "laser"} onClick={() => setBaseMode("laser")}>
                      Laser
                    </ModeButton>
                    <ModeButton active={baseMode === "microwave"} onClick={() => setBaseMode("microwave")}>
                      Microwave
                    </ModeButton>
                  </div>
                </div>
                <div>
                  <Label>Optimizations</Label>
                  <div className="space-y-2.5 mt-2">
                    {[
                      { key: "adaptive_optics", label: "Adaptive optics", desc: "Laser turbulence pre-compensation (2.5× Strehl)" },
                      { key: "inp_cells", label: "InP PV cells (55%)", desc: "Best-in-class monochromatic PV vs 35% baseline" },
                      { key: "large_aperture", label: "Large aperture", desc: "2× diameter = 4× collection area" },
                      { key: "high_power_density", label: "High-density rectenna", desc: "85% RF-DC efficiency at full power" },
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={optimizations.includes(opt.key)}
                          onChange={() => toggleOpt(opt.key)}
                          className="mt-0.5"
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <div>
                          <div className="text-sm" style={{ color: "var(--text)" }}>{opt.label}</div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Range (hidden for space mode) */}
            {mode !== "space" && (
              <div>
                <Label>
                  Distance{" "}
                  <span className="font-mono" style={{ color: "var(--text)" }}>
                    {(rangeM / 1000).toFixed(1)} km
                  </span>
                </Label>
                <input
                  type="range"
                  min={500}
                  max={10000}
                  step={100}
                  value={rangeM}
                  onChange={(e) => setRangeM(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                  <span>0.5 km</span>
                  <span>10 km</span>
                </div>
              </div>
            )}

            {/* Power */}
            <div>
              <Label>
                Target power{" "}
                <span className="font-mono" style={{ color: "var(--text)" }}>
                  {powerKw} kW
                </span>
              </Label>
              <input
                type="range"
                min={1}
                max={mode === "space" ? 1000 : 50}
                step={mode === "space" ? 10 : 0.5}
                value={powerKw}
                onChange={(e) => setPowerKw(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                <span>1 kW</span>
                <span>{mode === "space" ? "1,000 kW" : "50 kW"}</span>
              </div>
              {mode !== "space" && (
                <p className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                  Typical small FOB: 15 kW · Squad outpost: 5 kW · Company FOB: 50 kW
                </p>
              )}
            </div>

            {/* Weather */}
            <div>
              <Label>Weather</Label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="mt-2 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                <option value="clear">Clear sky</option>
                <option value="haze">Haze</option>
                <option value="smoke">Smoke / Battlefield</option>
                <option value="rain">Rain</option>
                {mode === "space" && <option value="fog">Fog / Cloud cover</option>}
              </select>
            </div>

            {/* Run button */}
            <button
              onClick={runSim}
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: loading ? "rgba(99,102,241,0.4)" : "var(--accent)",
                color: "#fff",
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Running simulation…" : "Run Simulation"}
            </button>
          </div>

          {/* Results Area */}
          <div>
            {error && (
              <div
                className="rounded-xl p-4 text-sm mb-5"
                style={{ background: "rgba(127,29,29,0.15)", border: "1px solid rgba(127,29,29,0.6)", color: "#fca5a5" }}
              >
                <strong>Error:</strong> {error}
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-80">
                <div className="text-4xl animate-pulse mb-4" style={{ color: "var(--accent)" }}>◎</div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Running physics simulation…</p>
              </div>
            )}

            {!result && !loading && !error && (
              <div
                className="flex flex-col items-center justify-center h-80 text-center rounded-xl"
                style={{ border: "1px dashed var(--border)" }}
              >
                <div className="text-4xl font-light" style={{ color: "var(--border-bright)" }}>◎</div>
                <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
                  Loading default scenario…
                </p>
              </div>
            )}

            {result && !loading && (() => {
              const r = result as { mode: string };
              if (r.mode === "compare") return <ComparePanel result={result as CompareResult} />;
              if (r.mode === "optimized") return <OptimizedResultPanel result={result as OptimizedResult} />;
              if (r.mode === "space_laser" || r.mode === "space_microwave") return <SpaceResultPanel result={result as SpaceResult} />;
              return <ResultPanel result={result as SimResult} />;
            })()}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="mt-16 py-6 px-6 text-center text-xs"
        style={{ borderTop: "1px solid var(--border)", color: "var(--text-subtle)" }}
      >
        Physics validated against ITU-R P.838-3 · DARPA POWER PRAD 2025 · JAXA SSPS 2021 · NRL PRAM 2021 · Caltech MAPLE 2023
      </footer>
    </div>
  );
}
