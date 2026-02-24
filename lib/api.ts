const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://aether-sim-api.onrender.com";

export async function simulate(params: {
  mode: "laser" | "microwave" | "compare";
  range_m: number;
  power_kw: number;
  condition: string;
}) {
  const res = await fetch(`${API_URL}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function simulateSpace(params: {
  mode: "laser" | "microwave";
  orbit: string;
  power_kw: number;
  condition: string;
  laser_aperture_m?: number;
  laser_rx_aperture_m?: number;
  mw_array_diameter_m?: number | null;
  mw_rectenna_area_m2?: number | null;
  zenith_angle_deg?: number;
}) {
  const res = await fetch(`${API_URL}/simulate/space`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function simulateOptimized(params: {
  mode: "laser" | "microwave";
  range_m: number;
  power_kw: number;
  condition: string;
  optimizations: string[];
}) {
  const res = await fetch(`${API_URL}/simulate/optimized`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sweep(mode: string, power_kw: number) {
  const res = await fetch(`${API_URL}/sweep?mode=${mode}&power_kw=${power_kw}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSafety(mode: string, power_kw?: number, range_m?: number) {
  const params = new URLSearchParams({ mode });
  if (power_kw) params.set("power_kw", String(power_kw));
  if (range_m) params.set("range_m", String(range_m));
  const res = await fetch(`${API_URL}/safety?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getHardware(mode: string, power_kw: number, range_m: number) {
  const res = await fetch(
    `${API_URL}/hardware?mode=${mode}&power_kw=${power_kw}&range_m=${range_m}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFinancial(params: {
  system_cost_usd: number;
  power_kw: number;
  convoy_distance_km?: number;
  convoy_trips_month?: number;
}) {
  const res = await fetch(`${API_URL}/financial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
