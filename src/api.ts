import { InstanceStatus } from '@companion-module/base'
import { Agent, fetch as undiciFetch, type Dispatcher } from 'undici'
import type { SmartPDUInstance } from './main.js'
import type { GudeStatusResponse, FlatSensorMap, PowerState } from './types.js'
import { parseSensorPropertyId, sensorDisplayName } from './sensorId.js'

// --- TRANSPORT ---

let insecureAgent: Agent | undefined

function getDispatcher(self: SmartPDUInstance): Dispatcher | undefined {
	if (!self.config.useHttps || !self.config.allowSelfSigned) return undefined
	if (!insecureAgent) {
		insecureAgent = new Agent({ connect: { rejectUnauthorized: false } })
	}
	return insecureAgent
}

function buildUrl(self: SmartPDUInstance, path: string): URL {
	const protocol = self.config.useHttps ? 'https' : 'http'
	const defaultPort = self.config.useHttps ? 443 : 80
	const port = self.config.port || defaultPort
	return new URL(path, `${protocol}://${self.config.ip}:${port}`)
}

async function pduFetch(self: SmartPDUInstance, url: URL, method: 'GET' = 'GET'): Promise<string> {
	const res = await undiciFetch(url.toString(), {
		method,
		headers: self.authHeader,
		dispatcher: getDispatcher(self),
	})

	if (!res.ok) {
		throw new Error(`HTTP ${res.status}: ${await res.text()}`)
	}

	return res.text()
}

// --- INIT + POLLING ---

export async function InitConnection(self: SmartPDUInstance): Promise<void> {
	if (typeof self.config.ip !== 'string' || self.config.ip.trim() === '') {
		self.log('warn', 'No IP address configured. Skipping initialization.')
		self.updateStatus(InstanceStatus.BadConfig, 'Missing IP address')
		return
	}

	self.debugLog('Initializing PDU connection')
	BuildAuthHeader(self)

	await RefreshStatus(self)

	self.updateActions()
	self.updateFeedbacks()
	self.updateVariableDefinitions()
	self.updatePresets()

	if (self.config.enablePolling) {
		self.debugLog('Starting polling')
		StartPolling(self)
	} else {
		self.debugLog('Polling is disabled')
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

/** Fetches current status once. Safe to call regardless of whether polling is enabled. */
export async function RefreshStatus(self: SmartPDUInstance): Promise<void> {
	self.debugLog('Fetching PDU status')

	try {
		const url = buildUrl(self, '/statusjsn.js')
		url.searchParams.set('components', '1073741823')

		const body = await pduFetch(self, url)
		const data = JSON.parse(body) as GudeStatusResponse

		processStatusData(self, data)
		self.updateStatus(InstanceStatus.Ok, 'Connected')

		// first successful fetch: populate outlet/line-dependent definitions
		if (self.CHOICES_OUTLETS.length === 0) {
			UpdateOutletChoices(self)
			UpdateLineMeterChoices(self)
			self.updateActions()
			self.updateFeedbacks()
			self.updateVariableDefinitions()
			self.updatePresets()
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
			await RefreshStatus(self)
		} catch (err: any) {
			self.log('error', `Polling error: ${err.message}`)
		} finally {
			isPolling = false
			self.pollingInterval = setTimeout(poll, self.config.pollingInterval)
		}
	}

	self.debugLog(`Polling started with interval ${self.config.pollingInterval} ms`)
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
	self.debugLog('Updating outlet choices')
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

// --- LINE METER CHOICES (for energy-counter reset) ---

export function UpdateLineMeterChoices(self: SmartPDUInstance): void {
	self.CHOICES_LINES = []

	const lineDescr = self.STATUS.sensor_descr?.find((d) => d.type === 1)
	if (!lineDescr) return

	self.CHOICES_LINES = lineDescr.properties.map((prop) => {
		const parsed = parseSensorPropertyId(prop.id)
		return { id: parsed.sensorNumber, label: `${prop.id} - ${prop.name}` }
	})
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
		const url = buildUrl(self, '/ov.html')

		const outletString = outlet === -1 ? 'all' : String(outlet)
		url.searchParams.set('cmd', '1')
		url.searchParams.set('p', outletString)
		url.searchParams.set('s', String(value))

		await pduFetch(self, url)
	} catch (error: any) {
		self.log('error', `Error setting outlet state for outlet ${outlet}: ${error.message}`)
	}
}

export async function resetOutlet(self: SmartPDUInstance, outlet: number): Promise<void> {
	try {
		const url = buildUrl(self, '/')
		const outletString = outlet === -1 ? 'all' : String(outlet)

		url.searchParams.set('cmd', '12')
		url.searchParams.set('p', outletString)

		await pduFetch(self, url)
	} catch (error: any) {
		self.log('error', `Failed to reset outlet ${outlet}: ${error.message}`)
	}
}

export async function toggleOutlet(self: SmartPDUInstance, outlet: number): Promise<void> {
	if (outlet === -1) {
		self.log('warn', 'Cannot toggle all outlets at once. Use individual outlet toggling instead.')
		return
	}

	const outletState = self.STATUS.outputs?.[outlet - 1]
	if (!outletState) {
		self.log('warn', `Outlet ${outlet} not found in status data`)
		return
	}

	const newState: PowerState = outletState.state ? 'off' : 'on'
	await setOutletState(self, outlet, newState)
}

/**
 * Delayed on/off for a single outlet, using the device's native two-step batch command (cmd=5):
 * switch to `firstState`, wait `delaySeconds`, then switch to the opposite state.
 * This is NOT a multi-outlet primitive — the device has no native multi-outlet stagger.
 * See UpdateActions() for the software-orchestrated sequence across multiple outlets.
 */
export async function delayedOutletSwitch(
	self: SmartPDUInstance,
	outlet: number,
	firstState: 0 | 1,
	delaySeconds: number,
): Promise<void> {
	const url = buildUrl(self, '/')
	url.searchParams.set('cmd', '5')
	url.searchParams.set('p', String(outlet))
	url.searchParams.set('a1', String(firstState))
	url.searchParams.set('a2', String(firstState === 1 ? 0 : 1))
	url.searchParams.set('s', String(delaySeconds))

	await pduFetch(self, url)
}

export async function cancelDelayedSwitch(self: SmartPDUInstance, outlet: number): Promise<void> {
	const url = buildUrl(self, '/')
	url.searchParams.set('cmd', '2')
	url.searchParams.set('p', String(outlet))

	await pduFetch(self, url)
}

// --- STATUS PROCESSING ---

export function processStatusData(self: SmartPDUInstance, data: GudeStatusResponse): void {
	self.STATUS = data

	self.checkVariables()
	self.checkFeedbacks()
}

export function flattenSensorFields(status: GudeStatusResponse): FlatSensorMap {
	if (!status.sensor_descr || !status.sensor_values) return {}

	const result: FlatSensorMap = {}

	for (const descr of status.sensor_descr) {
		const values = status.sensor_values.find((v) => v.type === descr.type)
		if (!values) continue

		for (let sensorIndex = 0; sensorIndex < descr.num; sensorIndex++) {
			const prop = descr.properties[sensorIndex]
			if (!prop) continue

			const parsed = parseSensorPropertyId(prop.id)
			const safeSensorId = parsed.raw.replace(/[^\w]/g, '')
			const fieldValues = values.values[sensorIndex]
			if (!fieldValues) continue

			descr?.fields?.forEach((field, fieldIndex) => {
				const safeFieldName = field.name.replace(/\s+/g, '').replace(/:/g, '').toLowerCase()
				const key = `sensor_${safeSensorId}_${safeFieldName}`

				result[key] = {
					sensorName: sensorDisplayName(parsed),
					id: prop.id,
					safeId: safeSensorId,
					type: descr.type,
					typeName: getSensorTypeLabel(descr.type),
					value: fieldValues[fieldIndex]?.v ?? NaN,
					valueString: fieldValues[fieldIndex]?.v?.toString() ?? '',
					unit: field.unit,
					name: field.name,
					decPrecision: field.decPrecision ?? 0,
				}
			})
		}
	}

	return result
}
