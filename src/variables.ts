import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'
import type { SmartPDUInstance } from './main.js'
import { flattenSensorFields } from './api.js'
import { FlatSensorMap } from './types.js'

export function UpdateVariableDefinitions(self: SmartPDUInstance): void {
	const variables: CompanionVariableDefinition[] = []

	variables.push({ name: 'Device Hostname', variableId: 'hostname' })
	variables.push({ name: 'Firmware Version', variableId: 'firmware' })
	variables.push({ name: 'Uptime (seconds)', variableId: 'uptime' })
	variables.push({ name: 'Number of Outlets', variableId: 'outlet_count' })

	if (self.STATUS?.outputs) {
		self.STATUS.outputs.forEach((_, index) => {
			variables.push({ name: `Outlet ${index + 1} Name`, variableId: `outlet_${index + 1}_name` })
			variables.push({ name: `Outlet ${index + 1} State`, variableId: `outlet_${index + 1}_state` })
		})
	}

	if (self.STATUS) {
		const sensorMap = flattenSensorFields(self.STATUS) as FlatSensorMap
		//console.log('Sensor Map:', sensorMap)
		for (const key in sensorMap) {
			const sensorEntry = sensorMap[key]
			variables.push({ name: `Sensor ${sensorEntry.sensorName} ${sensorEntry.name}`, variableId: `${key}` })
			variables.push({ name: `Sensor ${sensorEntry.sensorName} ${sensorEntry.name} Value`, variableId: `${key}_value` })
		}
	}

	// Add sensor input names like sensor_2_name and sensor_2_input1_name
	if (self.STATUS?.sensor_descr) {
		for (const desc of self.STATUS.sensor_descr) {
			for (const prop of desc.properties) {
				const matchInput = prop.id.match(/^(\d+):.*?- I(\d+)$/)
				const matchNoInput = prop.id.match(/^(\d+):/)

				let variableId = ''
				let label = ''

				if (matchInput) {
					const sensor = matchInput[1]
					const input = matchInput[2]
					variableId = `sensor_${sensor}_input${input}_name`
					label = `Sensor ${sensor} Input ${input} Name`
				} else if (matchNoInput) {
					const sensor = matchNoInput[1]
					variableId = `sensor_${sensor}_name`
					label = `Sensor ${sensor} Name`
				}

				if (variableId) {
					variables.push({
						name: label,
						variableId: variableId,
					})
				}
			}
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
		const sensorEntry = sensorMap[key]

		//if sensorEntry.value is Nan, use valueString instead
		if (isNaN(Number(sensorEntry.value))) {
			variableValues[key] = sensorEntry.valueString || 'N/A'
			variableValues[`${key}_value`] = sensorEntry.valueString || 'N/A'
		} else {
			variableValues[key] =
				`${Number(sensorEntry.value).toFixed(sensorEntry.decPrecision)} ${sanitizedUnit(sensorEntry.unit)}`
			variableValues[`${key}_value`] = Number(sensorEntry.value).toFixed(sensorEntry.decPrecision)
		}
	}

	// Build sensor-level input variable names like sensor_7210_I1_name
	if (self.STATUS?.sensor_descr) {
		for (const desc of self.STATUS.sensor_descr) {
			for (const prop of desc.properties) {
				const matchInput = prop.id.match(/^(\d+):.*?- I(\d+)$/)
				const matchNoInput = prop.id.match(/^(\d+):/)

				let variableId = ''
				let label = ''

				if (matchInput) {
					const sensor = matchInput[1]
					const input = matchInput[2]
					variableId = `sensor_${sensor}_input${input}_name`
					label = `Sensor ${sensor} Input ${input}`
				} else if (matchNoInput) {
					const sensor = matchNoInput[1]
					variableId = `sensor_${sensor}_name`
					label = `Sensor ${sensor}`
				}

				if (variableId) {
					variableValues[variableId] = prop.name || label
				}
			}
		}
	}

	self.setVariableValues(variableValues)
}

function sanitizedUnit(unit: string): string {
	//replace deg C with °C, deg F with °F
	return unit.replace(/deg C/i, '°C').replace(/deg F/i, '°F').replace(/deg/i, '°')
}
