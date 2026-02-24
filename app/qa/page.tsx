"use client";

import { useState } from "react";

// ── Q&A Data ──────────────────────────────────────────────────────────────────

const QA_ITEMS = [
  {
    category: "Physics",
    q: "Why does microwave WPT fail at distances beyond 500m with portable hardware?",
    a: `At 5.8 GHz, the wavelength is 5.17 cm. For a portable 1m aperture array, the 3dB beam radius at range R is approximately R × λ/D. At 2km: beam radius = 2000 × 0.0517 / 1 = 103m. Your receiver would need to be ~100m wide to capture half that power. No portable hardware can do this.

The Rayleigh distance (near-field limit) for a 1m array is only D²/λ = 1 / 0.0517 = 19m. Every operational range is 100× beyond near-field — deep far-field divergence dominates.

Solution: very large arrays (JAXA SSPS uses a 2.6km array at GEO), or short ranges (<500m), or the relay-regeneration architecture.`,
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
    q: "What is system efficiency and why is 20% the real-world ceiling?",
    a: `System efficiency = DC power delivered at receiver / AC wall-plug power at transmitter.

Chain for laser: wall-plug → laser (40%) → atmosphere → receiver PV (35–55%) → DC-DC (95%) → DC output.
Best case: 0.40 × 0.98 × 0.98 × 0.55 × 0.95 = ~20%. This matches DARPA POWER PRAD 2025 (800W at 8.6km, ~20% end-to-end).

Chain for microwave: wall-plug → GaN PA (55%) → phased array → free-space → rectenna (85%) → DC.
Best case (short range): 0.55 × 0.85 × 0.65 = ~30%. JAXA measured 22% at 50m.

The 20% ceiling is not a model limitation — it's the product of real component efficiencies. Component-level estimates (55% PV × 85% rectenna = 47%) are optimistic because they ignore pointing, thermal, feed network, and system overhead losses.`,
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
    category: "Code & Model",
    q: "What physics models does the simulator use?",
    a: `Laser: Gaussian beam propagation with M² factor, Fried coherence radius r₀ for turbulence, Strehl ratio from Maréchal approximation, Beer-Lambert atmospheric extinction.

Microwave: Friis transmission equation, phased array gain model (aperture efficiency 0.7), Ruze phase error formula for gain reduction, ITU-R P.838-3 rain attenuation coefficients (k=0.00454, α=1.244 at 5.8 GHz horizontal).

Rectenna: power-density dependent efficiency curve (Dang et al. 2021): 85% at ≥2W, scaling to 52% at <25mW.

System overhead: 0.65× multiplier applied to chain efficiency (accounts for real-world losses not in link budget). Efficiency capped at 35% (DARPA PRAD 2025 anchor).

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

  // ── Business & Strategy ──────────────────────────────────────────────────
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

  // ── Physics (additional) ─────────────────────────────────────────────────
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
• Fiber laser: Yb:fiber at 1070nm, ~15 kW optical output (at 35% wall-plug eff, need ~43 kW electrical input). IPG Photonics YLS-15000 class. Cost: ~$300–500k. Weight: ~150 kg. Power draw: 43 kW AC.
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

  // ── Economics (additional) ───────────────────────────────────────────────
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

  // ── Use Cases (additional) ────────────────────────────────────────────────
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

  // ── Code & Model (additional) ────────────────────────────────────────────
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

InP photovoltaic cells: efficiency multiplier of 55%/35% = 1.57× (vs default 35%). Based on Alta Devices/NextGen Solar measured 55.2% at 1070nm monochromatic illumination (2023). Commercially available but expensive (~$50k/m² vs $5k/m² for GaAs).

Large aperture: 4× multiplier (doubling diameter → 4× area → 4× collected power). This is physically exact for the geometric collection term but assumes the larger aperture is achievable — at 2km, a 1m receiver is feasible; a 4m receiver requires a larger deployed structure.

High power density rectenna (microwave only): 85%/65% = 1.31× (operating in the high-efficiency portion of the rectenna curve). Achievable by ensuring high power density at the rectenna — generally means shorter range or larger transmit array.

All improvements are capped at 35% total system efficiency (the DARPA PRAD anchor — state-of-the-art demonstrated 2025). This prevents the optimizer from returning physically impossible numbers.

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

        {/* Footer note */}
        <div
          className="mt-12 text-xs text-center"
          style={{ color: "var(--text-subtle)" }}
        >
          Physics validated against ITU-R P.838-3 · DARPA POWER PRAD 2025 · JAXA SSPS 2021 · NRL PRAM 2021 · Caltech MAPLE 2023
        </div>
      </main>
    </div>
  );
}
