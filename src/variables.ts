import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'
import type { SmartPDUInstance } from './main.js'
import { flattenSensorFields } from './api.js'
import { FlatSensorMap } from './types.js'
import { normalizeLabel, parseSensorPropertyId, sensorDisplayName } from './sensorId.js'

function sensorVariablePrefix(type: number): string {
	if (type === 1) return 'line'
	if (type === 8) return 'outlet'
	return 'sensor'
}

function buildVariableId(type: number, propId: string, propName: string): { id: string; label: string } {
	const parsed = parseSensorPropertyId(propId)
	const prefix = sensorVariablePrefix(type)
	const normalizedName = normalizeLabel(propName)

	const suffix = parsed.inputNumber
		? `${parsed.sensorNumber}_input${parsed.inputNumber}_${normalizedName}`
		: `${parsed.sensorNumber}_${normalizedName}`

	return {
		id: `${prefix}_${suffix}`,
		label: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} ${propId} ${propName}`,
	}
}

/**
 * Whole-unit power draw, in Watts. Prefers a dedicated Line Power Meter (type 1) when the
 * PDU has one; falls back to summing Outlet Power Meters (type 8) when it doesn't. Returns
 * null when the device reports no power metering at all — no total is fabricated.
 */
export function computeTotalActivePowerWatts(self: SmartPDUInstance): number | null {
	const sensorMap = flattenSensorFields(self.STATUS)
	const entries = Object.values(sensorMap)

	const lineWatts = entries.filter((e) => e.type === 1 && e.name === 'ActivePower')
	if (lineWatts.length > 0) return lineWatts.reduce((sum, e) => sum + (isNaN(e.value) ? 0 : e.value), 0)

	const outletWatts = entries.filter((e) => e.type === 8 && e.name === 'ActivePower')
	if (outletWatts.length > 0) return outletWatts.reduce((sum, e) => sum + (isNaN(e.value) ? 0 : e.value), 0)

	return null
}

function sensorNameVariable(propId: string): { variableId: string; label: string } | null {
	const parsed = parseSensorPropertyId(propId)
	if (parsed.inputNumber) {
		return {
			variableId: `sensor_${parsed.sensorNumber}_input${parsed.inputNumber}_name`,
			label: `Sensor ${sensorDisplayName(parsed)} Name`,
		}
	}
	if (parsed.sensorNumber !== propId.replace(/[^\w]/g, '_')) {
		// only emit when the id actually matched the "N: ..." convention, not the raw fallback
		return { variableId: `sensor_${parsed.sensorNumber}_name`, label: `Sensor ${parsed.sensorNumber} Name` }
	}
	return null
}

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
			variables.push({ name: `Outlet ${index + 1} Switch Count`, variableId: `outlet_${index + 1}_switch_count` })
		})
	}

	if (self.STATUS) {
		const sensorMap = flattenSensorFields(self.STATUS) as FlatSensorMap
		for (const key in sensorMap) {
			const sensorEntry = sensorMap[key]

			const { id, label } = buildVariableId(sensorEntry.type, sensorEntry.id, sensorEntry.name)

			variables.push({ name: `${label}`, variableId: `${id}` })
			variables.push({ name: `${label} Value`, variableId: `${id}_value` })
		}
	}

	if (computeTotalActivePowerWatts(self) !== null) {
		variables.push({ name: 'Total Power Draw (W)', variableId: 'total_power_w' })
	}

	// Sensor/input display names, e.g. sensor_2_name, sensor_2_input1_name
	if (self.STATUS?.sensor_descr) {
		for (const desc of self.STATUS.sensor_descr) {
			for (const prop of desc.properties) {
				const nameVar = sensorNameVariable(prop.id)
				if (nameVar) variables.push({ name: nameVar.label, variableId: nameVar.variableId })
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
			variableValues[`outlet_${index + 1}_switch_count`] = outlet.sw_cnt?.toString() ?? '0'
		})
	}

	const sensorMap = flattenSensorFields(self.STATUS)

	for (const key in sensorMap) {
		const sensorEntry = sensorMap[key]
		const { id } = buildVariableId(sensorEntry.type, sensorEntry.id, sensorEntry.name)

		if (isNaN(Number(sensorEntry.value))) {
			variableValues[id] = sensorEntry.valueString || 'N/A'
			variableValues[`${id}_value`] = sensorEntry.valueString || 'N/A'
		} else {
			variableValues[id] =
				`${Number(sensorEntry.value).toFixed(sensorEntry.decPrecision)} ${sanitizedUnit(sensorEntry.unit)}`
			variableValues[`${id}_value`] = Number(sensorEntry.value).toFixed(sensorEntry.decPrecision)
		}
	}

	if (self.STATUS?.sensor_descr) {
		for (const desc of self.STATUS.sensor_descr) {
			for (const prop of desc.properties) {
				const nameVar = sensorNameVariable(prop.id)
				if (nameVar) variableValues[nameVar.variableId] = prop.name || nameVar.label
			}
		}
	}

	const totalWatts = computeTotalActivePowerWatts(self)
	if (totalWatts !== null) {
		variableValues['total_power_w'] = totalWatts.toFixed(1)
	}

	self.setVariableValues(variableValues)
}

function sanitizedUnit(unit: string): string {
	//replace deg C with °C, deg F with °F
	return unit.replace(/deg C/i, '°C').replace(/deg F/i, '°F').replace(/deg/i, '°')
}
