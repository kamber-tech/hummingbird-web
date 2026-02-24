"use client";

import { useState } from "react";
import { getFinancial } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";

type FinancialResult = {
  roi: {
    kwh_per_year: number;
    diesel_liters_yr: number;
    diesel_cost_yr_usd: number;
    diesel_cost_per_kwh: number;
    wpt_maintenance_yr_usd: number;
    annual_savings_usd: number;
    capex_usd: number;
    payback_years: number;
    npv_usd: number;
    irr_pct: number | null;
    system_life_years: number;
    cash_flows: number[];
  };
  convoy: {
    convoy_distance_km: number;
    trips_per_year: number;
    cost_per_trip_usd: number;
    current_convoy_cost_yr: number;
    fraction_eliminated: number;
    trips_eliminated_yr: number;
    convoy_cost_saved_yr_usd: number;
    expected_risk_reduction: number;
    fuel_weight_saved_kg_yr: number;
  };
  sbir: {
    phase_i: {
      budget_usd: number;
      estimated_cost_usd: number;
      feasible: boolean;
      surplus_deficit_usd: number;
      months: number;
    };
    phase_ii: {
      budget_usd: number;
      estimated_cost_usd: number;
      feasible: boolean;
      surplus_deficit_usd: number;
      months: number;
    };
    phase_iii_target: number;
  };
  scaling: Array<{
    units_produced: number;
    unit_cost_usd: number;
    total_rev_usd: number;
    cost_reduction_pct: number;
  }>;
};

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${abs.toFixed(digits)}`;
}

const SURFACE = { background: "var(--surface)", border: "1px solid var(--border)" } as const;
const SURFACE2 = { background: "var(--surface-2)", border: "1px solid var(--border)" } as const;
const MUTED: React.CSSProperties = { color: "var(--text-muted)" };
const SUBTLE: React.CSSProperties = { color: "var(--text-subtle)" };
const TEXT: React.CSSProperties = { color: "var(--text)" };
const GREEN: React.CSSProperties = { color: "var(--green)" };
const ORANGE: React.CSSProperties = { color: "#f97316" };

export default function FinancialPage() {
  const [systemCost, setSystemCost] = useState(750000);
  const [powerKw, setPowerKw] = useState(15);
  const [convoyDist, setConvoyDist] = useState(100);
  const [convoyTrips, setConvoyTrips] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinancialResult | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const d = await getFinancial({
        system_cost_usd: systemCost,
        power_kw: powerKw,
        convoy_distance_km: convoyDist,
        convoy_trips_month: convoyTrips,
      });
      setResult(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const cashFlowData = result?.roi.cash_flows.map((cf, i) => ({
    year: i,
    cashflow: cf,
    cumulative: result.roi.cash_flows.slice(0, i + 1).reduce((a, b) => a + b, 0),
  })) ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={TEXT}>Financial Model</h1>
        <p className="mt-1 text-sm" style={MUTED}>
          ROI, NPV, payback analysis and SBIR alignment
        </p>
        <div className="h-px mt-4" style={{ background: "linear-gradient(to right, var(--accent), transparent)" }} />
      </div>

      {/* Controls */}
      <div className="rounded-xl p-5 mb-6" style={SURFACE}>
        <div className="text-xs font-medium uppercase tracking-wider mb-5" style={MUTED}>Inputs</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { label: "System cost", display: `$${(systemCost / 1000).toFixed(0)}k`, min: 50000, max: 5000000, step: 50000, value: systemCost, set: setSystemCost },
            { label: "Power", display: `${powerKw} kW`, min: 1, max: 50, step: 0.5, value: powerKw, set: setPowerKw },
            { label: "Convoy distance", display: `${convoyDist} km`, min: 10, max: 500, step: 10, value: convoyDist, set: setConvoyDist },
            { label: "Convoy trips / month", display: String(convoyTrips), min: 1, max: 20, step: 1, value: convoyTrips, set: setConvoyTrips },
          ].map((ctrl) => (
            <div key={ctrl.label}>
              <div className="flex justify-between text-xs mb-2" style={MUTED}>
                <span>{ctrl.label}</span>
                <span className="font-mono" style={TEXT}>{ctrl.display}</span>
              </div>
              <input
                type="range"
                min={ctrl.min} max={ctrl.max} step={ctrl.step}
                value={ctrl.value}
                onChange={(e) => ctrl.set(Number(e.target.value) as never)}
                className="w-full"
                style={{ accentColor: "var(--accent)" }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="mt-5 py-2 px-8 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: loading ? "var(--surface-2)" : "var(--accent)",
            color: loading ? "var(--text-muted)" : "#fff",
            border: "1px solid transparent",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Calculating..." : "Run Financial Model"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm mb-6" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!result && !loading && (
        <div className="flex flex-col items-center justify-center py-24 rounded-xl" style={SURFACE}>
          <p className="text-sm font-mono" style={SUBTLE}>Configure inputs above and run the model</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          {/* ROI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Annual savings", value: `$${fmt(result.roi.annual_savings_usd)}`, style: GREEN },
              {
                label: "Payback period",
                value: `${result.roi.payback_years.toFixed(1)} yrs`,
                style: result.roi.payback_years < 5 ? GREEN : result.roi.payback_years < 10 ? ORANGE : { color: "#ef4444" },
              },
              { label: "NPV (10yr @8%)", value: `$${fmt(result.roi.npv_usd)}`, style: result.roi.npv_usd > 0 ? GREEN : ORANGE },
              { label: "IRR", value: result.roi.irr_pct != null ? `${result.roi.irr_pct.toFixed(1)}%` : "—", style: { color: "var(--accent)" } },
            ].map((m) => (
              <div key={m.label} className="rounded-xl p-4" style={SURFACE}>
                <div className="text-xs uppercase tracking-wider mb-2" style={MUTED}>{m.label}</div>
                <div className="text-2xl font-mono font-bold" style={m.style}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Cash flow chart */}
          <div className="rounded-xl p-6" style={SURFACE}>
            <div className="text-xs font-medium uppercase tracking-wider mb-4" style={MUTED}>Cumulative Cash Flow</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  label={{ value: "Year", position: "insideBottom", offset: -5, fill: "var(--text-subtle)" }}
                />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6 }}
                  formatter={(v: number | undefined) => v != null ? `$${(v / 1000).toFixed(0)}k` : "—"}
                />
                <Line
                  type="monotone" dataKey="cumulative" stroke="var(--green)"
                  strokeWidth={2} dot={{ fill: "var(--green)", r: 3 }} name="Cumulative"
                />
                <Line
                  type="monotone" dataKey="cashflow" stroke="var(--accent)"
                  strokeWidth={1} dot={false} strokeDasharray="4 4" name="Annual"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Convoy economics + SBIR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl p-5" style={SURFACE}>
              <div className="text-xs font-medium uppercase tracking-wider mb-4" style={MUTED}>Convoy Economics</div>
              <div className="space-y-3 text-sm">
                {[
                  ["Convoy distance", `${result.convoy.convoy_distance_km} km`],
                  ["Annual trips", String(result.convoy.trips_per_year)],
                  ["Cost per trip", `$${result.convoy.cost_per_trip_usd.toLocaleString()}`],
                  ["Trips eliminated/yr", `${result.convoy.trips_eliminated_yr.toFixed(0)} (${(result.convoy.fraction_eliminated * 100).toFixed(0)}%)`],
                  ["Convoy cost saved/yr", `$${result.convoy.convoy_cost_saved_yr_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                  ["Risk reduction", `${result.convoy.expected_risk_reduction.toFixed(3)} lives/yr`],
                  ["Fuel weight saved", `${result.convoy.fuel_weight_saved_kg_yr.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg/yr`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span style={MUTED}>{k}</span>
                    <span className="font-mono" style={TEXT}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-5" style={SURFACE}>
              <div className="text-xs font-medium uppercase tracking-wider mb-4" style={MUTED}>SBIR Budget Alignment</div>
              <div className="space-y-4">
                {(["phase_i", "phase_ii"] as const).map((phase) => {
                  const p = result.sbir[phase];
                  const pct = (p.estimated_cost_usd / p.budget_usd) * 100;
                  return (
                    <div key={phase}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium" style={TEXT}>{phase === "phase_i" ? "Phase I" : "Phase II"}</span>
                        <span style={p.feasible ? GREEN : { color: "#ef4444" }}>
                          {p.feasible ? "FITS" : "OVER BUDGET"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs mb-1" style={MUTED}>
                        <span>Budget: ${(p.budget_usd / 1000).toFixed(0)}k</span>
                        <span>Est: ${(p.estimated_cost_usd / 1000).toFixed(0)}k</span>
                        <span>{p.months} months</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%`, background: p.feasible ? "var(--green)" : "#ef4444" }}
                        />
                      </div>
                      <div className="text-xs mt-1" style={SUBTLE}>
                        {p.feasible
                          ? `$${(p.surplus_deficit_usd / 1000).toFixed(0)}k remaining`
                          : `$${(Math.abs(p.surplus_deficit_usd) / 1000).toFixed(0)}k over budget`}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between text-sm pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <span style={MUTED}>Phase III Target</span>
                  <span className="font-mono" style={TEXT}>${(result.sbir.phase_iii_target / 1_000_000).toFixed(0)}M</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scaling analysis */}
          <div className="rounded-xl p-6" style={SURFACE}>
            <div className="text-xs font-medium uppercase tracking-wider mb-4" style={MUTED}>
              Production Scaling — Wright&apos;s Law (18% learning rate)
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={result.scaling} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="units_produced" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6 }}
                  formatter={(v: number | undefined) => v != null ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                />
                <Bar dataKey="unit_cost_usd" name="Unit Cost" radius={[4, 4, 0, 0]}>
                  {result.scaling.map((_, i) => (
                    <Cell key={i} fill={`hsl(${240 - i * 15}, 70%, ${40 + i * 4}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <table className="w-full mt-4 text-xs font-mono text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Units", "Unit Cost", "Cost Reduction", "Total Rev"].map((h) => (
                    <th key={h} className="pb-2 pr-6 font-medium uppercase tracking-wider" style={MUTED}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.scaling.map((row) => (
                  <tr key={row.units_produced} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-1.5 pr-6" style={TEXT}>{row.units_produced.toLocaleString()}</td>
                    <td className="py-1.5 pr-6" style={GREEN}>${row.unit_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-1.5 pr-6" style={ORANGE}>{row.cost_reduction_pct.toFixed(1)}%</td>
                    <td className="py-1.5" style={MUTED}>${(row.total_rev_usd / 1_000_000).toFixed(1)}M</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
