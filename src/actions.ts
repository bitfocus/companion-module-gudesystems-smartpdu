import type { CompanionActionDefinition } from '@companion-module/base'
import type { SmartPDUInstance } from './main.js'
import { setOutletState, resetOutlet, toggleOutlet } from './api.js'

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
				choices: self.CHOICES_OUTLETS,
			},
		],
		callback: async (action) => {
			try {
				const outletNum = Number(action.options.outlet)
				if (outletNum == -1) {
					//all outlets
					for (let i = 1; i <= self.STATUS.outputs.length; i++) {
						await setOutletState(self, i, 'on')
					}
				}
				else {
					await setOutletState(self, outletNum, 'on')
				}
			} catch (err: any) {
				self.log('error', `Failed to turn outlet ON: ${err.message}`)
			}
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
				choices: self.CHOICES_OUTLETS,
			},
		],
		callback: async (action) => {
			try {
				const outletNum = Number(action.options.outlet)
				if (outletNum == -1) {
					//all outlets
					for (let i = 1; i <= self.STATUS.outputs.length; i++) {
						await setOutletState(self, i, 'off')
					}
				}
				else {
					await setOutletState(self, Number(action.options.outlet), 'off')
				}
			} catch (err: any) {
				self.log('error', `Failed to turn outlet ON: ${err.message}`)
			}
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
			try {
				const outletNum = Number(action.options.outlet)
				if (outletNum == -1) {
					//all outlets
					for (let i = 1; i <= self.STATUS.outputs.length; i++) {
						await toggleOutlet(self, i)
					}
				}
				else {
					await toggleOutlet(self, outletNum)
				}
			} catch (err: any) {
				self.log('error', `Failed to toggle outlet: ${err.message}`)
			}
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
				choices: self.CHOICES_OUTLETS,
			},
		],
		callback: async (action) => {
			try {
				const outletNum = Number(action.options.outlet)
				if (outletNum == -1) {
					//all outlets
					for (let i = 1; i <= self.STATUS.outputs.length; i++) {
						await resetOutlet(self, i)
					}
				}
				else {
					await resetOutlet(self, outletNum)
				}
			} catch (err: any) {
				self.log('error', `Failed to reset outlet: ${err.message}`)
			}
		},
	}

	self.setActionDefinitions(actions)
}
