import { combineRgb, type CompanionFeedbackDefinition } from '@companion-module/base'
import type { SmartPDUInstance } from './main.js'
import { computeTotalActivePowerWatts } from './variables.js'

export function UpdateFeedbacks(self: SmartPDUInstance): void {
	const feedbacks: Record<string, CompanionFeedbackDefinition> = {}

	feedbacks['outlet_state'] = {
		type: 'boolean',
		name: 'Outlet ON State',
		description: 'Indicates if the selected outlet is currently ON',
		options: [
			{
				type: 'dropdown',
				label: 'Outlet',
				id: 'outlet',
				default: 1,
				choices: self.CHOICES_OUTLETS,
			},
		],
		defaultStyle: {
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 204, 0),
		},
		callback: (feedback) => {
			const outletIndex = Number(feedback.options.outlet) - 1
			const outlet = self.STATUS.outputs?.[outletIndex]
			return outlet?.state === 1
		},
	}

	feedbacks['outlet_state_off'] = {
		type: 'boolean',
		name: 'Outlet OFF State',
		description: 'Indicates if the selected outlet is currently OFF',
		options: [
			{
				type: 'dropdown',
				label: 'Outlet',
				id: 'outlet',
				default: 1,
				choices: self.CHOICES_OUTLETS,
			},
		],
		defaultStyle: {
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(204, 0, 0),
		},
		callback: (feedback) => {
			const outletIndex = Number(feedback.options.outlet) - 1
			const outlet = self.STATUS.outputs?.[outletIndex]
			return outlet?.state === 0
		},
	}

	if (computeTotalActivePowerWatts(self) !== null) {
		feedbacks['power_threshold'] = {
			type: 'boolean',
			name: 'Total Power Above Threshold',
			description: 'Flags when whole-unit power draw meets or exceeds a wattage you set — an early overload warning.',
			options: [
				{
					type: 'number',
					label: 'Threshold (W)',
					id: 'threshold',
					default: 1000,
					min: 0,
					max: 100000,
				},
			],
			defaultStyle: {
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(255, 102, 0),
			},
			callback: (feedback) => {
				const watts = computeTotalActivePowerWatts(self)
				if (watts === null) return false
				return watts >= Number(feedback.options.threshold)
			},
		}
	}

	self.setFeedbackDefinitions(feedbacks)
}
