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

	await GetStatusData(self)
	UpdateOutletChoices(self)
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
		processStatusData(self, data)
	} catch (error: any) {
		self.log('error', `Failed to fetch status: ${error.message}`)
		self.updateStatus(InstanceStatus.ConnectionFailure, error.message)
	}
}

export function StartPolling(self: SmartPDUInstance): void {
	if (self.pollingInterval) clearInterval(self.pollingInterval)

	const intervalMs = self.config.pollingInterval
	self.pollingInterval = setInterval(() => GetStatusData(self), intervalMs)
	self.log('debug', `Polling started with interval ${intervalMs} ms`)
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
		if (outlet ==  -1) {
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
	}
	catch(error) {
		self.log('error', `Error setting outlet state for outlet ${outlet}: ${error instanceof Error ? error.message : String(error)}`)
		return
	}
}

export async function resetOutlet(self: SmartPDUInstance, outlet: number): Promise<void> {
	const url = new URL('/', `http://${self.config.ip}`)

	let outletString = String(outlet)
	if (outlet ==  -1) {
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
	}
	else {
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
			const sensorId = prop?.id ?? sensorIndex.toString()
			const fieldValues = values.values[sensorIndex]
			if (!fieldValues) continue

			descr?.fields?.forEach((field, fieldIndex) => {
				const key = `${descr.type}.${sensorId}.${fieldIndex}`
				result[key] = {
					value: fieldValues[fieldIndex]?.v ?? NaN,
					unit: field.unit,
					name: field.name,
				}
			})
		}
	}

	return result
}
