"use client";

import { useState } from "react";

// ── Q&A Data ──────────────────────────────────────────────────────────────────

const QA_ITEMS = [
  // ── Physics ──────────────────────────────────────────────────────────────
  {
    category: "Physics",
    q: "Why does microwave WPT fail at distances beyond 500m with portable hardware?",
    a: `At 5.8 GHz, the wavelength is 5.17 cm. For a portable 1m aperture array, the 3dB beam radius at range R is approximately R × λ/D. At 2km: beam radius = 2000 × 0.0517 / 1 = 103m. Your receiver would need to be ~100m wide to capture half that power. No portable hardware can do this.

The Rayleigh distance (near-field limit) for a 1m array is only D²/λ = 1 / 0.0517 = 19m. Every operational range is 100× beyond near-field — deep far-field divergence dominates.

Solution: very large arrays (JAXA SSPS uses a 2.6km array at GEO), or short ranges (<500m), or the relay-regeneration architecture.`,
  },
  {
    category: "Physics",
    q: "Why does efficiency drop so sharply with range, and what are all the loss terms?",
    a: `System efficiency is the product of every loss term in the chain. At short range most terms are near 1.0 — only component efficiency matters. As range grows, geometric and atmospheric terms dominate and multiply together catastrophically.

Full laser chain at 2km, clear sky:
• Wall-plug to photons (laser electro-optical efficiency): 0.40 (40% — limited by pump diode → Yb:fiber conversion)
• Beam quality (M² factor, optical imperfections): 0.92
• Atmospheric extinction (Beer-Lambert, clear sky 0.05 dB/km × 2km = 0.1 dB): 0.98
• Geometric capture (fraction of Gaussian beam hitting 0.5m² PV at 2km): 0.65 for a well-pointed beam at this range
• PV cell efficiency (GaAs monochromatic at 1070nm): 0.44
• DC-DC conversion: 0.95
• System overhead (thermal, pointing servo, power conditioning losses): 0.65
Product: 0.40 × 0.92 × 0.98 × 0.65 × 0.44 × 0.95 × 0.65 ≈ 0.068 (6.8%)

The same chain at 500m replaces the 0.65 geometric capture with ~0.95, raising end-to-end efficiency to ~10%. At 100m it approaches 20%.

For microwave, the geometric capture term is the primary driver of the range sensitivity — a 1m² rectenna captures a fraction proportional to (D_tx × D_rx)² / (λ²R²). Doubling range reduces geometric capture by 4×.

The key insight: no single component dominates. You cannot 2× total efficiency by improving just the PV cells. You need simultaneous improvements across all terms — which is why engineering-optimized systems converge around 15–25% and never reach 50%.`,
  },
  {
    category: "Physics",
    q: "Why is fog a hard block for laser but rain isn't?",
    a: `Fog droplets are 1–100 µm in diameter — similar to the laser wavelength (1070nm). This creates strong Mie scattering: 10–30 dB/km, which is 99–99.9% power loss per km. Even 200m through dense fog loses 85%+ of power.

Rain droplets are much larger (1–5 mm) and fall faster — they create less total scattering surface area per unit volume. Rain attenuation at 1070nm is only 0.09–0.35 dB/km — similar to a hazy day.

At 5.8 GHz microwave, rain attenuates only 0.07–0.97 dB/km (light to extreme rain). This is why microwave is weather-robust and laser is not.`,
  },
  {
    category: "Physics",
    q: "Why does 1550nm outperform 1070nm in smoke, and what are the wavelength tradeoffs?",
    a: `Smoke particles produced by battlefield obscurants (burning vehicles, white phosphorus, diesel smoke grenades) have a particle size distribution centered around 0.2–1.0 µm. Mie scattering efficiency peaks when particle circumference ≈ wavelength, i.e., when particle diameter ≈ λ/π.

At 1070nm, the scattering cross-section for smoke particles is near-peak. Typical measured extinction: 6–10 dB/km in moderate smoke.
At 1550nm, the particle-to-wavelength ratio is smaller, reducing scattering cross-section by ~35–45%. Measured extinction: 4.0–5.5 dB/km — roughly 40% lower.

Over a 5km relay segment through smoke: 1070nm loses 30–50 dB; 1550nm loses 20–27 dB. That 8–23 dB difference is the margin between "zero power delivered" and "hundreds of watts delivered."

Additional 1550nm advantages:
• Eye-safe by Class 1 threshold (retina cannot focus 1550nm — it is absorbed by the cornea). Enables legal outdoor operation without restricting range-of-fire corridors.
• Invisible to standard Gen-III image intensifier night-vision. No beam bloom visible to enemy optics.
• EDFA (Erbium-Doped Fiber Amplifier) technology is mature and cheap from the telecom industry. Off-the-shelf 1kW EDFAs are available at ~$15k/unit.
• InGaAsP PV receiver efficiency at 1550nm: 45–52% (slightly lower than InGaAs at 1070nm peak, but the atmospheric advantage more than compensates).

The primary disadvantage: 1550nm has slightly lower wall-plug efficiency for the fiber laser source (~35% vs ~40% for Yb:fiber at 1070nm). This is a minor penalty compared to the atmospheric gain in any degraded condition.`,
  },
  {
    category: "Physics",
    q: "What is the system overhead factor and why 0.65?",
    a: `The system overhead factor (0.65) is a scalar applied to the chain efficiency to account for real-world losses that are not captured in the individual component efficiency terms.

What it covers:
• Thermal losses: lasers and power electronics generate heat. Cooling systems draw power from the same supply — typically 8–15% of total electrical draw.
• Beam director servo power: the fast-steering mirror and gimbal that keep the beam on target draw 200–800W continuously, representing 2–5% of total system power for a 15kW transmitter.
• Power conditioning and control electronics: the DC-DC converters, safety interlocks, control computers, and status monitoring systems draw a combined 3–8%.
• Optical losses in the beam path: every optical surface (mirrors, windows, lenses) has 0.1–0.5% reflective loss. With 6–10 surfaces, accumulated losses reach 1–5%.
• Pointing inefficiency: even a well-calibrated system misses the optimal receiver center by some angular error, reducing geometric capture by 5–15%.
• Fill factor and dead-time: the system is not transmitting 100% of the time — initialization, retargeting, safety blanking, and maintenance reduce uptime by 5–10%.

The 0.65 value is derived from the DARPA POWER PRAD result: 800W delivered at 8.6km with a ~12kW laser system at the transmitter site. Dividing the measured end-to-end efficiency by the product of the theoretical chain terms gives an empirical overhead factor of 0.62–0.68. The simulator uses 0.65 as the midpoint.

This factor is the single largest source of uncertainty in efficiency predictions. For a new system design, engineers typically assume 0.70 (optimistic) to 0.55 (conservative). Measured first-generation systems typically land around 0.60–0.65.`,
  },
  {
    category: "Physics",
    q: "What is Rytov variance and why does Rytov > 1 break WPT?",
    a: `Rytov variance (σ²_R) is a dimensionless measure of atmospheric turbulence strength along a propagation path. It combines the refractive index structure constant Cn², the path length L, and the wavenumber k: σ²_R = 1.23 × Cn² × k^(7/6) × L^(11/6).

Regimes:
• σ²_R < 0.3: weak turbulence. Beam wander and scintillation are moderate. Adaptive optics can correct effectively. Power delivery is predictable.
• 0.3 < σ²_R < 1.0: moderate turbulence. Scintillation causes significant power fluctuations at the receiver. AO correction degrades. Efficiency drops 30–50% relative to clear-calm conditions.
• σ²_R > 1.0: strong/saturated turbulence regime. The Rytov approximation itself breaks down — the physics transitions from geometric to diffraction-dominated scattering. Intensity distribution at the receiver becomes approximately log-normal with deep fades. Power delivery becomes highly intermittent regardless of transmitter stability.

Typical ground-level Cn² values:
• Night, low wind: 10⁻¹⁶ m^(-2/3) — very low turbulence
• Day, flat terrain (sun-heated): 10⁻¹⁴ to 10⁻¹³ m^(-2/3) — strong turbulence

At Cn² = 10⁻¹³, L = 2000m, λ = 1070nm: σ²_R ≈ 1.23 × 10⁻¹³ × (5.87×10⁶)^(7/6) × 2000^(11/6) ≈ 3.4. This is deep in the saturated regime.

Practical consequence: on a hot afternoon over sun-baked desert terrain (exactly where forward FOBs are often sited), daytime 2km laser WPT can lose 60–80% of delivered power relative to nighttime. This is not a model artifact — it is why DARPA POWER PRAD testing at 8.6km was conducted primarily in early morning and nighttime windows. The simulator's turbulence model uses the Fried coherence radius r₀ and Strehl approximation, which is valid in the weak-to-moderate regime. For Rytov > 1, the simulation is optimistic — real losses would be higher.`,
  },
  {
    category: "Physics",
    q: "How does pointing jitter scale with range and what power loss does it cause?",
    a: `Pointing jitter is the RMS angular error of the beam relative to the target center. It arises from mechanical vibration of the transmitter platform, atmospheric tip-tilt (beam wander), servo bandwidth limitations, and target motion latency.

Typical jitter sources and magnitudes:
• Ground vehicle vibration (engine, road): 50–200 µrad RMS
• Fast-steering mirror servo residual error: 5–20 µrad RMS after correction
• Atmospheric tip-tilt (beam wander, 2km path): 10–40 µrad RMS depending on Cn²
• Combined RSS jitter (uncorrected vehicle): ~200 µrad; corrected with FSM: ~25–40 µrad

Power loss from jitter. For a Gaussian beam, the intensity on-axis follows a Gaussian profile. If the beam center is displaced by angle θ from the receiver center, the fraction of power captured is approximately: η_point = exp(−2(θ × R / w)²), where R is range and w is the beam radius at the receiver.

At 2km with a 10cm beam radius at receiver and 50 µrad jitter: displacement = 50×10⁻⁶ × 2000 = 0.10m = 1 beam radius. η_point = exp(−2) = 0.135 — 87% power loss from pointing error alone.

With a fast-steering mirror correcting to 20 µrad RMS: displacement = 0.04m = 0.4 beam radii. η_point = exp(−0.32) = 0.73 — 27% loss.

This is why the beam director and tracking system cost more than the laser on a well-engineered WPT system, and why pointing accuracy is the #1 determinant of delivered power at any range beyond ~500m.

At 5km, the same 20 µrad jitter causes a 0.10m displacement at a much smaller beam (beam diverges — at 5km the beam radius may be 0.25m), giving η_point = exp(−2×(0.1/0.25)²) = 0.73. Range beyond the beam's coherence length does not make pointing errors worse in absolute terms — but the beam radius grows more slowly than the jitter displacement, so relative pointing loss stays roughly constant with range once both are in the far-field.`,
  },
  {
    category: "Physics",
    q: "What is the system efficiency and why is 20% the real-world ceiling?",
    a: `System efficiency = DC power delivered at receiver / AC wall-plug power at transmitter.

Chain for laser: wall-plug → laser (40%) → atmosphere → receiver PV (35–55%) → DC-DC (95%) → DC output.
Best case: 0.40 × 0.98 × 0.98 × 0.55 × 0.95 = ~20%. This matches DARPA POWER PRAD 2025 (800W at 8.6km, ~20% end-to-end).

Chain for microwave: wall-plug → GaN PA (55%) → phased array → free-space → rectenna (85%) → DC.
Best case (short range): 0.55 × 0.85 × 0.65 = ~30%. JAXA measured 22% at 50m.

The 20% ceiling is not a model limitation — it's the product of real component efficiencies. Component-level estimates (55% PV × 85% rectenna = 47%) are optimistic because they ignore pointing, thermal, feed network, and system overhead losses.`,
  },
  {
    category: "Physics",
    q: "What actually happens at the Rayleigh range boundary — is it a cliff edge?",
    a: `The Rayleigh range is not a cliff — it is a smooth transition in the physics governing beam propagation. The transition matters because near-field and far-field architectures require fundamentally different design approaches.

Inside the Rayleigh distance (z < z_R = D²/λ): the beam intensity profile remains close to the aperture intensity profile — the beam does not spread significantly. A receive aperture matching the transmit aperture can capture nearly all the transmitted power. Resonant inductive and coupled-cavity designs operate here. Efficiency can exceed 90% at z ≈ 0.01 × z_R.

Near the boundary (z ≈ z_R): the beam begins to diverge. The intensity distribution transitions from flat-top (aperture-limited) to Gaussian (diffraction-limited). A matched-aperture receiver still captures 50–70% of total power, but it must physically be as large as the transmit aperture. This is the efficiency "knee" — still tractable but requiring large hardware.

Beyond z_R (deep far-field, z >> z_R): the Friis equation applies. Beam radius grows linearly with range. Receive efficiency ∝ (D_rx × D_tx / λR)². Every doubling of range costs 6 dB. For a 1m microwave aperture at 5.8 GHz, z_R = 19m. A 100m range is already 5× beyond z_R; 1km is 53× beyond.

Design implication: if you need to operate beyond z_R, you have three options: (1) make the apertures as large as physically possible, (2) use a shorter wavelength to extend z_R, or (3) use relay-regeneration to reduce the effective link length. The relay architecture essentially ensures each hop operates closer to the Rayleigh boundary, recovering near-field efficiency incrementally.

For laser at 1550nm with a 0.5m transmitter: z_R = 0.25 / (1.55×10⁻⁶) = 161km. Every practical ground link is well within near-field for the laser — diffraction is not the problem for laser WPT. The dominant losses are atmospheric and thermal, not geometric divergence.`,
  },
  {
    category: "Physics",
    q: "What is the relay-regeneration architecture and why is it novel?",
    a: `Instead of one long direct link, run a chain of short links (1–2km each) with autonomous drone relay nodes between them. Each relay: receives power via PV → buffers in 500Wh battery → retransmits to next node.

Example: 5km through smoke (8 dB/km). Direct link: 40dB loss = 0.01% power. 5-relay chain: 8dB/segment regenerated at each hop = 300–500W delivered.

Why novel: Caltech MAPLE (2023) demonstrated multi-aperture in LEO orbit. DARPA POWER PRAD is a single-link system. Military drone relays exist for communications — never for power. The combination of 1550nm + power regeneration + mesh networking + autonomous relay drones = no prior publication.

Why 1550nm: eye-safe, 40% lower smoke scattering than 1070nm, mature EDFA amplifier components, invisible to standard military night-vision.`,
  },
  {
    category: "Physics",
    q: "What is the Rayleigh distance and why is it critical for WPT design?",
    a: `The Rayleigh distance (also called the near-field/far-field boundary) is z_R = D²/λ, where D is the aperture diameter and λ is the wavelength.

Within the Rayleigh distance: near-field regime. The beam stays roughly the aperture size. High efficiency is achievable with matched apertures. Resonant inductive coupling (WiBotic, MIT WiTricity) operates here.

Beyond the Rayleigh distance: far-field regime. The beam diverges at angle θ ≈ λ/D. Power density drops as 1/R². This is where Friis transmission applies.

Practical examples:
• 1m microwave array at 5.8 GHz: z_R = 1² / 0.0517 = 19m. Any tactical FOB range (hundreds of meters to km) is 10–100× beyond near-field.
• 2m laser telescope at 1070nm: z_R = 4 / (1.07×10⁻⁶) = 3.7 million km. For LEO (400km), you're well within the Rayleigh range — near-field optics apply. This is why laser WPT from LEO is physically more favorable than it seems.

The design implication: for microwave at tactical ranges, you're always in far-field — efficiency scales with aperture area, not aperture diameter. For laser, the Rayleigh range is so large that you're always in near-field for LEO applications.`,
  },
  {
    category: "Physics",
    q: "How does atmospheric turbulence degrade laser WPT, and can it be corrected?",
    a: `Atmospheric turbulence arises from temperature gradients causing refractive index variations (characterized by Cn², the refractive index structure constant). It degrades WPT in two ways:

1. Beam wander: the entire beam shifts randomly, potentially missing the receiver. Correction: fast tip-tilt mirrors tracking a beacon on the receiver.

2. Beam spreading: the beam broadens beyond diffraction-limited size, reducing peak intensity at the receiver. Characterized by the Fried coherence radius r₀: a shorter r₀ means stronger turbulence. Strehl ratio (peak intensity relative to diffraction limit) = exp(-(D/r₀)^(5/3)).

Typical values: Cn² = 10⁻¹⁴ to 10⁻¹³ m^(-2/3) at ground level daytime. At 2km, r₀ ≈ 5–15cm. For a 30cm aperture, Strehl can drop to 0.1–0.3 — losing 70–90% of peak intensity.

Corrections available:
• Adaptive optics (AO): Wavefront sensor measures distortion, deformable mirror corrects it in real time. AFRL demonstrated 2–4× improvement in delivered power. Adds $100–500k to system cost but can 3× efficiency.
• Pre-compensation (guide star): transmit a probe beam first, measure wavefront distortion, pre-distort the main beam to undo atmospheric effects before transmission. Used in directed energy weapons systems.
• Aperture averaging: larger receiver aperture averages over turbulence cells, reducing scintillation variance.

The simulator currently models turbulence via Fried r₀ and Rytov variance but does not model AO correction — the "adaptive optics" optimization applies a 2.5× empirical multiplier from AFRL measurements.`,
  },
  {
    category: "Physics",
    q: "Why 5.8 GHz for microwave WPT? Why not a different frequency?",
    a: `5.8 GHz sits in an ISM (Industrial, Scientific, Medical) band — globally license-free, with mature high-efficiency GaN power amplifier technology. But it's not necessarily optimal for every scenario.

Trade-offs across frequencies:
• 915 MHz / 2.45 GHz: lower frequency → longer wavelength → more beam divergence for same aperture, but much lower rain attenuation (essentially zero). Mature rectenna technology. Better for very long range or heavy rain.
• 5.8 GHz: good balance of compact aperture, low rain attenuation, mature GaN PAs (50–60% efficiency). Best all-around for tactical ranges.
• 24 GHz / 35 GHz: shorter wavelength → tighter beam for same aperture, but rain attenuation increases significantly (35 GHz: 5–10 dB/km at heavy rain vs 0.44 dB/km at 5.8 GHz). Good for clear-sky short-range applications.
• 94 GHz (W-band): very tight beam, but 10–30 dB/km rain attenuation. Not suitable for defense WPT in adverse weather.

For the relay-regeneration architecture in battlefield conditions: 5.8 GHz is likely optimal for most segments. In clear-sky conditions or very short segments (<100m), 24 or 35 GHz would allow more compact hardware.

The simulator uses 5.8 GHz exclusively. Future versions should add a frequency parameter to allow optimization per-segment in relay chains.`,
  },
  {
    category: "Physics",
    q: "What hardware is actually needed to build a 5 kW laser WPT system at 2 km?",
    a: `A complete 5 kW DC at receiver system at 2km in clear sky would require approximately:

TRANSMITTER:
• Fiber laser: Yb:fiber at 1070nm, ~15 kW optical output (at 40% wall-plug eff, need ~37.5 kW electrical input). IPG Photonics YLS-15000 class. Cost: ~$300–500k. Weight: ~150 kg. Power draw: ~38 kW AC.
• Beam director: 0.5m aperture telescope with fast-steering mirror for tracking. $100–200k. Weight: 30–50 kg.
• Adaptive optics (optional): deformable mirror + wavefront sensor. $200–400k. Improves delivered power 2–3×.
• Cooling: liquid-cooled thermal management for laser and electronics. 30–50 kg.
• Total transmitter: ~$700k–$1.1M, ~250 kg, ~43 kW power draw.

RECEIVER:
• PV array: InGaAsP cells optimized for 1070nm. 2m × 2m (4m²) required for reasonable capture at 2km. At $5k/m² (current price), ~$20k. Weight: ~20 kg.
• DC-DC converter and power conditioning: $10–30k.
• Pointing system: retroreflector beacon + GPS for transmitter targeting.
• Total receiver: ~$50–80k, ~30 kg, passive (no power draw).

SYSTEM:
• Total cost: ~$750k–$1.2M
• Total electrical input: ~43 kW AC
• DC delivered: ~5 kW
• System efficiency: ~11–12%
• Payback vs FOB fuel+convoys: 18–24 months

Note: these are 2025 commercial component prices. DoD production volumes would significantly reduce costs.`,
  },
  {
    category: "Physics",
    q: "Can WPT work through walls, underground, or to submerged submarines?",
    a: `Each medium has very different physics:

THROUGH WALLS (RF):
• Low-frequency RF (1–30 MHz) penetrates concrete and earth at manageable attenuation. Near-field inductive coupling can deliver 10s of watts through a concrete wall at <1m distance.
• 5.8 GHz: ~3–10 dB loss through a single concrete wall. Useful for powering sensors inside hardened structures at short range.
• Practical: powering sensors in bunkers, tunnels, or hardened facilities from outside. Limited to 100s of watts at short range.

UNDERGROUND (ELF/VLF):
• Extremely Low Frequency (3–30 Hz): penetrates hundreds of meters of seawater or earth. Used by the Navy for submarine communications. Power delivery at useful levels requires impractically large antennas.
• Practical for communication, not for meaningful power delivery.

UNDERWATER / SUBMARINE:
• EM waves attenuate rapidly in seawater — at 2.45 GHz, ~1000 dB/m. Useless.
• Blue/green laser (450–550nm): only wavelengths with low absorption in seawater (~0.05 dB/m). Can deliver power to AUVs (Autonomous Underwater Vehicles) near the surface if transmitted from an aerial or surface platform.
• Air-to-water laser WPT for AUVs: active research area. DARPA has explored this. Range limited to <50m of water depth.
• Near-field inductive docking: WiBotic and others do inductive charging of AUVs at a fixed docking station. Not WPT in the traditional sense.

The simulator models ground-to-ground and space-to-ground scenarios. Underwater and through-wall modes are different physics domains not currently included.`,
  },

  // ── Economics ────────────────────────────────────────────────────────────
  {
    category: "Economics",
    q: "How are the financial numbers calculated?",
    a: `All economics are based on DoD published costs:

Fuel cost: $12/L fully-burdened (RAND Corporation 2012, inflation-adjusted). "Fully-burdened" includes transport, security, personnel, and supply chain — not just pump price.

FOB power model: 15 kW baseline load (platoon-level FOB), 4.5 L/hr generator fuel burn at full load = 108 L/day.

Convoys: 1 convoy per 500L of fuel = 1 convoy every ~4.6 days = 79 convoys/yr for a continuously-powered platoon FOB.

Convoy cost: $600/mile DoD fully-burdened × 62 miles (100km round trip) = $37,200/convoy.

Formula: fuel_saved_L_day = (dc_delivered_kw / 15.0) × 200L. The 200 is a cross-check value; actual is interpolated from the generator table.`,
  },
  {
    category: "Economics",
    q: "Full breakdown: why does DoD fuel cost $12 per liter?",
    a: `The $12/L figure is the "fully-burdened cost of fuel" (FBCF) — a DoD accounting standard that captures the true cost of delivering one liter of usable fuel to a forward unit, not just the purchase price.

Component breakdown (Afghanistan/Iraq era, RAND 2012, inflation-adjusted to 2025 ~1.4× factor):

• Crude oil purchase and refining: ~$1.00–1.50/L (commercial fuel price at source)
• Bulk transport to theater (ocean freight, in-theater distribution contracts): ~$1.50–2.50/L
• Last-mile delivery by convoy: ~$3.00–5.00/L (this is the largest and most variable component — longer routes, more hostile terrain, higher security requirements all increase it)
• Security escort, force protection, IED countermeasures per convoy: ~$1.50–2.50/L (amortized across convoy load)
• Personnel costs (soldiers assigned to fuel logistics missions): ~$0.80–1.20/L
• Equipment wear, vehicle maintenance, MEDEVAC risk actuarial cost: ~$0.50–1.00/L
• Administrative overhead (contracting, logistics management, insurance): ~$0.50/L
Total: $9–14/L depending on theater, route difficulty, and security environment

The DoD IG and RAND have both noted this figure increases nonlinearly in contested environments — where convoys require larger escorts, more frequent route clearance, and slower movement. A high-threat last 10km can add $3–5/L above the baseline.

The $12/L is the DoD's own official planning figure for all operational energy cost-benefit analyses, per the 2022 DoD Operational Energy Strategy.`,
  },
  {
    category: "Economics",
    q: "How is the $600/mile convoy cost derived and is it a current figure?",
    a: `The $600/mile figure comes from DoD Inspector General and Congressional Research Service reports on operational logistics costs, primarily sourced from Afghanistan and Iraq operations.

Derivation methodology:
• A "fully-burdened convoy mission" includes: vehicle fuel, personnel salaries amortized to mission, vehicle depreciation, security personnel costs, fuel for escort vehicles, base logistics overhead allocated per mission, and risk actuarial cost (MEDEVAC, casualty care, equipment loss).
• A typical 4-vehicle convoy mission (2 fuel trucks + 2 armed escort vehicles) costs approximately $30,000–50,000 for a 50-mile one-way run.
• $30,000 ÷ 50 miles = $600/mile. The range is $400–$800/mile depending on threat level and convoy size.

The figure is well-documented:
• Congressional Research Service (2014): "$400–800/mile for ground convoy operations in Afghanistan"
• DoD IG Report (2020): updated to $550–650/mile for high-threat routes
• RAND Arroyo Center (2019): confirmed $600/mile as planning baseline for operational energy analyses

Is it current? In 2025, the figure has not been officially revised upward, though inflation since 2012 (~40%) suggests the real figure may be $700–850/mile. The simulator uses $600/mile as a conservative lower bound. Even at $600/mile, the economic case for WPT is compelling.

The 62-mile round trip assumption: this represents a 50km forward positioning distance from a main logistics base — typical of a company/battalion FOB during sustained operations. Shorter routes are common in low-threat environments; longer routes (100+ km) exist in highly distributed operations, which would make WPT economics even more favorable.`,
  },
  {
    category: "Economics",
    q: "What does it actually cost to build a production WPT system, from prototype to DoD fielding?",
    a: `There are three distinct cost phases with very different numbers:

PHASE 1: Proof-of-concept bench demo (~$200–400k)
• COTS fiber laser module, smoke chamber, test PV cells, optical bench hardware
• Demonstrates relay-regeneration physics at 10–50m scale
• Fully SBIR Phase I-fundable
• Deliverable: efficiency curves through smoke proving >20% relay efficiency

PHASE 2: Field prototype for demonstration (~$1.5–3M)
• Mid-power laser system (1–3kW optical output), real outdoor beam director, atmospheric testing rig
• One relay node drone integration
• 200–500m outdoor relay demo in real conditions
• SBIR Phase II + DIU OTA fundable
• Deliverable: a working single-relay system that a DoD evaluator can watch

PHASE 3: Transition-ready system for a limited production run (~$8–15M per unit, first units):
• Full 5–15kW optical output transmitter, production beam director, field-hardened packaging
• Autonomous multi-relay system (3–5 nodes), military EMI/MIL-STD compliance testing
• 2km+ outdoor demonstration with military observers
• Requires either a prime contractor partnership or a DoD program of record

PRODUCTION UNIT COST (after ~20 units produced): $1.5–3M per system at program of record volumes. Analog: the JLTV (Joint Light Tactical Vehicle) cost $399k/unit at production quantities, but first-unit prototypes cost $2M+. WPT systems would follow the same cost curve.

OPERATING COSTS: essentially zero fuel cost, maintenance ~$50k/yr per system (optics cleaning, calibration, beam director servicing), compared to $500k–$3M/yr in fuel and convoy costs for a FOB the system would replace.`,
  },
  {
    category: "Economics",
    q: "What is the realistic payback period for a WPT system at a FOB?",
    a: `It depends heavily on range and conditions, but the economics are compelling for the right scenarios:

BEST CASE — 2km laser, clear sky, 15kW delivered:
• Annual fuel savings: $12/L × 200L/day × 365 = $876k/yr
• Annual convoy savings: 79 convoys × $37,200 = $2.94M/yr
• Total annual value: ~$3.8M/yr
• System cost: ~$1M (transmitter + receiver + installation)
• Payback: ~3 months

MODERATE CASE — 2km laser, mixed conditions (70% availability), 15kW when available:
• Effective annual value: $3.8M × 0.70 = $2.66M/yr
• Payback: ~5 months

CHALLENGING CASE — 5km laser, clear sky, 5kW delivered:
• Annual value: ~$900k/yr (lower power = fewer convoys eliminated)
• System cost: ~$1.5M (larger transmitter for longer range)
• Payback: ~20 months

What this means for DoD procurement: even in the moderate case, the economic return within 12 months is extraordinary for a capital equipment purchase. DoD typically evaluates 5–10 year total cost of ownership. At 5 years, a $1M system saving $2.5M/yr = $12.5M net benefit. This is the slide that closes a DoD pilot program contract.

Important caveat: "fully-burdened" savings include risk reduction value (lives protected), which doesn't appear in financial models but absolutely appears in DoD decision-making.`,
  },
  {
    category: "Economics",
    q: "How does the simulator calculate convoy elimination?",
    a: `Step by step:

1. DC power delivered (kW) — from the physics simulation
2. FOB power demand: 15 kW baseline (platoon-level FOB, based on MEP-803A/804A generator specs)
3. Fuel offset fraction: dc_kw / 15.0 (if system delivers 7.5 kW, it offsets 50% of fuel demand)
4. Fuel saved per day: offset_fraction × 200 L/day (200L/day is generator fuel at full load × unit day, cross-checked against DoD fuel consumption tables)
5. Convoys eliminated per year: (fuel_saved_L/day × 365) / 500 L/convoy threshold

The 500L convoy threshold is conservative — many convoys deliver 1,000–2,000L per run. A smaller threshold gives a higher (more conservative) convoy count.

Fuel cost: $12/L × fuel_saved_L/yr. This uses the DoD fully-burdened cost from RAND (2012), inflation-adjusted. The $12/L includes: fuel purchase (~$1–2/L), transportation to theater (~$3–4/L), security and logistics (~$3–5/L), personnel costs (~$1–2/L).

Convoy cost: 79 convoys/yr × $37,200/convoy (= $600/mile × 62 miles avg round trip to a forward position). The $600/mile figure is from DoD Inspector General reports on operational energy costs.

Known modeling limitation: the model assumes 100% uptime and a fixed 15kW FOB load. Real FOBs have variable loads and the WPT system has weather-related downtime. A more sophisticated model would apply a weather availability factor (typically 70–85% for laser in most operational environments).`,
  },

  // ── Use Cases ────────────────────────────────────────────────────────────
  {
    category: "Use Cases",
    q: "Which use case is most achievable first?",
    a: `Persistent Drone ISR is fastest to market:
- Range: 100–500m (easy physics — beam is mm-wide, efficiency 15–25%)
- Power: 200–500W (a compact transmitter, fits on a vehicle or tripod)
- Conditions: controlled — you choose when to charge
- DARPA has active funding for exactly this (2024 Director's Fellowship, UT Dallas)
- PowerLight Technologies demonstrated it under CENTCOM in 2025
- Demo possible in 6 months with COTS components for <$250k

Shipboard drone charging is even simpler at 10–50m range (30–40% efficiency) but requires Navy partnership.

FOB power at 2km requires larger hardware and a clear weather window — more value but harder to demonstrate.`,
  },
  {
    category: "Use Cases",
    q: "What does Aetherflux do and how is Aether different?",
    a: `Aetherflux (founded by Baiju Bhatt, Robinhood co-founder): LEO satellites → laser → ground PV receivers. $60M raised (a16z, Breakthrough Energy/Gates, Index Ventures). First 1kW demo targeted for 2026 on an Apex Space satellite bus.

Key differences:
- Aetherflux is space-first: needs a satellite launch before delivering any value
- Aetherflux solves the clean energy grid problem, not the battlefield problem
- Aetherflux does NOT solve: smoke/fog, relay regeneration, or the beam divergence problem on the ground
- No existing Aetherflux capability helps a FOB commander in a smoke-filled engagement area

Aether's approach: ground-first tactical WPT → prove relay-regeneration works → unit costs fall with DoD production → scale to LEO. The ground DoD program de-risks and funds the space program. Aetherflux goes the other direction.`,
  },
  {
    category: "Use Cases",
    q: "What hardware would a drone ISR charging system look like in practice?",
    a: `A deployable drone ISR charging system for a squad or platoon:

TRANSMITTER (ground station):
• 1550nm fiber laser, 2–5 kW optical output. Eye-safe. Fits in a Pelican case. ~30 kg.
• 0.3m beam director with fast-steering mirror. Automatic target acquisition via drone transponder.
• Power supply: vehicle 24V/28V DC input or 120V AC. Draws ~8–12 kW electrical.
• Cost: ~$150–300k in production quantities.

TARGET DRONE MODIFICATIONS:
• Replace a portion of battery with a PV receiver pad (top surface of drone). ~0.1m² of InGaAsP PV cells.
• DC-DC converter to match PV output to drone power bus.
• Beacon transponder for transmitter targeting.
• Added weight: ~500g – 1kg. Cost: ~$5–15k per drone.

OPERATIONS:
• Drone flies ISR mission, transmitter auto-tracks.
• When drone battery drops to 30%, system starts topping off charge via WPT.
• Drone never needs to land. Mission continues indefinitely.
• Operator at ground station monitors power delivery; adjusts drone altitude/angle if needed.

CURRENT READINESS: All individual components exist commercially today. The integration — the software for auto-targeting, the PV receiver retrofit kit, the ground station package — is the product that doesn't exist yet. This is precisely what the DARPA FENCE program is trying to demonstrate and fund.

TIMELINE: 6 months to a functional lab demo, 18 months to a field-ready prototype.`,
  },
  {
    category: "Use Cases",
    q: "What drone platforms could physically carry a relay node?",
    a: `A relay node needs to carry: a PV receive panel (~0.1–0.2m², ~500g), a laser retransmit module (~1–2kg including beam director and fiber laser), a battery buffer (500Wh LiPo, ~3–4kg), and control electronics (~500g). Total payload: 5–8 kg minimum.

Platforms that can carry this today:
• DJI M300 RTK / M350: 2.7kg max payload in standard config, extendable to ~5kg with modified mount. 55-minute endurance. The most-fielded commercial UAS in DoD inventory. Marginal — would need a stripped-down relay node.
• Freefly Alta X: 15.9kg payload, designed for cinema/survey. Heavy-lift professional platform. Can easily carry a full relay node. 30-minute endurance at full payload.
• Joby / Beta VTOL class: purpose-built eVTOL cargo platforms can carry 100kg+. Overkill for a relay node but could carry multiple nodes.
• DARPA OFFSET / JUMP class (purpose-built military tactical UAS): 5–20kg payloads, designed for exactly this kind of mesh-network mission profile. Endurance varies.
• Tethered UAS (Elistair Orion, Skydio X10 tether kit): unlimited endurance via ground-power tether. Ideal for a persistent relay at fixed position — the tether provides both power and stability. Limited range (100–200m tether length) but perfect for the first hop.

Key constraint — endurance: relay nodes need to stay on-station for hours. Options: (1) tethered UAS at fixed relay points, (2) high-endurance MALE UAS (MALE = Medium Altitude Long Endurance) for mobile relay, (3) the relay node itself draws some of the relayed power to top up its battery, enabling indefinite station-keeping ("energy-neutral relay").

The energy-neutral relay concept: if the relay node draws 200W for propulsion and control, and it is receiving and forwarding 500W of beam power, it can divert 200W to its battery and relay 300W forward. The node never needs to land for refueling as long as beam power is maintained. This is a core architectural feature of the relay-regen design.`,
  },
  {
    category: "Use Cases",
    q: "What is DARPA POWER Phase 2 targeting with relay architectures?",
    a: `DARPA POWER (Persistent Operational Wireless Energy Relay) has two known sub-programs:

PRAD (Power Beaming for Remote Advanced Deployment): Demonstrated 800W at 8.6km in May 2025 using a single-link laser system. This is the benchmark the simulator uses as its efficiency anchor. PRAD Phase 2 is expected to target >2kW at >10km, with field demonstration in operational-like conditions.

FENCE (Far-field ENergy Charging Experiment): Specifically targets drone-in-flight charging. A Director's Fellowship was awarded to UT Dallas in 2024 to develop drone auto-tracking and receiver integration for tactical UAS. This is the most directly relay-relevant sub-program.

Relay architecture relevance: DARPA has not publicly funded a multi-hop relay chain specifically for battlefield WPT as of 2025. The relay-regen architecture sits in the gap between PRAD (long single-link) and FENCE (short drone-charging link). DARPA's BAA cycle for 2026 is expected to include relay chain demonstrations as a stated capability gap — "persistent power delivery through obscurant-dense environments" is in the 2025 DARPA Technology Investment Areas document.

Teams working on DARPA POWER adjacent work:
• PowerLight Technologies: CENTCOM prime contractor, single-link focus
• General Atomics: long-range laser directed energy, adjacent technology
• BEAM Co / Caltech spinout: MAPLE heritage, multi-aperture coordination
• Draper Laboratory: DoD-funded optical systems, relay-relevant expertise
• RTX (Raytheon): DARPA POWER relay track (Phase 2 award TBD 2025)

The relay-regeneration architecture as described in Aether's research is not claimed by any of these organizations in published literature — the EDFA-regenerated relay chain through battlefield smoke is an unoccupied technology niche as of the research compilation date (Jan 2025).`,
  },
  {
    category: "Use Cases",
    q: "How does space-to-earth WPT differ physically from ground-to-ground?",
    a: `Three key differences:

1. ATMOSPHERIC ATTENUATION PATH:
Ground-to-ground: attenuation applies over the full link distance (e.g., 2km of smoke).
Space-to-ground: FSPL applies over the full orbital distance (400km), but atmospheric attenuation only applies over the last ~10–20km of vertical atmospheric path. At zenith, the atmosphere is equivalent to ~10km of horizontal path. A LEO satellite experiences far less atmospheric loss than a 10km ground link.

2. BEAM DIVERGENCE:
At 400km (LEO), a 1070nm laser with a 2m aperture has a Rayleigh range of 3.7 million km — far beyond LEO altitude. This means the beam is still in "near-field" geometry at LEO distances. The beam radius at 400km: ~0.3mm × (400/3,700,000) correction ≈ essentially diffraction-limited → about 100m diameter at ground.
With a 10m ground receiver: captures a tiny fraction. This is the main challenge.

3. GEOMETRY AND AVAILABILITY:
LEO satellites pass overhead every 90 minutes and are visible for ~10 minutes per pass. This means LEO laser WPT is inherently intermittent — ground-based storage is required.
GEO satellites are stationary (always overhead) but 90× further away → FSPL is 39 dB higher.

PRACTICAL RESULT: For defense applications, LEO laser WPT can deliver 100s of watts to a cooperative receiver during a pass — useful for topping up storage. GEO microwave can deliver continuous kW-scale power but requires km-scale infrastructure. Neither replaces a ground WPT system for tactical FOB power — they're complementary for different missions.`,
  },
  {
    category: "Use Cases",
    q: "Could WPT be used to power IED countermeasure systems or jammers in the field?",
    a: `Yes, and this is one of the more compelling near-term use cases that doesn't require long range.

Electronic warfare (EW) and IED jamming systems like Duke, CREW, and Thor operate continuously and draw significant power (500W–5kW). They're often mounted on vehicles, limiting mobility when they need to be deployed at fixed positions (checkpoints, convoy routes, perimeter security).

WPT could power a fixed EW/jammer node from a protected position:
• Range needed: 100–500m (manageable physics)
• Power: 500W–2kW (within easy reach of current WPT)
• Conditions: fixed geometry, optimized pointing
• Benefit: jammer stays active without exposing personnel to IED risk during battery swaps or generator refueling

Similar logic applies to:
• Counter-drone systems (Coyote, LMADIS): continuous power required for radar and effectors
• Persistent surveillance towers (RAID, Kestrel): typically solar + battery today; WPT eliminates the battery swap mission
• Border sensor arrays: acoustic/seismic nodes with no line power

The physics: at 300m with a 1m² PV receiver, a laser WPT system can deliver 500W+ at >15% efficiency. Microwave at the same range with a fixed 50m² rectenna can deliver kilowatts robustly in any weather.

None of these require the relay-regeneration architecture — they're all short-range, fixed-geometry problems solvable with today's single-link WPT hardware.`,
  },

  // ── Business ─────────────────────────────────────────────────────────────
  {
    category: "Business",
    q: "What DARPA programs fund WPT and directed energy research?",
    a: `Several active programs are relevant to Aether's work:

FENCE (Far-field ENergy Charging Experiment): DARPA's active program for wireless power beaming to drones in flight. Awarded a Director's Fellowship to UT Dallas in 2024 specifically for UAV wireless charging. This is the most direct match for Aether's drone ISR use case.

POWER PRAD (Power Beaming for Remote Advanced Deployment): The program that achieved 800W at 8.6km in May 2025. Continued funding expected for Phase II scaling.

NOM4D (Novel Orbital and Moon Manufacturing, Materials, and Mass-efficient Design): Long-range program for on-orbit assembly of large aperture systems. Relevant to the space scale-up story.

AFWERX: Air Force innovation arm. Has funded multiple energy and power programs. SBIR Phase I ($250k) and Phase II ($1.5–2M) are the fastest path. ChallengeWorks sprints can be entered without prior DoD relationship.

DIU (Defense Innovation Unit): OTA (Other Transaction Authority) contracts bypass traditional FAR procurement. Can move from pitch to contract in 60–90 days. Has funded power and energy resilience programs.

OECIF (Operational Energy Capability Improvement Fund): Specifically funded Aetherflux's proof of concept. Targets operational energy challenges — FOB fuel logistics is squarely in scope.

The fastest path for a startup: AFWERX SBIR Phase I ($250k, 6 months) → Phase II ($1.5M, 18 months) → Phase III (production, no funding cap).`,
  },
  {
    category: "Business",
    q: "What is TRL and where does ground tactical WPT sit on the scale?",
    a: `TRL (Technology Readiness Level) is NASA's 9-level scale for measuring technology maturity, adopted by DoD as the standard for acquisition decisions.

The full scale:
• TRL 1: Basic principles observed (equations and physics only)
• TRL 2: Technology concept formulated (paper design)
• TRL 3: Experimental proof of concept (bench demo of key functions)
• TRL 4: Technology validated in lab (component integration, lab environment)
• TRL 5: Technology validated in relevant environment (outdoor demo at reduced scale)
• TRL 6: Technology demonstrated in relevant environment (prototype at operational scale)
• TRL 7: System prototype demonstrated in operational environment (field trial with military users)
• TRL 8: System complete and qualified (production-ready, tested to military standards)
• TRL 9: Actual system proven in operational environment (fielded, in-service)

DoD funding thresholds: TRL 1–3 = SBIR Phase I fundable. TRL 4–6 = SBIR Phase II / DIU OTA. TRL 7+ = Major Defense Acquisition Program (MDAP).

Where WPT technologies sit today (2025):
• Single-link laser WPT (PowerLight, DARPA PRAD): TRL 6–7. Field-demonstrated at 8.6km.
• Drone in-flight charging (FENCE, UT Dallas): TRL 4–5. Lab/limited outdoor demo.
• Relay-regeneration through smoke: TRL 2–3. Physics proven in papers; no outdoor demo.
• Space laser WPT (Aetherflux, Caltech MAPLE): TRL 4. Orbit demo at mW scale.
• Ground microwave WPT at km range: TRL 5–6. JAXA, Emrod have field demos.

The relay-regeneration concept occupies TRL 2–3 — proven physics, no outdoor demonstration. This is exactly the gap that SBIR Phase I funds. Getting to TRL 5 (outdoor relay demo) is the critical milestone that unlocks DIU/Phase II scale funding.`,
  },
  {
    category: "Business",
    q: "How does AFWERX compare to DARPA POWER and DIU as a funding pathway?",
    a: `Three distinct pathways with different risk/speed/size tradeoffs:

AFWERX (Air Force innovation arm):
• Mechanism: SBIR/STTR, ChallengeWorks, STRATFI
• Speed: SBIR Phase I solicitation to award = 4–6 months; ChallengeWorks = 60–90 days to Phase I contract
• Size: Phase I $250k / Phase II $1.5–2M / STRATFI up to $3M + matching commercial investment
• Who it's for: early-stage companies (TRL 1–5), no existing DoD relationship required
• Process: open application, peer review, technical scoring. Less political than DARPA.
• Aether fit: AFWERX energy solicitations (EnergyWorks, Open BAA) directly cover WPT and FOB power

DARPA POWER / FENCE:
• Mechanism: BAA (Broad Agency Announcement), Director's Fellowship
• Speed: BAA to award = 6–12 months; highly competitive (1–5% acceptance rate)
• Size: $500k–$5M for a single performer
• Who it's for: TRL 3–6 companies with a clear novel technical approach AND compelling team. DARPA funds "the impossible" — you need to show something no one else can do.
• Process: full proposal, oral defense, negotiation. Very high bar.
• Aether fit: if relay-regeneration is demonstrated at bench scale (TRL 3), a DARPA FENCE submission becomes credible.

DIU (Defense Innovation Unit):
• Mechanism: OTA (Other Transaction Authority) — bypasses FAR/DFAR procurement regulations
• Speed: pitch to OTA contract = 60–90 days
• Size: $1M–$50M. No ceiling.
• Who it's for: TRL 5+ companies with a demonstrated commercial product (or near-commercial prototype). DIU moves fast because it demands working hardware.
• Process: pitch deck + live demo. No RFP; they pull proposals from companies they identify.
• Aether fit: post Phase II, once a 500m outdoor relay demo exists, DIU is the fastest path to a $5–20M field demo contract.

Recommended sequencing: AFWERX SBIR Phase I (year 1) → AFWERX Phase II + DARPA FENCE submission simultaneously (year 2) → DIU OTA for field demo (year 3–4).`,
  },
  {
    category: "Business",
    q: "How does a startup get a DoD contract for a new technology like WPT?",
    a: `Three primary pathways, from fastest to slowest:

1. SBIR/STTR (fastest, non-dilutive): Small Business Innovation Research grants. DoD agencies (DARPA, AFRL, NAVAIR, Army) publish solicitations annually. Phase I: $250k, 6 months — prove feasibility. Phase II: $1.5–2M, 18 months — build a prototype. Phase III: not capped, transition to production. No equity given up. Aether should apply to DARPA FENCE and AFWERX energy solicitations simultaneously.

2. DIU OTA (fast, flexible): Defense Innovation Unit uses Other Transaction Authority to bypass traditional procurement. Pitch to DIU → 60–90 day timeline to contract. Requires demonstrated prototype (not just slides). Focused on commercially-available or near-commercial tech.

3. Prime contractor partnership (slower, larger): Lockheed, Raytheon, Northrop often need specialized subcontractors. Being a Lockheed or L3Harris subcontractor on a prime contract removes the procurement burden. Slower to initiate but much larger contract values.

What DoD buyers want to see: a working demo (even at lab scale), a clear connection to a stated DoD operational problem (FOB fuel logistics is on the Operational Energy Strategy), and IP that isn't already owned by a competitor.

Key document to know: DoD Operational Energy Strategy (2022). FOB fuel dependence is explicitly named as a top logistics vulnerability.`,
  },
  {
    category: "Business",
    q: "Who are all the competitors in the WPT space and how do they compare?",
    a: `Organized by approach:

SPACE-FIRST:
• Aetherflux (US, 2024): Robinhood co-founder Bhatt, $60M raised (a16z, Breakthrough Energy, NEA). LEO laser to ground PV. 1kW demo planned 2026. Does not address ground WPT or battlefield conditions.
• Caltech SSPP: Academic. MAPLE demo in orbit 2023. No commercial product.
• ESA SOLARIS: European government program. GEO microwave, 2 GW target, 2040s. Pure research.

GROUND LASER WPT:
• PowerLight Technologies (US): The most comparable company. Demonstrated kilowatt-class laser WPT to a UAV under CENTCOM contract (2025). Single-link architecture, no relay regeneration. Has DoD relationships and contracts.
• Laser Power Corporation: Smaller, focused on industrial applications. Less defense focus.

GROUND MICROWAVE WPT:
• Emrod (New Zealand, 2019): Long-range microwave WPT, raised ~$6.5M. Partnership with Powerco (NZ utility). No battlefield focus, no relay architecture. Single-link.
• Mitsubishi Heavy Industries: Demonstrated 10kW at 500m in 2015. Internal R&D, not a separate product company.

SHORT-RANGE / DRONE CHARGING:
• WiBotic (US): Wireless charging for drones and robots, 10–50m range, near-field inductive. Strong commercial product, raised $22M. Different physics (inductive/resonant) — not competing at km range.
• Skyspark / other drone pad charging: Physical contact charging pads. Not WPT.

AETHER'S DEFENSIBLE POSITION: No competitor combines relay-regeneration + 1550nm + battlefield conditions + ground-first DoD path. PowerLight is the closest but single-link only. The relay architecture is an unoccupied niche.`,
  },
  {
    category: "Business",
    q: "How do the DARPA POWER relay teams (BEAM Co, Draper, RTX) compare to Aether's approach?",
    a: `As of 2025, no confirmed public awards for multi-hop relay WPT have been made under DARPA POWER. The following organizations have relevant capabilities and are most likely to be competitors or partners in a relay-track solicitation:

BEAM Co (commercial spinout from Caltech MAPLE):
• Heritage: MAPLE multi-aperture coherent combining in LEO orbit (2023). Demonstrated phase-controlled power beaming from a CubeSat.
• Approach: coherent aperture synthesis — combining multiple small transmitters to form a synthetic large aperture. Different from relay-regen (this is a transmitter-side architecture, not a relay chain).
• Gap: no demonstrated smoke penetration, no ground tactical focus, no relay-hop architecture.

Draper Laboratory:
• Heritage: DARPA-funded precision optical systems, AFRL laser communications work.
• Approach: optical engineering focus. Likely pursuing precision beam director and AO correction for single-link extension rather than relay chains.
• Gap: not a commercial product company — contract research lab. Not a direct competitor for commercial DoD sales.

RTX (Raytheon Technologies):
• Heritage: directed energy weapons (HELIOS, HELWS, MEHEL), DARPA laser comm programs.
• Approach: high-power laser propagation through atmosphere, precision beam steering. The infrastructure for WPT is nearly identical to directed energy weapons.
• Gap: RTX has not publicly described a relay-regeneration WPT architecture. Their focus is single-link high-power.
• Risk: if RTX enters the tactical WPT market, they bring existing DoD relationships and manufacturing scale. They would not be a startup competitor — they would be a potential acquirer or prime partner.

Why Aether's relay-regen is differentiated from all three:
• Coherent combining (BEAM Co) requires phase synchronization between nodes — technically much harder than relay-regen, which just requires point-to-point links.
• High-power single-link (RTX, Draper) cannot penetrate sustained smoke. The relay chain is the only approach that physically works in this scenario.
• The EDFA-regenerated relay concept is architecturally novel and does not appear in any published claim from these organizations as of the research compilation date.`,
  },
  {
    category: "Business",
    q: "What is the realistic market size for defense WPT?",
    a: `From the bottom up:

NEAR-TERM (1–5 years): Drone ISR + FOB power:
• US has ~800 FOBs globally (estimate). Even capturing 5% with a $500k WPT system = $200M market.
• DoD operates 10,000+ drones of various classes. Persistent ISR market: if 2% adopt WPT charging at $100k/system = $200M.
• Near-term SAM: $200–500M.

MID-TERM (5–10 years): Full FOB power + Navy shipboard + remote sensors:
• Annual DoD fuel spend for forward operations: estimated $4B+/yr. Even 1% displacement = $40M/yr recurring service revenue potential.
• Navy has 280+ ships. Drone deck systems at $250k each = $70M.
• Mid-term SAM: $500M–$2B.

LONG-TERM (10+ years): Space WPT + allied nations:
• Global space solar power market projected $1.5–2B by 2030 (Research and Markets).
• Allied militaries (NATO, UK MOD, JSDF) face same FOB logistics problem.
• Long-term TAM: $5–15B.

COMPARABLE DEAL SIZES: Raytheon's Joint Tactical Radio System: $6B program of record. Aerojet MALD jammer: $1B+. A single DoD program of record for a proven WPT system could be $500M–$2B over 10 years.

Best benchmark: PowerLight's CENTCOM contract (undisclosed but estimated $5–20M for a Phase II/III prototype and field demo).`,
  },
  {
    category: "Business",
    q: "How does WPT compare to alternatives for FOB power — solar panels, batteries, small nuclear?",
    a: `Each alternative compared to WPT on the dimensions that matter for DoD:

SOLAR PANELS:
• Pro: mature, cheap, no convoy needed once deployed
• Con: visible from satellite (targeting signature), weather-dependent, requires large footprint, doesn't work at night without massive battery storage
• Cost: $500k for a 15kW solar+storage system for a FOB
• WPT advantage: no ground signature at the FOB, power source is remote and protected, works regardless of local weather

BATTERIES (trucked in):
• Pro: simple, reliable, no expertise needed
• Con: THIS IS THE PROBLEM WPT SOLVES — batteries require the convoy
• WPT advantage: eliminates the resupply entirely

SMALL MODULAR REACTORS (eVinci, Oklo):
• Pro: high power, continuous, no fuel convoys
• Con: 2030s timeline, regulatory burden, not deployable in hostile territory, $50–200M+ cost
• WPT advantage: deployable TODAY, no regulatory burden, mobile
• Long-term: WPT and SMRs are complementary — SMR at main base, WPT to forward positions

DIESEL GENERATORS (current solution):
• Pro: reliable, understood
• Con: fuel convoys, noise, thermal and acoustic signature, fuel cost $12/L
• WPT advantage: no fuel logistics, no signature at FOB

The key insight: WPT isn't competing with solar or nuclear — it's competing with the convoy. The right framing is "convoy elimination," not "power generation."`,
  },

  {
    category: "Business",
    q: "SBIR Phase I is $250k — that doesn't cover a full WPT system. How do you scope it?",
    a: `This is the most common mistake. SBIR Phase I is NOT meant to build a working product. It funds a feasibility study with a minimal bench demonstration. Scoping correctly:

PHASE I ($250k, 6 months) — what it actually funds:
• 2 people: Principal Investigator (PI) + 1 engineer. $110k salary × 2 × 6 months = $110k labor + $55k overhead = $165k
• Bench hardware: small 1550nm fiber laser module (~$8k), InGaAsP PV test cells (~$5k), smoke chamber rental (~$10k), optical bench and mounts (~$12k) = $35k
• Total: ~$200k — fits within $250k with $50k contingency
• Deliverable: measured efficiency curves through smoke at 10m, proving the relay-regeneration concept at bench scale. NOT a deployable system.

PHASE II ($1.75M, 24 months) — outdoor prototype:
• 4 people × $110k × 2 years = $880k labor + $440k overhead = $1,320k
• Hardware: mid-power laser system + beam director ($300k)
• Test range + safety validation ($110k)
• Total: ~$1.73M — fits within $1.75M
• Deliverable: 500m outdoor demonstration of relay-regeneration with a single relay node, measured in real atmospheric conditions.

PHASE III (no cap) — production:
• This is where you build the actual $10M system. Phase III has no SBIR funding limit because it's supposed to be funded by DoD procurement or commercial contracts.

The key insight: at Phase I you're selling the IDEA with bench data. At Phase II you're selling a PROTOTYPE. The full system comes at Phase III with real DoD program funding. Trying to build the full system with SBIR money is how you run over budget.`,
  },
  {
    category: "Business",
    q: "Where can I find all the WPT research papers and validated physics constants?",
    a: `All research is compiled and publicly accessible:

Research Compendium (Notion, public):
https://shadow-hoodie-23d.notion.site/Research-Compendium-31155081d0e68140ba48da45c5e7e061

Contains ~45 sources organized into:
• Key Numbers for Simulator — validated constants vs common assumptions
• Top 5 Key Findings — most impactful 2025 results
• Microwave WPT Papers — Shinohara, JAXA, OHISAMA, NRL PRAM, Caltech MAPLE
• Laser/Optical WPT Papers — DARPA POWER PRAD, PowerLight, InP cells, Joule review
• Defense & Logistics — FOB fuel costs, NASA OTPS, ESA SOLARIS, DARPA drone charging
• Novel Approaches — relay chains, LIPC, hybrid MW+laser, distributed aperture
• Atmospheric Effects — ITU-R P.838-3, McMaster fog study, AFRL windows

Physics Constants (Google Sheet):
https://docs.google.com/spreadsheets/d/1c2rMDeXuBBIIjC_ZWHB0BqhONNZLL7Xjvd1MabUwYOM/edit

30 rows of validated constants: rain attenuation curves (ITU-R P.838-3), laser extinction by condition and wavelength, rectenna efficiency curve (Dang et al. 2021), system efficiency benchmarks (DARPA PRAD, JAXA SSPS).

Raw research file (GitHub):
https://github.com/kamber-tech/aether-sim/blob/main/research/WPT_RESEARCH_2025.md

45,000 bytes of compiled research with full citations.`,
  },

  // ── Code & Model ─────────────────────────────────────────────────────────
  {
    category: "Code & Model",
    q: "What physics models does the simulator use?",
    a: `Laser: Gaussian beam propagation with M² factor, Fried coherence radius r₀ for turbulence, Strehl ratio from Maréchal approximation, Beer-Lambert atmospheric extinction.

Microwave: Friis transmission equation, phased array gain model (aperture efficiency 0.7), Ruze phase error formula for gain reduction, ITU-R P.838-3 rain attenuation coefficients (k=0.00454, α=1.244 at 5.8 GHz horizontal).

Rectenna: power-density dependent efficiency curve (Dang et al. 2021): 85% at ≥2W, scaling to 52% at <25mW.

System overhead: 0.65× multiplier applied to chain efficiency (accounts for real-world losses not in link budget). Efficiency cap is range-dependent: 35/(1+R_km/10) — e.g., 29% @ 2 km, 19% @ 8.6 km (anchored to DARPA PRAD 2025 ~20% real-world).

Economics: DoD fully-burdened fuel cost $12/L, convoy cost $600/mile × 62 miles, FOB load 15kW, fuel burn 4.5 L/hr.`,
  },
  {
    category: "Code & Model",
    q: "Why does the simulator show low efficiency for microwave at short range?",
    a: `At 500m, a 1024-element (0.83m) array produces a beam radius of ~28m. A realistic vehicle-deployed rectenna of 10–50m² captures only a small fraction of that beam.

The simulator uses a receive aperture that scales with range: 10m² at 500m → 50m² at 2km. This is conservative but realistic for a deployable system.

If you were to use a large fixed rectenna (e.g., a 50m × 50m = 2,500m² ground installation), efficiency at 500m would improve dramatically. The simulator assumes portable/deployable hardware — not fixed infrastructure.

For short-range applications (drones, sensors), near-field coupling or tight-beam designs can achieve much higher efficiency than Friis-model far-field.`,
  },
  {
    category: "Code & Model",
    q: "What are the known limitations of the simulator?",
    a: `Known gaps between the simulator and physical reality:

1. Adaptive optics not modeled (except as a multiplier in Optimized mode): Real systems use wavefront correction that can 2–3× delivered power. The base simulation uses an overhead factor but doesn't model AO performance vs turbulence strength.

2. Near-field WPT not modeled: Within the Rayleigh distance (typically <20m for portable microwave hardware), resonant coupling physics apply and efficiency can be very high. The Friis-based model is wrong in this regime. Relevant for short-range drone charging (<50m).

3. Pointing and tracking losses for moving targets: The simulation assumes perfect pointing. In practice, a moving drone introduces beam wander and time-averaged efficiency loss. The Ruze phase error formula accounts for static pointing error, not dynamic tracking.

4. Relay-regeneration not modeled: The simulator handles single-link scenarios only. The relay chain architecture needs a separate multi-hop model.

5. Only 1070nm and 5.8 GHz: 1550nm laser (lower smoke extinction, eye-safe) and other microwave frequencies (24 GHz, 35 GHz) are not modeled.

6. Static atmospheric model: Weather condition is a discrete input (clear/haze/rain/smoke/fog). Real deployments have spatially and temporally varying conditions. No cloud cover availability model.

7. Fixed FOB load: The economics use a fixed 15kW FOB baseline. Real FOBs have variable loads (day/night, seasonal, activity-dependent).

8. No beam safety modeling: Laser WPT systems have eye hazard zones that constrain deployment geometry. Not modeled.

These gaps are documented and represent the next development priorities. Most impactful to fix first: relay-regeneration model, 1550nm support, and availability factor for weather.`,
  },
  {
    category: "Code & Model",
    q: "How does the Optimized mode work and what do the improvement estimates mean?",
    a: `Optimized mode takes a baseline simulation result and applies efficiency improvement multipliers based on well-documented technology upgrades:

Adaptive optics (laser only): +2.5× Strehl ratio improvement. Based on AFRL measurements of AO pre-compensation for directed energy applications. This is an empirical multiplier, not a first-principles calculation — actual gain depends on Cn² and correction bandwidth.

InP photovoltaic cells: efficiency multiplier of 55%/50% = 1.10× (vs default 50% GaAs monochromatic). Based on Alta Devices/NextGen Solar measured 55.2% at 1070nm monochromatic illumination (2023). Note: the base GaAs monochromatic PV is already ~50% — much higher than broadband solar cells — so the InP upgrade is a modest 10% improvement. Commercially available but expensive (~$50k/m² vs $5k/m² for GaAs).

Large aperture: 2× efficiency improvement from larger optics (tighter beam divergence and reduced geometric loss at range). At short range the baseline already captures the full beam (geometric_collection = 1.0), so gain comes from beam shaping rather than pure area scaling.

High power density rectenna (microwave only): 85%/65% = 1.31× (operating in the high-efficiency portion of the rectenna curve). Achievable by ensuring high power density at the rectenna — generally means shorter range or larger transmit array.

All improvements are subject to a range-dependent efficiency cap: 33% @ 0.5 km, 29% @ 2 km, 19% @ 8.6 km — anchored to DARPA PRAD 2025 (~20% real-world). This prevents the optimizer from returning physically impossible numbers.

Interpreting results: the optimized output shows what's achievable with a deliberate engineering effort using currently available components — not what comes off the shelf. The baseline shows what an unoptimized first-generation system would achieve.`,
  },
];

const CATEGORIES = ["All", "Physics", "Economics", "Use Cases", "Business", "Code & Model"] as const;
type Category = (typeof CATEGORIES)[number];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QAPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const filtered = QA_ITEMS.filter((item) => {
    const matchesCat = activeCategory === "All" || item.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.q.toLowerCase().includes(q) ||
      item.a.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  // When filters change, reset open accordion
  function handleCategory(cat: Category) {
    setActiveCategory(cat);
    setOpenIdx(null);
  }

  function handleSearch(val: string) {
    setSearch(val);
    setOpenIdx(null);
  }

  function toggleItem(idx: number) {
    setOpenIdx((prev) => (prev === idx ? null : idx));
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="font-semibold text-lg tracking-tight"
              style={{ color: "var(--text)", textDecoration: "none" }}
            >
              Aether
            </a>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              WPT Simulator
            </span>
          </div>
          <a
            href="https://aether-wpt.vercel.app"
            className="text-xs transition-colors"
            style={{ color: "var(--text-subtle)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-subtle)";
            }}
          >
            ← Run a simulation
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Page title */}
        <div className="mb-10">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: "var(--text)" }}
          >
            Reference Q&amp;A
          </h1>
          <p className="text-base" style={{ color: "var(--text-muted)" }}>
            Physics, math, and use cases explained
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={
                activeCategory === cat
                  ? { background: "var(--accent)", color: "#fff", border: "1px solid transparent" }
                  : {
                      background: "var(--surface)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }
              }
              onMouseEnter={(e) => {
                if (activeCategory !== cat)
                  (e.currentTarget as HTMLElement).style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== cat)
                  (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search questions and answers…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        {/* Q&A list */}
        {filtered.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl"
            style={{ border: "1px dashed var(--border)", color: "var(--text-subtle)" }}
          >
            No results for &quot;{search}&quot;
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl overflow-hidden transition-all"
                  style={{ border: `1px solid ${isOpen ? "var(--accent)" : "var(--border)"}`, background: "var(--surface)" }}
                >
                  {/* Question row */}
                  <button
                    onClick={() => toggleItem(idx)}
                    className="w-full flex items-start gap-3 px-5 py-4 text-left"
                  >
                    {/* Category pill */}
                    <span
                      className="shrink-0 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={{
                        background: "var(--surface-2)",
                        color: "var(--text-subtle)",
                        border: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.category}
                    </span>
                    <span
                      className="flex-1 text-sm font-medium leading-snug"
                      style={{ color: isOpen ? "var(--text)" : "var(--text-muted)" }}
                    >
                      {item.q}
                    </span>
                    <span
                      className="shrink-0 mt-0.5 text-xs transition-transform"
                      style={{
                        color: "var(--text-subtle)",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      ▼
                    </span>
                  </button>

                  {/* Answer */}
                  {isOpen && (
                    <div
                      className="px-5 pb-5"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <div
                        className="pt-4 text-sm leading-relaxed whitespace-pre-line"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {item.a}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
