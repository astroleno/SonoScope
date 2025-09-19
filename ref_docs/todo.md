# SonoScope TODO Plan (MVP → Release)

## 1. Scope & Goals
- Mobile-first real-time visualization, FMP ≤ 1s, first danmu ≤ 1s.
- Stable style switching (no jitter), weak/zero network fallback OK.
- Unified data contracts + plugin hot-swap; LLM as optional enhancement.
- Accessibility: WCAG 2.1 AA baseline, keyboard-only usable, SR compatible.

References: docs/01-overview-scope.md, docs/02-nonfunctional.md

## 2. Milestones & Timeline
- M1 Prototype (2w): Audio in + features + event bus + 1 visual + local danmu + a11y baseline.
- M2 Integrate (2w): 2nd visual + preset interpolation + GLM-4.5 + mobile optimization + keyboard nav polish.
- M3 Release (1w): Plugin registry/config page + perf/stability hardening + docs/demo + a11y audit.

References: docs/09-milestones-testing.md

## 3. Workstreams & Tasks

### A. Audio & Features
- [ ] A1: Microphone permission flow (desktop/mobile gesture unlock) [M1]
- [ ] A2: AudioWorklet pipeline + analyser node wiring [M1]
- [ ] A3: Feature extraction (rms, centroid, flux, onsetRate) [M1]
- [ ] A4: Conditional pitch/bpm updates (gated by stability) [M2]
- [ ] A5: Perf tuning: FFT size, hop length, back-pressure handling [M2]

### B. Event Bus & Contracts
- [ ] B1: Lightweight event bus abstraction [M1]
- [ ] B2: Define FeatureTick/DecisionEvent (versioned) [M1]
- [ ] B3: JSON Schema + ajv validation + strict drop-on-fail [M1]
- [ ] B4: Telemetry events (fps, rtt, fallbacks) [M2]

### C. Visualization Plugins (p5)
- [ ] C1: Plugin interface (init/applyPreset/renderTick/dispose) [M1]
- [ ] C2: TransitionManager for preset interpolation [M2]
- [ ] C3: Visual 1 (basic particles) [M1]
- [ ] C4: Visual 2 (trap/wave variant) [M2]
- [ ] C5: Capability declaration + param whitelist [M2]

### D. Danmu System
- [ ] D1: Local phrase library + templating [M1]
- [ ] D2: Similarity dedupe (recent 10s) [M2]
- [ ] D3: A/B routing: local-first, then LLM on steady state [M2]

### E. LLM Integration (GLM-4.5)
- [ ] E1: Edge token issuance + rate limit (optional) [M2]
- [ ] E2: JSON-only output prompt + schema validation [M2]
- [ ] E3: Timeouts, retries, and fallback to local [M2]

### F. Accessibility (a11y)
- [ ] F1: Keyboard-first navigation; visible focus; escape hatches [M1]
- [ ] F2: ARIA live region for state/announcements [M1]
- [ ] F3: High-contrast mode + reduced motion switch [M2]
- [ ] F4: Screen reader smoke tests (VoiceOver/NVDA) [M3]

### G. Mobile Optimization
- [ ] G1: Gesture-initiated AudioContext activation [M1]
- [ ] G2: Adaptive particle density/resolution on weak devices [M2]
- [ ] G3: iOS Safari quirks handling + webgl fallbacks [M2]

### H. Edge/Backend (Optional)
- [ ] H1: Vercel Edge function for short-lived tokens [M2]
- [ ] H2: Config delivery and feature flags [M2]

### I. Observability & Diagnostics
- [ ] I1: Client metrics (ttfb_ms, fps, llm_rtt_ms) [M2]
- [ ] I2: Error logging + user-friendly recovery paths [M2]
- [ ] I3: Dashboard/console for dev builds [M3]

### J. Security & Privacy
- [ ] J1: Local-only audio by default; explicit cloud toggle [M1]
- [ ] J2: Data minimization (features only, no raw audio) [M1]
- [ ] J3: TLS, domain allowlist, least-privilege tokens [M2]

### K. Docs & DX
- [ ] K1: Split docs scaffold (done) [M1]
- [ ] K2: Dev setup guide + scripts table [M2]
- [ ] K3: Plugin guide + template (CLI optional) [M2]
- [ ] K4: Accessibility checklist + testing guide [M3]
- [ ] K5: Demo site / examples polishing [M3]

## 4. Deliverables Per Milestone
- M1: Running prototype (mic→features→visual1→local danmu), schema validation, basic a11y, docs skeleton.
- M2: Visual2 + transitions, GLM-4.5 integration with strict JSON, mobile optimization, telemetry, hardened UX.
- M3: Registry/config UI, performance pass, full docs, a11y audit report.

## 5. Acceptance Criteria
- Perf: desktop ≥45fps, mobile ≥30fps (10 min run); first danmu <1s; later avg <800ms.
- Stability: no jitter loop on style switches; clean fallbacks on errors.
- a11y: keyboard-only flows pass; SR key actions understandable; AA contrast.

References: docs/02-nonfunctional.md, docs/09-milestones-testing.md

## 6. Risks & Mitigations
- Style oscillation → enter/exit thresholds + cooldown + EMA/median.
- Mobile power/thermals → conditional updates + adaptive density + optional OffscreenCanvas.
- Network volatility → LLM optional enhancement; local danmu complete; features-only uplink.
- Plugin fragmentation → param whitelist + capability declaration + schema gate.

References: docs/11-risks.md

## 7. Dependencies & Assumptions
- Node 18+, pnpm 8+, modern browsers (Web Audio + OffscreenCanvas fallback).
- Optional: Vercel Edge for tokens/config; GLM-4.5 access.

## 8. Tracking & Rituals
- Standups (async 10 min), weekly milestone review, retro at each Mx.
- Issue labels: [M1]/[M2]/[M3], area: audio/features/visuals/a11y/llm/docs.
- Metrics dashboard for fps/rtt/fallback_rate; CI gate for type/lint/test.

## 9. Pointers
- PRD (lite): PRD_Lite.md
- Split docs index: docs/README.md
- Contracts: docs/04-events-contracts.md
- Plugin spec: docs/05-plugin-spec.md
- LLM strategy: docs/06-llm-strategy.md

