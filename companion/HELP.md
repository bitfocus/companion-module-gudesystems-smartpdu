# Gude Systems Smart PDU

This module allows you to control Smart PDUs from [Gude Systems](https://www.gude.info/), such as the Expert Power Control series.

## Module Setup

1. Enter the **IP address** of the PDU.
2. Optionally enable **HTTPS** (Gude PDUs ship with a self-signed certificate by default — leave "Allow Self-Signed Certificate" on unless you've installed your own). HTTP and HTTPS each have their own port field, defaulting to 80/443.
3. If the device requires authentication, enable the checkbox and enter the **username** and **password**.
4. Optionally enable **polling** to keep outlet states and sensor variables updated automatically. Power/energy values only change when polling is on (or when you press **Refresh Status**) — switching an outlet on/off always refreshes immediately regardless of polling.
5. **Console (SSH)** is a separate section, only needed for the **Reset Energy Counter** action. It uses its own login on the PDU (Configuration → Protocols → Console), not the HTTP username/password above.

---

## Actions

- **Turn ON Outlet** / **Turn OFF Outlet** — a specific outlet, or "All Outlets".
- **Toggle Outlet** — flips the current state.
- **Reset Outlet** — power-cycles using the PDU's own configured reset duration.
- **Refresh Status** — fetches current state immediately, useful with polling disabled.
- **Delayed On/Off (single outlet)** — uses the PDU's native two-step batch command: switch to a state, wait, switch to the opposite state. Single outlet only — the device has no multi-outlet equivalent of this.
- **Cancel Delayed On/Off** — cancels a pending delayed switch on an outlet.
- **Sequence Power Up/Down (multiple outlets)** — stagger several outlets on or off with a delay between each. Software-orchestrated by the module, since the PDU itself has no native multi-outlet batch command.
- **Reset Energy Counter** — resets the PDU's *resettable* energy meter for a line (the continuous total meter is untouched). Requires Console (SSH) to be enabled and configured.

---

## Feedbacks

- **Outlet ON State** / **Outlet OFF State** — color the button based on current outlet state.
- **Total Power Above Threshold** — flags when whole-unit power draw meets or exceeds a wattage you set. Only available when the PDU reports power metering.

---

## Presets

Drag-and-drop defaults are provided per outlet (a toggle button with color feedback), an "All Off" panic button, and a live "Total Power Draw" tile (also useful as a manual refresh button).

---

## Variables

- `hostname`, `firmware`, `uptime`, `outlet_count`
- `outlet_N_name`, `outlet_N_state`, `outlet_N_switch_count`
- `total_power_w` — whole-unit power draw in Watts. Only created when the PDU reports power metering (either a dedicated line meter, or by summing per-outlet meters on models that have them).
- Every sensor the PDU reports — power meters (line and/or per-outlet, depending on model), temperature, humidity, residual current, and more — is auto-discovered and exposed as a pair of variables (a formatted value with unit, and a raw numeric value), named after the sensor type and property, e.g. `line_L1_voltage`, `line_L1_activepower`.
