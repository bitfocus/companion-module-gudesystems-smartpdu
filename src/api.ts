import { InstanceStatus } from '@companion-module/base'
import type { SmartPDUInstance } from './main.js'
import type { GudeStatusResponse, FlatSensorMap, PowerState } from './types.js'

// --- INIT + POLLING ---

export async function InitConnection(self: SmartPDUInstance): Promise<void> {
	if (typeof self.config.ip !== 'string' || self.config.ip.trim() === '') {
		self.log('warn', 'No IP address configured. Skipping initialization.')
		self.updateStatus(InstanceStatus.BadConfig, 'Missing IP address')
		return
	}

	self.log('debug', 'Initializing PDU connection')
	BuildAuthHeader(self)

	//await GetStatusData(self)

	self.updateStatus(InstanceStatus.Ok, 'Connected')
	self.log('debug', 'PDU initialized successfully')

	self.updateActions()
	self.updateFeedbacks()
	self.updateVariableDefinitions()

	if (self.config.enablePolling) {
		self.log('debug', 'Starting polling')
		StartPolling(self)
	} else {
		self.log('debug', 'Polling is disabled')
		StopPolling(self)
	}
}

function BuildAuthHeader(self: SmartPDUInstance): void {
	self.authHeader = {}

	if (self.config.useAuthentication && self.config.username && self.config.password) {
		const encoded = Buffer.from(`${self.config.username}:${self.config.password}`).toString('base64')
		self.authHeader = {
			Authorization: `Basic ${encoded}`,
		}
	}
}

async function GetStatusData(self: SmartPDUInstance): Promise<void> {
	self.log('debug', 'Fetching PDU status')

	try {
		const url = new URL('/statusjsn.js', `http://${self.config.ip}`)
		url.searchParams.set('components', '1073741823')

		const res = await fetch(url.toString(), {
			headers: self.authHeader,
		})

		if (!res.ok) {
			const text = await res.text()
			self.log('error', `Failed to fetch status: ${res.status} - ${text}`)
		}

		const data = (await res.json()) as GudeStatusResponse
		//console.log(JSON.stringify(data.sensor_descr, null, 2))
		processStatusData(self, data)

		//if we have not yet updated outlet choices, do it now
		if (self.CHOICES_OUTLETS.length === 0) {
			UpdateOutletChoices(self)

			self.updateActions()
			self.updateFeedbacks()
			self.updateVariableDefinitions()
		}
	} catch (error: any) {
		self.log('error', `Failed to fetch status: ${error.message}`)
		self.updateStatus(InstanceStatus.ConnectionFailure, error.message)
	}
}

export function StartPolling(self: SmartPDUInstance): void {
	if (self.pollingInterval) {
		clearTimeout(self.pollingInterval)
	}

	let isPolling = false

	const poll = async () => {
		if (isPolling) {
			self.log('warn', 'Polling skipped: previous request still running')
			return
		}

		isPolling = true

		try {
			await GetStatusData(self)
		} catch (err: any) {
			self.log('error', `Polling error: ${err.message}`)
		} finally {
			isPolling = false
			self.pollingInterval = setTimeout(poll, self.config.pollingInterval)
		}
	}

	self.log('debug', `Polling started with interval ${self.config.pollingInterval} ms`)
	poll()
}

export function StopPolling(self: SmartPDUInstance): void {
	if (self.pollingInterval) {
		clearInterval(self.pollingInterval)
		self.pollingInterval = null as unknown as NodeJS.Timeout
	}
}

// --- OUTLET CHOICES ---

export function UpdateOutletChoices(self: SmartPDUInstance): void {
	self.log('debug', 'Updating outlet choices')
	self.CHOICES_OUTLETS = []
	self.CHOICES_OUTLETS_ALL = []

	if (!self.STATUS.outputs || self.STATUS.outputs.length === 0) {
		self.log('warn', 'No outlets found in status data')
		self.CHOICES_OUTLETS = [{ id: 0, label: 'No outlets available' }]
		self.updateStatus(InstanceStatus.UnknownWarning, 'No outlets available')
		return
	}

	self.CHOICES_OUTLETS = self.STATUS.outputs.map((o, index) => ({
		id: index + 1,
		label: `${index + 1} - ${o.name ?? 'Unnamed Outlet'}`,
	}))

	//copy the choices to the all outlets array
	self.CHOICES_OUTLETS_ALL = [...self.CHOICES_OUTLETS]

	//add an "all outlets" option to the beginning
	self.CHOICES_OUTLETS_ALL.unshift({ id: -1, label: 'All Outlets' })
}

// --- SENSOR HELPERS ---

const SENSOR_TYPE_LABELS: Record<number, string> = {
	1: 'Line Power Meter',
	8: 'Outlet Power Meter',
	9: 'Residual Current Meter',
	12: 'RCMB Module',
	20: 'System Data',
	51: 'Temperature',
	52: 'Temp/Humidity',
	53: 'Temp/Humidity/Pressure',
	101: 'eFuses Bank Sensor',
	102: 'DC Power Source',
	664: 'Voltage/Current Meter',
	665: 'Temperature/Humidity Sensor',
}

export function getSensorTypeLabel(type: number): string {
	return SENSOR_TYPE_LABELS[type] ?? `Sensor Type ${type}`
}

// --- OUTLET COMMANDS ---

export async function setOutletState(self: SmartPDUInstance, outlet: number, state: PowerState): Promise<void> {
	try {
		if (state === 'reset') return await resetOutlet(self, outlet)
		if (state === 'toggle') return await toggleOutlet(self, outlet)

		const value = state === 'on' ? 1 : 0
		const url = new URL('/ov.html', `http://${self.config.ip}`)

		let outletString = String(outlet)
		if (outlet == -1) {
			// Special case for "All Outlets"
			outletString = 'all'
		}
		url.searchParams.set('cmd', '1')
		url.searchParams.set('p', outletString)
		url.searchParams.set('s', String(value))

		const res = await fetch(url.toString(), {
			method: 'GET',
			headers: self.authHeader,
		})

		if (!res.ok) {
			const text = await res.text()
			self.log('error', `Failed to set outlet state for outlet ${outlet}: ${res.status} - ${text}`)
		}
	} catch (error) {
		self.log(
			'error',
			`Error setting outlet state for outlet ${outlet}: ${error instanceof Error ? error.message : String(error)}`,
		)
		return
	}
}

export async function resetOutlet(self: SmartPDUInstance, outlet: number): Promise<void> {
	const url = new URL('/', `http://${self.config.ip}`)

	let outletString = String(outlet)
	if (outlet == -1) {
		// Special case for "All Outlets"
		outletString = 'all'
	}

	url.searchParams.set('cmd', '12')
	url.searchParams.set('p', outletString)

	const res = await fetch(url.toString(), {
		method: 'GET',
		headers: self.authHeader,
	})

	if (!res.ok) {
		const text = await res.text()
		self.log('error', `Failed to reset outlet ${outlet}: ${res.status} - ${text}`)
	}
}

export async function toggleOutlet(self: SmartPDUInstance, outlet: number): Promise<void> {
	if (outlet == -1) {
		//cannot toggle all outlets at once
		self.log('warn', 'Cannot toggle all outlets at once. Use individual outlet toggling instead.')
	} else {
		const outletState = self.STATUS.outputs?.[outlet - 1]
		if (!outletState) {
			self.log('warn', `Outlet ${outlet} not found in status data`)
			return
		}

		const newState: PowerState = outletState.state ? 'off' : 'on'
		await setOutletState(self, outlet, newState)
	}
}

export async function setOutletBatchState(
	self: SmartPDUInstance,
	startOutlet: number,
	delaySeconds: number,
	states: (0 | 1)[],
): Promise<void> {
	const url = new URL('/', `http://${self.config.ip}`)
	url.searchParams.set('cmd', '5')
	url.searchParams.set('p', String(startOutlet))
	url.searchParams.set('s', String(delaySeconds))

	states.forEach((state, i) => {
		url.searchParams.set(`a${i + 1}`, String(state))
	})

	const res = await fetch(url.toString(), {
		method: 'GET',
		headers: self.authHeader,
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Failed to start outlet batch mode: ${res.status} - ${text}`)
	}
}

export async function cancelOutletBatch(self: SmartPDUInstance, outlet: number): Promise<void> {
	const url = new URL('/', `http://${self.config.ip}`)
	url.searchParams.set('cmd', '2')
	url.searchParams.set('p', String(outlet))

	const res = await fetch(url.toString(), {
		method: 'GET',
		headers: self.authHeader,
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Failed to cancel outlet batch mode: ${res.status} - ${text}`)
	}
}

// --- STATUS PROCESSING ---

export function processStatusData(self: SmartPDUInstance, data: GudeStatusResponse): void {
	self.STATUS = data

	self.checkVariables()
	self.checkFeedbacks()
}

export function parseSensorReadings(status: GudeStatusResponse): any[] {
	if (!status.sensor_descr || !status.sensor_values) return []

	const readings: any[] = []

	for (const descr of status.sensor_descr) {
		const values = status.sensor_values.find((v) => v.type === descr.type)
		if (!values) continue

		for (let i = 0; i < descr.num; i++) {
			const prop = descr.properties[i]
			const sensorValues = values.values[i]
			if (!prop || !sensorValues) continue

			readings.push({
				id: prop.id,
				name: prop.name,
				type: descr.type,
				readings: descr?.fields?.map((field, index) => ({
					label: field.name,
					value: sensorValues[index]?.v ?? NaN,
					unit: field.unit,
					precision: field.decPrecision,
				})),
			})
		}
	}

	return readings
}

export function flattenSensorFields(status: GudeStatusResponse): FlatSensorMap {
	if (!status.sensor_descr || !status.sensor_values) return {}

	const result: FlatSensorMap = {}

	for (const descr of status.sensor_descr) {
		const values = status.sensor_values.find((v) => v.type === descr.type)
		if (!values) continue

		for (let sensorIndex = 0; sensorIndex < descr.num; sensorIndex++) {
			const prop = descr.properties[sensorIndex]
			let sensorId = prop?.id ?? sensorIndex.toString()
			let sensorName = normalizeSensorName(sensorId)
			sensorId = normalizeSensorId(sensorId) // Normalize sensor ID

			const safeSensorId = sensorId.replace(/\./g, '').replace(/\s+/g, '').replace(/\:/g, '')
			const fieldValues = values.values[sensorIndex]
			if (!fieldValues) continue

			//console.log(descr)

			descr?.fields?.forEach((field, fieldIndex) => {
				//const key = `${descr.type}.${sensorId}.${fieldIndex}`

				//remove sapces, colons, and convert to lowercase for safe field name
				const safeFieldName = field.name.replace(/\s+/g, '').replace(/\:/g, '').toLowerCase()
				const key = `sensor_${safeSensorId}_${safeFieldName}`
				//console.log(key)
				//console.log(field)
				result[key] = {
					sensorName: sensorName,
					id: sensorId,
					safeId: safeSensorId,
					type: descr.type,
					typeName: getSensorTypeLabel(descr.type),
					value: fieldValues[fieldIndex]?.v ?? NaN,
					valueString: fieldValues[fieldIndex]?.v?.toString() ?? '',
					unit: field.unit,
					name: field.name,
					decPrecision: field.decPrecision ?? 0, // Default to 0 if not specified
				}
			})
		}
	}

	return result
}

function normalizeSensorId(id: string): string {
	// Match full pattern with input (e.g., "2: 7210 - I1")
	const inputMatch = id.match(/^(\d+):.*?- I(\d+)$/)
	if (inputMatch) {
		return `${inputMatch[1]}_input${inputMatch[2]}`
	}

	// Match pattern with no input (e.g., "2: 7210")
	const sensorMatch = id.match(/^(\d+):/)
	if (sensorMatch) {
		return sensorMatch[1]
	}

	// Fallback: sanitize
	return id.replace(/[^\w]/g, '_')
}

function normalizeSensorName(id: string): string {
	// Match full pattern with input (e.g., "2: 7210 - I1")
	const inputMatch = id.match(/^(\d+):.*?- I(\d+)$/)
	if (inputMatch) {
		return `${inputMatch[1]} Input ${inputMatch[2]}`
	}

	// Match pattern with no input (e.g., "2: 7210")
	const sensorMatch = id.match(/^(\d+):/)
	if (sensorMatch) {
		return `${sensorMatch[1]}`
	}

	// Fallback: just return the original or simplified version
	return id
}
