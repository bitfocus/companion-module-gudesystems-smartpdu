import { combineRgb, type CompanionPresetDefinitions } from '@companion-module/base'
import type { SmartPDUInstance } from './main.js'
import { computeTotalActivePowerWatts } from './variables.js'

export function UpdatePresets(self: SmartPDUInstance): void {
	const presets: CompanionPresetDefinitions = {}

	for (const outlet of self.CHOICES_OUTLETS) {
		if (outlet.id <= 0) continue // skip the "no outlets available" placeholder

		presets[`toggle_outlet_${outlet.id}`] = {
			type: 'button',
			category: 'Outlets',
			name: `Toggle Outlet ${outlet.id}`,
			style: {
				text: `$(${self.label}:outlet_${outlet.id}_name)\\n$(${self.label}:outlet_${outlet.id}_state)`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [
				{
					feedbackId: 'outlet_state',
					options: { outlet: outlet.id },
					style: { color: combineRgb(255, 255, 255), bgcolor: combineRgb(0, 204, 0) },
				},
				{
					feedbackId: 'outlet_state_off',
					options: { outlet: outlet.id },
					style: { color: combineRgb(255, 255, 255), bgcolor: combineRgb(204, 0, 0) },
				},
			],
			steps: [
				{
					down: [{ actionId: 'toggle_outlet', options: { outlet: outlet.id } }],
					up: [],
				},
			],
		}
	}

	presets['all_off'] = {
		type: 'button',
		category: 'Emergency',
		name: 'All Off',
		style: {
			text: 'ALL\\nOFF',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(153, 0, 0),
		},
		feedbacks: [],
		steps: [
			{
				down: [{ actionId: 'turn_off_outlet', options: { outlet: -1 } }],
				up: [],
			},
		],
	}

	if (computeTotalActivePowerWatts(self) !== null) {
		presets['total_power'] = {
			type: 'button',
			category: 'Power',
			name: 'Total Power Draw',
			style: {
				text: `Power\\n$(${self.label}:total_power_w) W`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [
				{
					feedbackId: 'power_threshold',
					options: { threshold: 1000 },
					style: { color: combineRgb(255, 255, 255), bgcolor: combineRgb(255, 102, 0) },
				},
			],
			steps: [
				{
					down: [{ actionId: 'refresh_status', options: {} }],
					up: [],
				},
			],
		}
	}

	self.setPresetDefinitions(presets)
}
