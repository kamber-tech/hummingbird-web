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
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(digits)}k`;
  return `${sign}${abs.toFixed(digits)}`;
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

// ── Efficiency Roadmap helpers ────────────────────────────────────────────────

function getEfficiencyExplanation(mode: string, eff: number, condition: string, range: number): string {
  if (mode === "laser") {
    if (condition === "fog") return "Fog completely blocks the laser beam — no power can be delivered through cloud cover. This is a fundamental limit of optical WPT.";
    if (condition === "smoke") return `Smoke/battlefield aerosols scatter ${(range * 8).toFixed(0)} dB of laser power over ${range.toFixed(1)} km. Direct laser WPT through smoke is extremely lossy — the relay-regeneration architecture solves this.`;
    if (eff < 3) return `At ${range.toFixed(1)} km, geometric beam spread captures only a tiny fraction of the transmitted power at the receiver aperture. The beam is physically larger than the receiver at this range.`;
    return `Laser wall-plug efficiency (~40%) × atmospheric transmission × geometric capture × PV cell efficiency (~35–55%) × DC conditioning. Each stage multiplies the losses.`;
  } else {
    if (range > 1) return `At ${range.toFixed(1)} km, the 5.8 GHz beam is ${(range * 55).toFixed(0)} m wide — far larger than any portable receiver. Beam divergence is the dominant loss for microwave beyond 500m.`;
    return `Phased array efficiency (~55% PA) × free-space path loss × atmospheric loss × rectenna conversion (~85% at full power). At short range, rectenna efficiency and PA losses dominate.`;
  }
}

function getImprovements(mode: string, condition: string, range: number, _baseEff: number): Array<{title: string; gain: string; desc: string; difficulty: string}> {
  const improvements: Array<{title: string; gain: string; desc: string; difficulty: string}> = [];

  if (mode === "laser") {
    improvements.push({
      title: "Adaptive optics pre-compensation",
      gain: "2–3×",
      desc: "Wavefront correction before transmission reduces turbulence-induced spreading. AFRL demonstrated 2–4× improvement.",
      difficulty: "Medium"
    });
    improvements.push({
      title: "InP photovoltaic cells (55%)",
      gain: "+10% eff",
      desc: "Best-in-class monochromatic PV at 1070nm. Alta Devices/NextGen measured 55.2% in 2023. Default uses 50% GaAs (1.10× improvement to 55% InP).",
      difficulty: "Available now"
    });
    improvements.push({
      title: "Larger receive aperture",
      gain: "2× efficiency",
      desc: "Doubling receiver diameter tightens the effective beam capture. At short range baseline already captures full beam — gain is from reduced divergence and tighter focus.",
      difficulty: "Hardware cost"
    });
    if (condition === "smoke" || condition === "fog") {
      improvements.push({
        title: "Switch to 1550nm wavelength",
        gain: "40% less loss",
        desc: "1550nm has lower Mie scattering in smoke/dust. Also eye-safe — no exclusion zones for personnel.",
        difficulty: "System redesign"
      });
      improvements.push({
        title: "Relay-regeneration chain",
        gain: "1000×+ in smoke",
        desc: "Split the link into 1km hops with relay drones. Each hop resets the attenuation budget. The Aether core innovation.",
        difficulty: "Novel — Aether IP"
      });
    }
  } else {
    improvements.push({
      title: "Larger transmit array",
      gain: "4× at 2×dia",
      desc: "Doubling array diameter tightens the beam and quadruples received power. Dominant improvement for microwave.",
      difficulty: "Size/weight tradeoff"
    });
    improvements.push({
      title: "Larger receive rectenna",
      gain: "Proportional",
      desc: "Rectenna area directly sets how much of the beam is captured. Truck-deployable 50m² panels are feasible.",
      difficulty: "Deployment logistics"
    });
    if (range > 0.5) {
      improvements.push({
        title: "Reduce range — use relay nodes",
        gain: "16× at half range",
        desc: "Microwave efficiency scales as range⁻⁴ in far-field. Halving range improves efficiency 16×. Use relay nodes at 500m spacing.",
        difficulty: "Operational change"
      });
    }
    improvements.push({
      title: "Increase operating frequency to 35 GHz",
      gain: "Tighter beam",
      desc: "Higher frequency → shorter wavelength → smaller beam at range. Tradeoff: higher rain attenuation.",
      difficulty: "System redesign"
    });
  }

  return improvements;
}

function EfficiencyRoadmap({ result }: { result: SimResult }) {
  const eff = result.system_efficiency_pct;
  const mode = result.mode;
  const condition = result.condition;
  const range = result.range_km;

  const whyLow = getEfficiencyExplanation(mode, eff, condition, range);
  const improvements = getImprovements(mode, condition, range, eff);

  return (
    <div className="space-y-4">
      {/* Current vs possible */}
      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
          <span>Current: {eff.toFixed(1)}%</span>
          <span>Theoretical max: ~35%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(eff / 35 * 100, 100)}%`,
              background: "linear-gradient(to right, var(--accent), #22c55e)"
            }}
          />
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Real-world ceiling ~20% (DARPA POWER PRAD 2025)
        </div>
      </div>

      {/* Why */}
      <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
        <span className="font-medium" style={{ color: "var(--text)" }}>Why {eff.toFixed(1)}%: </span>
        {whyLow}
      </div>

      {/* Improvements */}
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          What would help most
        </div>
        {improvements.map((imp, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-xs font-mono w-16 shrink-0" style={{ color: "#4ade80" }}>+{imp.gain}</div>
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{imp.title}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{imp.desc}</div>
            </div>
            <div className="ml-auto text-xs" style={{ color: "var(--text-subtle)" }}>{imp.difficulty}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancialsTab({ result }: { result: SimResult }) {
  const convoys = result.convoys_eliminated_yr;
  const daysPerConvoy = convoys > 0 ? Math.round(365 / convoys) : null;
  const fuelLPerYr = Math.round(result.fuel_saved_l_day * 365);
  const fuelCost = result.fuel_cost_saved_yr_usd;
  const convoyCost = result.convoy_cost_saved_yr_usd;
  const totalVal = result.total_value_yr_usd;
  const SYSTEM_COST = 750000;
  const paybackMonths = totalVal > 0 ? Math.round((SYSTEM_COST / totalVal) * 12) : null;
  const OPEX_YR = 50000; // estimated annual maintenance + monitoring
  const netVal = totalVal - OPEX_YR;

  const fiveYearRows = [1, 2, 3, 4, 5].map((yr) => ({
    yr,
    gross: totalVal * yr,
    cost: SYSTEM_COST + OPEX_YR * yr,
    net: totalVal * yr - SYSTEM_COST - OPEX_YR * yr,
  }));

  return (
    <div className="space-y-5">

      {/* Convoy card */}
      <div className="rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Convoys eliminated</span>
          <span className="text-base font-mono font-bold" style={{ color: "var(--green)" }}>
            {convoys >= 1 ? `${convoys.toFixed(0)} per year` : `< 1 per year`}
          </span>
        </div>
        {convoys >= 1 && daysPerConvoy && (
          <p className="text-xs mb-3" style={{ color: "var(--text-subtle)" }}>
            One fewer resupply mission every {daysPerConvoy} day{daysPerConvoy !== 1 ? "s" : ""} — each one a crew in an IED threat environment.
          </p>
        )}
        <div className="space-y-1">
          {[
            "Each convoy = vehicle crew exposed to IED, ambush, and VBIED threat",
            "Average convoy strength: 4–8 personnel, 2–4 MRAP/LMTV vehicles",
            "1 casualty per 24 convoys in active conflict zones (Army SMP data)",
            "Eliminating convoys removes the primary logistics-related casualty risk",
          ].map((b, i) => (
            <div key={i} className="flex gap-2 text-xs" style={{ color: "var(--text-subtle)" }}>
              <span style={{ color: "#f97316" }}>—</span>
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* Fuel cost card */}
      <div className="rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Fuel cost saved</span>
          <span className="text-base font-mono font-bold" style={{ color: "var(--text)" }}>
            ${fmt(fuelCost)} / yr
          </span>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-subtle)" }}>
          {fuelLPerYr.toLocaleString()} L of diesel per year that never needs to reach the FOB.
        </p>
        <div className="space-y-1">
          {[
            "$12/L fully-burdened DoD fuel cost (RAND Corporation, inflation-adjusted 2025)",
            "Includes: theater transport, last-mile delivery, security escort, infrastructure, overhead",
            `Pump price is ~$0.80/L — the $11.20 premium is the true logistics cost`,
            "Not included: risk insurance, casualty-related costs, strategic disruption value",
          ].map((b, i) => (
            <div key={i} className="flex gap-2 text-xs" style={{ color: "var(--text-subtle)" }}>
              <span style={{ color: "#60a5fa" }}>—</span>
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* Convoy cost card */}
      <div className="rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Convoy operations cost saved</span>
          <span className="text-base font-mono font-bold" style={{ color: "var(--text)" }}>
            ${fmt(convoyCost)} / yr
          </span>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-subtle)" }}>
          DoD $600/mile fully-burdened convoy estimate. A {`100 km`} round-trip run costs ~$37,200.
        </p>
        <div className="space-y-1">
          {[
            "Crew time + hazard pay: ~$8,000 per mission",
            "Vehicle operating cost (MRAP/LMTV): ~$12,000 per mission",
            "Security escort + route clearance: ~$10,000 per mission",
            "Fuel, maintenance, supply chain overhead: ~$7,200 per mission",
            "Risk premium / insurance equivalent: not counted in base estimate",
          ].map((b, i) => (
            <div key={i} className="flex gap-2 text-xs" style={{ color: "var(--text-subtle)" }}>
              <span style={{ color: "#a78bfa" }}>—</span>
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* Operating context */}
      <div className="rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Operating costs (WPT system)
        </div>
        <div className="space-y-1 mb-3">
          {[
            "Input power: drawn from main base generator (already running) — effectively $0 incremental",
            `At ${result.system_efficiency_pct.toFixed(1)}% system efficiency: ${result.electrical_input_kw.toFixed(0)} kW input → ${result.dc_power_delivered_kw.toFixed(1)} kW delivered`,
            "Maintenance: field-serviceable optics, estimated $40–60k/yr for 2-person tech team",
            "No fuel logistics required for the transmission itself — that's the point",
            "System lifetime: 10–15 years (military ruggedized hardware)",
          ].map((b, i) => (
            <div key={i} className="flex gap-2 text-xs" style={{ color: "var(--text-subtle)" }}>
              <span style={{ color: "#facc15" }}>—</span>
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* 5-year projection */}
      {totalVal > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            5-year economic projection — $750k system, ~$50k/yr opex
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Year", "Gross savings", "Total cost", "Net position"].map((h) => (
                    <th key={h} className="text-left pb-1.5 pr-4 font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fiveYearRows.map((r) => (
                  <tr key={r.yr} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-1.5 pr-4" style={{ color: "var(--text-muted)" }}>Y{r.yr}</td>
                    <td className="py-1.5 pr-4" style={{ color: "var(--green)" }}>${fmt(r.gross)}</td>
                    <td className="py-1.5 pr-4" style={{ color: "#f97316" }}>${fmt(r.cost)}</td>
                    <td className="py-1.5 pr-4" style={{ color: r.net > 0 ? "var(--green)" : "#f97316", fontWeight: r.net > 0 ? 600 : 400 }}>
                      {r.net > 0 ? "+" : ""}${fmt(Math.abs(r.net))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paybackMonths && (
            <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              Payback:{" "}
              <span className="font-semibold" style={{ color: paybackMonths > 360 ? "#f97316" : "var(--green)" }}>
                {paybackMonths > 360 ? "Not viable (>30 yr)" : `${paybackMonths} month${paybackMonths !== 1 ? "s" : ""}`}
              </span>
              {" "}after deployment · 5-year net:{" "}
              <span className="font-semibold" style={{ color: fiveYearRows[4].net >= 0 ? "var(--green)" : "#f97316" }}>
                {fiveYearRows[4].net >= 0 ? "+" : "-"}${fmt(Math.abs(fiveYearRows[4].net))}
              </span>
              {" "}· Net annual value after opex:{" "}
              <span className="font-semibold" style={{ color: netVal >= 0 ? "var(--green)" : "#f97316" }}>
                {netVal >= 0 ? "+" : "-"}${fmt(Math.abs(netVal))}
              </span>/yr
            </div>
          )}
        </div>
      )}

      <div className="text-xs" style={{ color: "var(--text-subtle)", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
        Sources: RAND Corporation fully-burdened fuel cost · DoD convoy cost $600/mile · Army SMP casualty data · FOB baseline 15 kW ·
        System cost assumption $750k (DoD procurement estimate, not retail) · Opex estimate $50k/yr
      </div>
    </div>
  );
}

function SavingsSection({ result }: { result: SimResult }) {
  const [tab, setTab] = useState<"financials" | "roadmap">("financials");

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {/* Tab bar */}
      <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
        <button
          onClick={() => setTab("financials")}
          className="px-4 py-2.5 text-xs font-medium transition-colors"
          style={
            tab === "financials"
              ? { color: "var(--text)", borderBottom: "2px solid var(--accent)" }
              : { color: "var(--text-muted)" }
          }
        >
          Financials
        </button>
        <button
          onClick={() => setTab("roadmap")}
          className="px-4 py-2.5 text-xs font-medium transition-colors"
          style={
            tab === "roadmap"
              ? { color: "var(--text)", borderBottom: "2px solid var(--accent)" }
              : { color: "var(--text-muted)" }
          }
        >
          Efficiency Roadmap
        </button>
      </div>

      <div className="p-5">
        {tab === "financials" ? (
          <FinancialsTab result={result} />
        ) : (
          <EfficiencyRoadmap result={result} />
        )}
      </div>
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
    const bestMode = result.feasibility?.best_mode_for_range;
    const modeHint = bestMode && bestMode !== result.mode
      ? ` Consider switching to ${bestMode} for this scenario.`
      : ` Consider reducing range for better efficiency.`;
    text = `This scenario is physically possible but marginal — only ${eff.toFixed(1)}% of input power reaches the receiver.${modeHint}`;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
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
          value={`${result.convoys_eliminated_yr.toFixed(0)} per year`}
          sub="↓ IED exposure per mission"
          highlight={feasible && result.convoys_eliminated_yr >= 1}
        />
        <KPI
          label="Fuel resupply saved"
          value={`${result.fuel_saved_l_day.toFixed(0)} L/day`}
          sub="generator diesel per day"
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

      {/* Financials + Efficiency Roadmap tabs */}
      <SavingsSection result={result} />

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>Baseline</div>
          <div className="space-y-2">
            <Row label="Efficiency" value={`${base.system_efficiency_pct.toFixed(1)}%`} />
            <Row label="DC delivered" value={`${base.dc_power_delivered_kw.toFixed(2)} kW`} />
            <Row label="Convoys cut" value={`${base.convoys_eliminated_yr?.toFixed(0) ?? "—"} per year`} />
            <Row label="Annual value" value={`$${fmt(base.total_value_yr_usd)}`} />
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ border: "1px solid var(--accent)", background: "var(--accent-dim)" }}>
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--accent)" }}>Optimized</div>
          <div className="space-y-2">
            <Row label="Efficiency" value={`${optimized.system_efficiency_pct.toFixed(1)}%`} />
            <Row label="DC delivered" value={`${optimized.dc_power_delivered_kw.toFixed(2)} kW`} />
            <Row label="Convoys cut" value={`${optimized.convoys_eliminated_yr?.toFixed(0) ?? "—"} per year`} />
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
        Efficiency cap is range-dependent: 33% @ 0.5 km, 29% @ 2 km, 19% @ 8.6 km — anchored to DARPA PRAD 2025 (~20% real-world). 
        Optimized figures represent best-case hardware configurations; real deployments will vary.
      </div>
    </div>
  );
}

// ── Use Cases ─────────────────────────────────────────────────────────────────

type UseCase = {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  oneLiner: string;
  keyStats: string;
  presets: { mode: "laser" | "microwave" | "compare"; rangeM: number; powerKw: number; condition: string };
  explanation: string;
  math: string;
  spacePreset?: { orbit: string; spaceMode: "laser" | "microwave" };
};

const USE_CASES: UseCase[] = [
  {
    id: "drone_isr",
    title: "Persistent Drone ISR",
    tag: "Easiest · Active DARPA program",
    tagColor: "green",
    oneLiner: "Keep surveillance drones airborne indefinitely — no RTB to recharge.",
    keyStats: "24/7 loiter vs 90-min battery",
    presets: { mode: "laser", rangeM: 300, powerKw: 0.5, condition: "clear" },
    explanation: `An ISR (Intelligence, Surveillance, Reconnaissance) drone flies 90–120 minutes on battery before returning to base to recharge. During that RTB window, the mission goes dark.

WPT from a ground station at 100–500m beams power up to the hovering drone continuously. The drone never lands. The mission never stops.

DARPA committed active funding to this exact use case in 2024 (far-field wireless power beaming to UAVs in flight). PowerLight Technologies demonstrated kilowatt-class laser WPT to a UAV under CENTCOM sponsorship in 2025.`,
    math: `Drone power draw: ~200–500W continuous flight (DJI Matrice / Skydio X10 class)
Required WPT delivery: 300–600W at receiver
Range: 100–500m (ground station to hovering drone)
At 300m, laser beam radius: ~0.3mm–2cm → receiver captures nearly all power
System efficiency at 300m clear sky: 15–25%
Required optical power: ~2–3 kW from ground transmitter
Transmitter size: ~0.5m telescope, 5 kg — fits on a vehicle or tripod
Loiter extension: battery → 90 min; WPT → unlimited
Real-world anchor: PowerLight PTROL-UAS (2025), DARPA FENCE program (2024)`,
  },
  {
    id: "remote_sensor",
    title: "Remote Sensor Networks",
    tag: "No convoy needed",
    tagColor: "blue",
    oneLiner: "Power border sensors and ISR nodes indefinitely — no battery swaps, no resupply.",
    keyStats: "Eliminates physical access missions",
    presets: { mode: "microwave", rangeM: 1000, powerKw: 0.1, condition: "rain" },
    explanation: `Acoustic, seismic, radar, and SIGINT sensors are deployed on hilltops, ridgelines, and border terrain. Currently powered by batteries (replaced every few weeks by exposed personnel) or solar panels (visible from satellite, easily targeted).

WPT from a concealed or elevated transmitter powers them indefinitely with zero physical access required. Fixed geometry means the aperture is optimized once. Microwave works in all weather — rain, fog, dust — making it ideal for persistent unattended sensor networks.

The value isn't just power — it's eliminating the resupply mission that exposes soldiers to IED risk.`,
    math: `Typical sensor power: 10–200W continuous (radar node: ~100W, acoustic: ~10W)
Target: 100W delivered at 1 km in rain
Microwave at 1 km, rain (50mm/hr): 0.44 dB/km attenuation — essentially no weather degradation
Required TX array: ~50m² phased array, vehicle-mountable
Fixed geometry → beam pointed once, locked permanently
No pointing/tracking required (sensor doesn't move)
Comparison: battery replacement mission every 3 weeks at $15k/mission → $260k/yr per node
WPT system cost: ~$200k one-time, then $0 in resupply missions
Payback period: < 1 year per node`,
  },
  {
    id: "shipboard",
    title: "Shipboard Drone Charging",
    tag: "Navy · Short range · High efficiency",
    tagColor: "blue",
    oneLiner: "Recharge naval drones mid-hover without physical connectors or deck handling.",
    keyStats: "10–50m range · 30%+ efficiency",
    presets: { mode: "laser", rangeM: 500, powerKw: 1, condition: "clear" },
    explanation: `Navy ships launch and recover drones continuously for ISR, ASW (anti-submarine warfare), and logistics. Physical connectors require deck handling — a hazardous operation in sea state, consuming deck crew time and limiting sortie rate.

WPT at 10–50m (drone hovering near the ship's mast or deck edge) eliminates the connector entirely. The drone charges while hovering, keeping optics stable and reducing mechanical wear on landing gear.

Very short range means excellent physics: the beam is tight, efficiency is high, hardware is compact. This is the most physically favorable WPT scenario in the DoD inventory.`,
    math: `Range: 10–50m (drone hovering near ship)
At 30m, laser beam radius: ~0.03mm — entire beam fits on a coin
Geometric capture efficiency: >99%
System efficiency at 30m: 30–40% (near theoretical maximum)
Drone power: 500W–2kW (MQ-8 Fire Scout class)
Required transmitter: 2–5 kW optical, 0.3m aperture
Weight: ~3 kg transmitter pod (mast-mounted)
No weather block at 30m — even fog over 30m is only 0.3–0.9 dB
Current alternative: physical connectors + deck crew = 15 min turnaround
WPT: continuous charge, zero deck handling, sub-1-min power-up`,
  },
  {
    id: "fob_power",
    title: "FOB Power Supply",
    tag: "Primary mission · DoD Tier 1",
    tagColor: "indigo",
    oneLiner: "Eliminate fuel convoys to forward operating bases — the most dangerous logistics mission in the DoD.",
    keyStats: "~79 convoys/yr eliminated at 2km",
    presets: { mode: "laser", rangeM: 2000, powerKw: 15, condition: "clear" },
    explanation: `Every fuel convoy to a Forward Operating Base (FOB) is a target. The DoD's fully-burdened fuel cost is $12/L — but the real cost is the convoy itself: IED exposure, personnel risk, logistics complexity.

A 15 kW laser WPT system at 2km delivers enough power for a small platoon-level FOB, eliminating the resupply mission for electricity entirely. The transmitter stays at a protected position (main base, vehicle, or elevated platform) and beams power forward.

In clear conditions, laser WPT at 2km delivers target power at 6–8% system efficiency. The system pays for itself in eliminated convoy costs within 12–18 months.`,
    math: `FOB power demand: 15 kW (platoon-level, MEP-804A generator equivalent)
Generator fuel burn: 4.5 L/hr at full load = 108 L/day
Convoy threshold: 500 L per resupply run = convoy every ~4.6 days
Annual convoys: ~79 resupply missions to sustain one small FOB
WPT at 2km clear sky: delivers 15 kW, eliminates all convoy missions
Fuel cost saved: $12/L × 39,420 L/yr = $473k/yr
Convoy cost saved: $600/mile × 62 miles × 79 convoys = $2.93M/yr
Total annual value: ~$3.4M/yr per FOB
DoD fully-burdened fuel cost reference: RAND Corporation (2012), inflation-adjusted 2025`,
  },
  {
    id: "battlefield_relay",
    title: "Battlefield Relay Chain",
    tag: "Novel · Relay-regeneration",
    tagColor: "orange",
    oneLiner: "Deliver power through smoke and terrain using autonomous drone relay hops — the architecture no one else has built.",
    keyStats: "5km through smoke: impossible direct, possible via relay",
    presets: { mode: "compare", rangeM: 2000, powerKw: 5, condition: "smoke" },
    explanation: `Direct WPT through battlefield smoke fails completely — 8 dB/km extinction at 1070nm means 40 dB loss over 5km. Zero power delivered.

The relay-regeneration architecture solves this: instead of one 5km link, run 5 × 1km links with autonomous drone relay nodes between them. Each relay receives power, buffers it, and retransmits. Each 1km segment only loses 8 dB — regenerated at each hop.

Using 1550nm (eye-safe, lower smoke scattering than 1070nm, telecom-grade erbium fiber amplifiers): per-segment loss drops further. No existing program uses this architecture. It's the core Aether innovation.`,
    math: `Direct laser (1070nm) at 5km in smoke (8 dB/km): loss = 40 dB → 0.01% power delivered
5-relay chain (1km segments): loss = 8 dB/segment → 15.8% per segment, regenerated
Net end-to-end after 5 hops (15% conversion loss/relay): ~3–5% of source power
At 10 kW source: 300–500W delivered at 5km through smoke (vs ~1W direct)
1550nm advantage: ~40% lower smoke extinction vs 1070nm
Eye safety: 1550nm Class 1 eye-safe at higher power levels
Component cost: EDFA amplifiers ~$5k/unit (telecom commodity)
Relay drone payload: ~5 kg (PV + buffer + retransmit laser)
Phase 1 demo: 100m links, smoke chamber, <$250k, 6 months`,
  },
  {
    id: "sof_outpost",
    title: "SOF Austere Outpost",
    tag: "Special Ops · Silent power",
    tagColor: "red",
    oneLiner: "Power a special operations patrol base with zero acoustic or thermal signature — the generator is a liability.",
    keyStats: "Generator noise = position compromise",
    presets: { mode: "laser", rangeM: 800, powerKw: 3, condition: "clear" },
    explanation: `A Special Operations Forces patrol base runs on strict signature management. A diesel generator at 70 dB can be detected at 400m. Its thermal signature is visible to any FLIR sensor. It consumes fuel that requires resupply — every resupply mission is exposure.

WPT from a concealed elevated transmitter (hilltop, vehicle-mounted, or tethered drone) delivers up to 3–5 kW silently. No engine. No exhaust. No supply convoy. The transmitter operates from a defended position 0.5–2 km away — outside any perimeter the SOF team is trying to hide from.

This is a USSOCOM procurement target. Silent, persistent power for austere deployments is a listed capability gap. AFWERX has funded related research; SOCOM acquisition pathway is SOFWERX rapid fielding.`,
    math: `SOF patrol base power: 3–5 kW (SATCOM, NV charging, medical, computing, comms)
NV charging: ~100W × 12 units = 1.2 kW
SATCOM terminal: 500W
Computing + comms: 1 kW
Margin / reserve: 300W
Total: ~3 kW sustained

Generator acoustic signature: 68–74 dB @ 7m → detectable at 300–500m in quiet terrain
Generator thermal signature: detectable by any FLIR system (engine temp ~200°C)

WPT at 800m clear sky: laser system delivers 3 kW target power
Transmitter: 0.3m telescope, vehicle-mounted or tripod, ~8 kg
Transmitter location: masked position 800m away, concealed, powered by main base

Annual value (eliminating signature risk): not fuel — OPSEC. One compromised position ≈ mission failure.
AFWERX precedent: Silent power for austere forward sites — SBIR topic active since FY2023
USSOCOM: Special Operations Forces Acquisition (SOFARS) rapid fielding pathway <12 months`,
  },
  {
    id: "counter_uas",
    title: "Counter-UAS Defense",
    tag: "C-UAS · Active defense",
    tagColor: "red",
    oneLiner: "Power a forward laser C-UAS weapon from protected standoff — no exposed cables, no generator at the weapon site.",
    keyStats: "1–10 kW to C-UAS at 1km standoff",
    presets: { mode: "laser", rangeM: 1000, powerKw: 10, condition: "clear" },
    explanation: `Counter-UAS laser weapons need power. The problem: placing a generator or running cables to a forward weapon emplacement exposes equipment and personnel. The generator is a target. The cable is a trip hazard and a vulnerability.

WPT solves the last-meter power problem for directed energy C-UAS systems. The power generator stays at a protected position 0.5–2 km back. A laser power beam delivers 5–10 kW to the C-UAS emitter at the forward weapon site. No cable. No generator at the weapon. Weapons can be repositioned without rerunning power infrastructure.

C-UAS is the fastest-growing segment of the DoD procurement budget post-Ukraine. Drone swarms are the defining threat. Power delivery to forward C-UAS positions is a real, funded acquisition need.`,
    math: `C-UAS laser weapon power: 5–25 kW (SkyWiper class: 10 kW, Raytheon HELWS: 20 kW+)
Low-power C-UAS (Drone Dome, LOCUST): 1–5 kW

WPT scenario:
- Source: 10 kW electrical input, 1km range, clear sky
- Laser WPT system efficiency at 1km: ~12–18%
- DC delivered to C-UAS weapon: ~1.2–1.8 kW
- Sufficient for: small C-UAS laser (1kW class) + tracking electronics

For higher power: relay node at 500m; each hop adds 12–18% link efficiency
To deliver 10 kW to C-UAS at 1km: requires ~65 kW source → needs multi-link or near-field

Key insight: WPT is not the primary weapon — it powers the C-UAS. Even 1–2 kW delivered to a forward position eliminates the exposure of fuel/cable.
Budget: Army C-UAS FY25 budget: $1.7B; power delivery is the bottleneck
References: DARPA ARES (C-UAS power), Army IFPC program, DoD Joint C-sUAS Office (JCO)`,
  },
  {
    id: "space_scale",
    title: "Space-to-Earth Scale",
    tag: "Future vision · LEO proven",
    tagColor: "purple",
    oneLiner: "From proven FOB systems to orbital power delivery — the same physics at planetary scale.",
    keyStats: "NRL PRAM: 10W from ISS (2021)",
    presets: { mode: "laser", rangeM: 2000, powerKw: 1, condition: "clear" },
    spacePreset: { orbit: "iss_leo", spaceMode: "laser" },
    explanation: `The same relay-regeneration architecture that works at 5km on the ground scales to Low Earth Orbit at 400km. The physics difference: FSPL over the full orbital distance, but atmospheric attenuation only through the last ~10–20km (vertical path through the atmosphere).

NRL demonstrated 10W of laser WPT from the ISS in 2021. Caltech MAPLE demonstrated the first in-space WPT in 2023. Aetherflux (founded by Robinhood's Baiju Bhatt, $60M raised) is targeting a 1kW LEO demo in 2026.

Aether's path: prove relay-regeneration on the ground (FOB case) → unit costs drop with DoD production volume → scale the same architecture to LEO. The ground program de-risks and funds the space program.`,
    math: `LEO altitude: 408km (ISS), 600km (standard)
At 600km, 2m aperture laser, 1070nm: beam radius at ground = 320m
Capture with 10m receiver: 0.046% geometric efficiency
Required optical power for 1kW delivered: ~2.2 MW (LEO is hard)
GEO (35,786km): requires 2.6km TX array + 3.5km² rectenna (JAXA SSPS concept)
The DoD path: ground WPT proven → costs fall → LEO becomes commercially viable
Reference: NRL PRAM 2021, Caltech MAPLE 2023, Aetherflux 2026 demo target
JAXA SSPS: 1 GW at GEO → 1 GW delivered (national grid scale, 2040s target)`,
  },
];

const UC_TAG_COLORS: Record<string, string> = {
  green:  "bg-green-950 text-green-400 border-green-900",
  blue:   "bg-blue-950 text-blue-400 border-blue-900",
  indigo: "bg-indigo-950 text-indigo-400 border-indigo-900",
  orange: "bg-orange-950 text-orange-400 border-orange-900",
  purple: "bg-purple-950 text-purple-400 border-purple-900",
  red:    "bg-red-950 text-red-400 border-red-900",
};

function UseCaseBar({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (uc: UseCase) => void;
}) {
  return (
    <div className="mb-8">
      <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>
        Use Cases
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin", WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)" }}>
        {USE_CASES.map((uc) => {
          const isSelected = selected === uc.id;
          return (
            <button
              key={uc.id}
              onClick={() => onSelect(uc)}
              className={`flex-shrink-0 w-48 text-left rounded-xl border p-4 transition-all ${
                isSelected ? "" : ""
              }`}
              style={
                isSelected
                  ? { border: "1px solid var(--accent)", background: "var(--accent-dim)" }
                  : { border: "1px solid var(--border)", background: "var(--surface)" }
              }
              onMouseEnter={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = "var(--border-bright)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border mb-2 ${UC_TAG_COLORS[uc.tagColor]}`}>
                {uc.tag}
              </div>
              <div className="text-sm font-semibold leading-snug mb-1" style={{ color: "var(--text)" }}>
                {uc.title}
              </div>
              <div className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
                {uc.oneLiner}
              </div>
              <div className="mt-2 text-xs font-mono" style={{ color: "var(--accent)" }}>
                {uc.keyStats}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScenarioContext({ uc }: { uc: UseCase }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <span
          className="py-2.5 text-xs font-medium"
          style={{ color: "var(--text)", borderBottom: "2px solid var(--accent)" }}
        >
          The Math
        </span>
        <a
          href="/qa"
          className="text-xs transition-colors"
          style={{ color: "var(--text-subtle)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-subtle)"; }}
        >
          Full context → Reference Q&amp;A
        </a>
      </div>
      <div className="p-5">
        <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}>
          {uc.math}
        </pre>
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

  // Use case selection
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);

  // Optimized mode sub-state
  const [baseMode, setBaseMode] = useState<"laser" | "microwave">("laser");
  const [optimizations, setOptimizations] = useState<string[]>(["adaptive_optics", "inp_cells", "large_aperture"]);

  function toggleOpt(key: string) {
    setOptimizations((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleUseCaseSelect(uc: UseCase) {
    setSelectedUseCase(uc);
    const newMode = uc.spacePreset && uc.id === "space_scale" ? ("space" as AppMode) : (uc.presets.mode as AppMode);
    const newRange = uc.presets.rangeM;
    const newPower = uc.presets.powerKw;
    const newCondition = uc.presets.condition;
    setMode(newMode);
    setRangeM(newRange);
    setPowerKw(newPower);
    setCondition(newCondition);
    if (uc.spacePreset && uc.id === "space_scale") {
      setOrbit(uc.spacePreset.orbit);
      setSpaceMode(uc.spacePreset.spaceMode);
    }
    // Run directly with preset values — avoids stale closure on state
    runSimWith({ mode: newMode, rangeM: newRange, powerKw: newPower, condition: newCondition });
  }

  async function runSimWith({ mode: m, rangeM: r, powerKw: p, condition: c }: { mode: AppMode; rangeM: number; powerKw: number; condition: string }) {
    setLoading(true);
    setError(null);
    try {
      let data: unknown;
      if (m === "space") {
        data = await simulateSpace({ mode: spaceMode, orbit, power_kw: p, condition: c });
      } else if (m === "optimized") {
        data = await simulateOptimized({ mode: baseMode, range_m: r, power_kw: p, condition: c, optimizations });
      } else if (m === "compare") {
        data = await simulate({ mode: "compare", range_m: r, power_kw: p, condition: c });
      } else {
        data = await simulate({ mode: m, range_m: r, power_kw: p, condition: c });
      }
      setResult(data as SimResult | CompareResult | SpaceResult | OptimizedResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
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

  // Auto-recalculate when mode or condition changes (if we've already run once)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (didAutoRun.current && result !== null) {
      runSim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, condition]);

  const modeDesc: Record<AppMode, string> = {
    laser: "Near-infrared beam (1070 nm). Best efficiency at range in clear conditions.",
    microwave: "5.8 GHz phased array. All-weather, effective within ~500 m with portable hardware.",
    compare: "Run both modes side by side at the same scenario parameters.",
    space: "Future scale — Space-to-Earth WPT from LEO/GEO. Proving the FOB case first de-risks this.",
    optimized: "Apply best-case hardware upgrades (AO, InP cells, larger apertures) to see ceiling efficiency.",
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {/* Hero — FOB-first framing, or use-case context when a scenario is selected */}
        {!selectedUseCase ? (
          <div className="mb-10 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold leading-snug" style={{ color: "var(--text)" }}>
              Deliver power to a forward operating base —{" "}
              <span style={{ color: "var(--accent)" }}>no fuel convoys required</span>
            </h1>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Aether models laser and microwave wireless power transmission for defense logistics.
              Calculate how much power reaches the FOB, what hardware it takes, and how many
              dangerous resupply missions it eliminates.
            </p>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <Stat label="Convoys eliminated per year" value="79+" sub="per 15 kW laser system at 2 km" />
              <Stat label="Fuel saved per day" value="108+ L" sub="diesel offset · 15 kW at 2 km" />
              <Stat label="Real-world anchor" value="800 W @ 8.6 km" sub="DARPA POWER PRAD 2025" />
            </div>
          </div>
        ) : (
          <div className="mb-10 max-w-2xl">
            <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border mb-3 ${UC_TAG_COLORS[selectedUseCase.tagColor]}`}>
              {selectedUseCase.tag}
            </div>
            <h1 className="text-2xl font-bold leading-snug" style={{ color: "var(--text)" }}>
              {selectedUseCase.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {selectedUseCase.oneLiner}
            </p>
            <button
              onClick={() => setSelectedUseCase(null)}
              className="mt-3 text-xs"
              style={{ color: "var(--text-subtle)" }}
            >
              ← Back to overview
            </button>
          </div>
        )}

        {/* Use Case scenario browser */}
        <UseCaseBar selected={selectedUseCase?.id ?? null} onSelect={handleUseCaseSelect} />

        <div className="grid lg:grid-cols-[380px_1fr] gap-8">
          {/* Config Panel */}
          <div
            className="rounded-xl p-6 space-y-6 lg:sticky lg:top-6 lg:self-start"
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
                      { key: "inp_cells", label: "InP PV cells (55%)", desc: "Best-in-class monochromatic PV vs 50% GaAs baseline (1.10× gain)" },
                      { key: "large_aperture", label: "Large aperture", desc: "2× area from larger optics — ~2× efficiency improvement" },
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
              let panel: React.ReactNode;
              if (r.mode === "compare") panel = <ComparePanel result={result as CompareResult} />;
              else if (r.mode === "optimized") panel = <OptimizedResultPanel result={result as OptimizedResult} />;
              else if (r.mode === "space_laser" || r.mode === "space_microwave") panel = <SpaceResultPanel result={result as SpaceResult} />;
              else panel = <ResultPanel result={result as SimResult} />;
              return (
                <div className="space-y-5">
                  {panel}
                  {selectedUseCase && <ScenarioContext uc={selectedUseCase} />}
                </div>
              );
            })()}
          </div>
        </div>
      </main>


    </div>
  );
}
