import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'
import type { SmartPDUInstance } from './main.js'
import { flattenSensorFields } from './api.js'

export function UpdateVariableDefinitions(self: SmartPDUInstance): void {
	const variables: CompanionVariableDefinition[] = []

	variables.push({
		name: 'Device Hostname',
		variableId: 'hostname',
	})

	variables.push({
		name: 'Firmware Version',
		variableId: 'firmware',
	})

	variables.push({
		name: 'Uptime (seconds)',
		variableId: 'uptime',
	})

	variables.push({
		name: 'Number of Outlets',
		variableId: 'outlet_count',
	})

	if (self.STATUS?.outputs) {
		self.STATUS.outputs.forEach((_, index) => {
			variables.push({
				name: `Outlet ${index + 1} Name`,
				variableId: `outlet_${index + 1}_name`,
			})
			variables.push({
				name: `Outlet ${index + 1} State`,
				variableId: `outlet_${index + 1}_state`,
			})
		})
	}

	// Sensor field variables (flattened keys)
	if (self.STATUS) {
		const sensorMap = flattenSensorFields(self.STATUS)
		for (const key in sensorMap) {
			variables.push({
				name: `Sensor ${key} Name`,
				variableId: `sensor_${key.replace(/\./g, '_').replace(/\s+/g, '_').replace(/\:/g, '')}_name`, // Replace dots with underscores, spaces with underscores, colons with nothing
			})
			variables.push({
				name: `Sensor ${key} Value`,
				variableId: `sensor_${key.replace(/\./g, '_').replace(/\s+/g, '_').replace(/\:/g, '')}_value`, // Replace dots with underscores, spaces with underscores, colons with nothing
			})
			variables.push({
				name: `Sensor ${key} Unit Value`,
				variableId: `sensor_${key.replace(/\./g, '_').replace(/\s+/g, '_').replace(/\:/g, '')}_unit`, // Replace dots with underscores, spaces with underscores, colons with nothing
			})
		}
	}

	self.setVariableDefinitions(variables)
}

export function CheckVariables(self: SmartPDUInstance): void {
	const variableValues: CompanionVariableValues = {}

	if (self.STATUS?.misc) {
		variableValues['hostname'] = self.STATUS.misc.hostname
		variableValues['firmware'] = self.STATUS.misc.firm_v
		variableValues['uptime'] = self.STATUS.misc.uptime.toString()
	}

	if (self.STATUS?.outputs) {
		variableValues['outlet_count'] = self.STATUS.outputs.length.toString()
		self.STATUS.outputs.forEach((outlet, index) => {
			variableValues[`outlet_${index + 1}_name`] = outlet.name
			variableValues[`outlet_${index + 1}_state`] = outlet.state ? 'On' : 'Off'
		})
	}

	const sensorMap = flattenSensorFields(self.STATUS)

	for (const key in sensorMap) {
		const name = sensorMap[key].name
		const value = sensorMap[key].value
		const unit = sensorMap[key].unit
		variableValues[`sensor_${key.replace(/\./g, '_').replace(/\s+/g, '_').replace(/\:/g, '')}_name`] = name
		variableValues[`sensor_${key.replace(/\./g, '_').replace(/\s+/g, '_').replace(/\:/g, '')}_value`] = value
		variableValues[`sensor_${key.replace(/\./g, '_').replace(/\s+/g, '_').replace(/\:/g, '')}_unit`] =
			value + ' ' + unit
	}

	self.setVariableValues(variableValues)
}
