import type { CompanionActionDefinition } from '@companion-module/base'
import type { SmartPDUInstance } from './main.js'
import { setOutletState, resetOutlet, toggleOutlet, delayedOutletSwitch, cancelDelayedSwitch } from './api.js'
import { runConsoleCommand, assertConsoleOk } from './ssh.js'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export function UpdateActions(self: SmartPDUInstance): void {
	const actions: Record<string, CompanionActionDefinition> = {}

	actions['turn_on_outlet'] = {
		name: 'Turn ON Outlet',
		options: [
			{
				type: 'dropdown',
				label: 'Outlet',
				id: 'outlet',
				default: 1,
				choices: self.CHOICES_OUTLETS_ALL,
			},
		],
		callback: async (action) => {
			await setOutletState(self, Number(action.options.outlet), 'on')
		},
	}

	actions['turn_off_outlet'] = {
		name: 'Turn OFF Outlet',
		options: [
			{
				type: 'dropdown',
				label: 'Outlet',
				id: 'outlet',
				default: 1,
				choices: self.CHOICES_OUTLETS_ALL,
			},
		],
		callback: async (action) => {
			await setOutletState(self, Number(action.options.outlet), 'off')
		},
	}

	actions['toggle_outlet'] = {
		name: 'Toggle Outlet',
		options: [
			{
				type: 'dropdown',
				label: 'Outlet',
				id: 'outlet',
				default: 1,
				choices: self.CHOICES_OUTLETS,
			},
		],
		callback: async (action) => {
			await toggleOutlet(self, Number(action.options.outlet))
		},
	}

	actions['reset_outlet'] = {
		name: 'Reset Outlet',
		options: [
			{
				type: 'dropdown',
				label: 'Outlet',
				id: 'outlet',
				default: 1,
				choices: self.CHOICES_OUTLETS_ALL,
			},
		],
		callback: async (action) => {
			await resetOutlet(self, Number(action.options.outlet))
		},
	}

	actions['refresh_status'] = {
		name: 'Refresh Status',
		options: [],
		callback: async () => {
			await self.refreshStatus()
		},
	}

	actions['delayed_switch'] = {
		name: 'Delayed On/Off (single outlet)',
		description:
			"Uses the PDU's native two-step batch command. Single outlet only — the device has no multi-outlet equivalent.",
		options: [
			{
				type: 'dropdown',
				label: 'Outlet',
				id: 'outlet',
				default: 1,
				choices: self.CHOICES_OUTLETS,
			},
			{
				type: 'dropdown',
				label: 'First action',
				id: 'firstState',
				default: 1,
				choices: [
					{ id: 1, label: 'Turn ON, then OFF after delay' },
					{ id: 0, label: 'Turn OFF, then ON after delay' },
				],
			},
			{
				type: 'number',
				label: 'Delay (seconds)',
				id: 'delaySeconds',
				default: 5,
				min: 1,
				max: 65535,
			},
		],
		callback: async (action) => {
			try {
				await delayedOutletSwitch(
					self,
					Number(action.options.outlet),
					Number(action.options.firstState) as 0 | 1,
					Number(action.options.delaySeconds),
				)
			} catch (err: any) {
				self.log('error', `Failed to start delayed switch: ${err.message}`)
			}
		},
	}

	actions['cancel_delayed_switch'] = {
		name: 'Cancel Delayed On/Off',
		options: [
			{
				type: 'dropdown',
				label: 'Outlet',
				id: 'outlet',
				default: 1,
				choices: self.CHOICES_OUTLETS,
			},
		],
		callback: async (action) => {
			try {
				await cancelDelayedSwitch(self, Number(action.options.outlet))
			} catch (err: any) {
				self.log('error', `Failed to cancel delayed switch: ${err.message}`)
			}
		},
	}

	actions['sequence_power'] = {
		name: 'Sequence Power Up/Down (multiple outlets)',
		description:
			'Software-orchestrated stagger across the selected outlets — the PDU has no native multi-outlet batch command, so this switches each outlet in turn with a delay between them.',
		options: [
			{
				type: 'multidropdown',
				label: 'Outlets (switched in ascending order for Power Up, descending for Power Down)',
				id: 'outlets',
				default: [],
				choices: self.CHOICES_OUTLETS,
			},
			{
				type: 'dropdown',
				label: 'Direction',
				id: 'direction',
				default: 'on',
				choices: [
					{ id: 'on', label: 'Power Up' },
					{ id: 'off', label: 'Power Down' },
				],
			},
			{
				type: 'number',
				label: 'Delay between outlets (ms)',
				id: 'delayMs',
				default: 500,
				min: 0,
				max: 60000,
			},
		],
		callback: async (action) => {
			const outlets = (action.options.outlets as (string | number)[]).map(Number)
			const direction = action.options.direction as 'on' | 'off'
			const delayMs = Number(action.options.delayMs)

			const ordered = direction === 'on' ? [...outlets].sort((a, b) => a - b) : [...outlets].sort((a, b) => b - a)

			for (let i = 0; i < ordered.length; i++) {
				await setOutletState(self, ordered[i], direction)
				if (i < ordered.length - 1 && delayMs > 0) {
					await sleep(delayMs)
				}
			}
		},
	}

	if (self.CHOICES_LINES.length > 0) {
		actions['reset_energy_counter'] = {
			name: 'Reset Energy Counter',
			description:
				"Resets the PDU's resettable energy meter via the console (SSH). Requires Console access to be enabled in module configuration.",
			options: [
				{
					type: 'dropdown',
					label: 'Line',
					id: 'line',
					default: self.CHOICES_LINES[0]?.id,
					choices: self.CHOICES_LINES,
				},
			],
			callback: async (action) => {
				try {
					const response = await runConsoleCommand(self, `linesensor ${action.options.line} counter reset`)
					assertConsoleOk(response)
				} catch (err: any) {
					self.log('error', `Failed to reset energy counter: ${err.message}`)
				}
			},
		}
	}

	self.setActionDefinitions(actions)
}
