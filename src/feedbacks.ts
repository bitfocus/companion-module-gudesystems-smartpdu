import { combineRgb, type CompanionFeedbackDefinition } from '@companion-module/base'
import type { SmartPDUInstance } from './main.js'

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

	self.setFeedbackDefinitions(feedbacks)
}
