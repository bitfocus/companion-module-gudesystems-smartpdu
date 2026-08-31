# Changelog

## 1.1.0 (2026-08-31)

### Added

- **Power consumption tracking**: a computed `total_power_w` variable and a "Total Power Above
  Threshold" feedback, sourced from whichever power metering the connected PDU actually reports
  (Line Power Meter on "Metered" models, Outlet Power Meter on "Outlet-Metered" models). No total
  is fabricated on a device that reports no metering at all.
- **HTTPS support**, with a self-signed-certificate option (Gude PDUs ship with one by default)
  and separately-defaulted HTTP (80) / HTTPS (443) port fields.
- **Console (SSH) support** and a new **Reset Energy Counter** action, for the one thing the
  plain HTTP interface can't do.
- **Refresh Status** action, to pull current state on demand regardless of polling.
- **Delayed On/Off** action (single outlet, using the PDU's native two-step batch command) and
  **Sequence Power Up/Down** (multiple outlets, software-orchestrated stagger — the PDU has no
  native multi-outlet equivalent).
- **`outlet_N_switch_count`** variables.
- Default presets: per-outlet toggle (with color feedback), an "All Off" button, and a live
  "Total Power Draw" tile.

### Fixed

- Module state (outlet choices, variables, feedbacks) previously only populated if polling was
  enabled — a config combination that otherwise left the module non-functional.
- Every action that changes outlet or energy state now triggers its own status refresh
  afterward, so button feedback and variables update immediately even with polling disabled
  (rather than waiting for the next poll tick, or never, if polling is off).
- Consolidated three separate, slightly-diverging implementations of Gude sensor-property-ID
  parsing into one shared function — this also fixed a bug where generated variable IDs were
  redundant (`line_L1_L1_voltage` instead of `line_L1_voltage`).
- The module's previous `setOutletBatchState`/`cancelOutletBatch` functions sent the PDU's
  `cmd=5` batch command with multi-outlet parameters it doesn't support (confirmed against the
  official EPC manual) — removed as dead, unverified code and replaced with the two actions
  above.
- A non-OK HTTP response from the PDU previously fell through into parsing an already-consumed
  response body as JSON, producing a misleading error.
- The `verbose` config option previously had no effect; debug-level logging is now actually
  gated behind it.
- Fixed two runtime incompatibilities with Companion's bundled Node 18 (missing global `File`,
  missing `String.prototype.toWellFormed`) surfaced by adding HTTPS support via the `undici`
  package directly — both polyfilled.

### Changed

- `port` config field split into separate `port` (HTTP) and `httpsPort` (HTTPS) fields, each
  with its own sensible default, instead of a single field with a "0 means use the protocol
  default" convention.
