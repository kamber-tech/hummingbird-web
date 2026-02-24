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

function fmt(n: number | null | undefined, prefix = "", suffix = "") {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (Math.abs(n) >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}k${suffix}`;
  return `${prefix}${n.toFixed(1)}${suffix}`;
}

export default function FinancialPage() {
  const [systemCost, setSystemCost] = useState(500000);
  const [powerKw, setPowerKw] = useState(5);
  const [convoyDist, setConvoyDist] = useState(50);
  const [convoyTrips, setConvoyTrips] = useState(4);
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
        <h1 className="text-3xl font-bold text-white">Financial Model</h1>
        <p className="text-gray-400 mt-1">
          ROI, NPV, payback analysis and SBIR alignment
        </p>
        <div className="h-px bg-gradient-to-r from-orange-500 via-yellow-500 to-transparent mt-4" />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-5">── INPUTS ──</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
              System Cost: <span className="text-white font-mono">${(systemCost/1000).toFixed(0)}k</span>
            </label>
            <input
              type="range" min={50000} max={5000000} step={50000}
              value={systemCost}
              onChange={(e) => setSystemCost(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
              Power: <span className="text-white font-mono">{powerKw} kW</span>
            </label>
            <input
              type="range" min={1} max={50} step={0.5}
              value={powerKw}
              onChange={(e) => setPowerKw(Number(e.target.value))}
              className="w-full accent-yellow-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
              Convoy Distance: <span className="text-white font-mono">{convoyDist} km</span>
            </label>
            <input
              type="range" min={10} max={500} step={10}
              value={convoyDist}
              onChange={(e) => setConvoyDist(Number(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
              Convoy Trips/Month: <span className="text-white font-mono">{convoyTrips}</span>
            </label>
            <input
              type="range" min={1} max={20} step={1}
              value={convoyTrips}
              onChange={(e) => setConvoyTrips(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="mt-5 py-2 px-8 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-all text-sm uppercase tracking-wider"
        >
          {loading ? "⟳ Calculating..." : "▶ Run Financial Model"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 text-red-400 text-sm mb-6">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          {/* ROI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Annual Savings", value: `$${fmt(result.roi.annual_savings_usd)}`, color: "text-green-400" },
              { label: "Payback Period", value: `${result.roi.payback_years.toFixed(1)} yrs`, color: result.roi.payback_years < 5 ? "text-green-400" : result.roi.payback_years < 10 ? "text-yellow-400" : "text-red-400" },
              { label: "NPV (10yr @8%)", value: `$${fmt(result.roi.npv_usd)}`, color: result.roi.npv_usd > 0 ? "text-green-400" : "text-red-400" },
              { label: "IRR", value: result.roi.irr_pct != null ? `${result.roi.irr_pct.toFixed(1)}%` : "—", color: "text-blue-400" },
            ].map((m) => (
              <div key={m.label} className="metric-card">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{m.label}</div>
                <div className={`text-2xl font-mono font-bold ${m.color}`}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Cash flow chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-4">Cumulative Cash Flow</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  label={{ value: "Year", position: "insideBottom", offset: -5, fill: "#6b7280" }}
                />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 6 }}
                  formatter={(v: number | undefined) => v != null ? `$${(v / 1000).toFixed(0)}k` : "—"}
                />
                <Line
                  type="monotone" dataKey="cumulative" stroke="#4ade80"
                  strokeWidth={2} dot={{ fill: "#4ade80", r: 3 }} name="Cumulative Cash Flow"
                />
                <Line
                  type="monotone" dataKey="cashflow" stroke="#60a5fa"
                  strokeWidth={1} dot={false} strokeDasharray="4 4" name="Annual Cash Flow"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Convoy economics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-4">Convoy Economics</h2>
              <div className="space-y-3 text-sm">
                {[
                  ["Convoy distance", `${result.convoy.convoy_distance_km} km`],
                  ["Annual trips", String(result.convoy.trips_per_year)],
                  ["Cost per trip", `$${result.convoy.cost_per_trip_usd.toLocaleString()}`],
                  ["Trips eliminated/yr", `${result.convoy.trips_eliminated_yr.toFixed(0)} (${(result.convoy.fraction_eliminated * 100).toFixed(0)}%)`],
                  ["Convoy cost saved/yr", `$${result.convoy.convoy_cost_saved_yr_usd.toLocaleString(undefined, {maximumFractionDigits: 0})}`],
                  ["Risk reduction", `${result.convoy.expected_risk_reduction.toFixed(3)} lives/yr`],
                  ["Fuel weight saved", `${result.convoy.fuel_weight_saved_kg_yr.toLocaleString(undefined, {maximumFractionDigits: 0})} kg/yr`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-white font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SBIR */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-4">SBIR Budget Alignment</h2>
              <div className="space-y-4">
                {(["phase_i", "phase_ii"] as const).map((phase) => {
                  const p = result.sbir[phase];
                  const pct = (p.estimated_cost_usd / p.budget_usd) * 100;
                  return (
                    <div key={phase}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300 font-medium">{phase === "phase_i" ? "Phase I" : "Phase II"}</span>
                        <span className={p.feasible ? "text-green-400" : "text-red-400"}>
                          {p.feasible ? "✓ FITS" : "✗ OVER"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Budget: ${(p.budget_usd / 1000).toFixed(0)}k</span>
                        <span>Est: ${(p.estimated_cost_usd / 1000).toFixed(0)}k</span>
                        <span>{p.months} months</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.feasible ? "bg-green-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {p.feasible
                          ? `$${(p.surplus_deficit_usd / 1000).toFixed(0)}k remaining`
                          : `$${(Math.abs(p.surplus_deficit_usd) / 1000).toFixed(0)}k over budget`}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                  <span className="text-gray-400">Phase III Target</span>
                  <span className="text-white font-mono">${(result.sbir.phase_iii_target / 1_000_000).toFixed(0)}M</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scaling analysis */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-4">
              Production Scaling — Wright&apos;s Law (18% learning rate)
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={result.scaling} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="units_produced" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 6 }}
                  formatter={(v: number | undefined) => v != null ? `$${v.toLocaleString(undefined, {maximumFractionDigits: 0})}` : "—"}
                />
                <Bar dataKey="unit_cost_usd" name="Unit Cost" radius={[4, 4, 0, 0]}>
                  {result.scaling.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${120 - i * 12}, 70%, ${35 + i * 5}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <table className="w-full mt-4 text-xs font-mono text-left">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                  <th className="pb-2 pr-6">Units</th>
                  <th className="pb-2 pr-6">Unit Cost</th>
                  <th className="pb-2 pr-6">Cost Reduction</th>
                  <th className="pb-2">Total Rev</th>
                </tr>
              </thead>
              <tbody>
                {result.scaling.map((row) => (
                  <tr key={row.units_produced} className="border-b border-gray-800">
                    <td className="py-1 pr-6 text-white">{row.units_produced.toLocaleString()}</td>
                    <td className="py-1 pr-6 text-green-400">${row.unit_cost_usd.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td className="py-1 pr-6 text-yellow-400">{row.cost_reduction_pct.toFixed(1)}%</td>
                    <td className="py-1 text-gray-300">${(row.total_rev_usd / 1_000_000).toFixed(1)}M</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-600 bg-gray-900/30 border border-gray-800 rounded-xl">
          <div className="text-5xl mb-4">💰</div>
          <p className="text-lg font-mono">Configure and run the financial model</p>
        </div>
      )}
    </div>
  );
}
