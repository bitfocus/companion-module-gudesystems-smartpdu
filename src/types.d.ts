export type PowerState = 'on' | 'off' | 'toggle' | 'reset'

export interface GudePDUOptions {
	ip: string
	username?: string
	password?: string
	port?: number
}

export interface FlatSensorField {
	sensorName: string
	id: string
	safeId: string
	type: number
	typeName: string
	value: number
	valueString: string
	unit: string
	name: string
	decPrecision: number
}

export type FlatSensorMap = Record<string, FlatSensorField>

export interface GudeOutput {
	name: string
	state: number
	ph_state: number
	twin: number
	sw_cnt: number
	type: number
	batch: any[]
	wdog: any[]
}

export interface GudeSensorField {
	name: string
	unit: string
	decPrecision: number
}

export interface GudeSensorProperty {
	id: string
	name: string
}

export interface GudeSensorDescr {
	type: number
	num: number
	fields?: GudeSensorField[]
	properties: GudeSensorProperty[]
	groups?: any[]
	options?: any
}

export interface GudeSensorValue {
	type: number
	num: number
	values: { v: number }[][]
	index?: number
	options?: any
}

export interface GudeDeviceInfo {
	product_name: string
	vendor_name: string
	prodid: string
	hostname: string
	firm_v: string
	uptime: number
	build: number
	cpuid: number
	chipid: string[]
}

export interface GudeClock {
	running: number
	unixts: number
	systemtime: {
		hour: number
		minute: number
		second: number
		day: number
		month: number
		year: number
		dow: number
	}
	localtime: {
		hour: number
		minute: number
		second: number
		day: number
		month: number
		year: number
		dow: number
	}
}

export interface GudeStatusResponse {
	outputs: GudeOutput[]
	sensor_descr?: GudeSensorDescr[]
	sensor_values?: GudeSensorValue[]
	misc?: GudeDeviceInfo
	clock?: GudeClock
	port_summary?: {
		num_outputs: number
		num_inputs: number
		num_sensors: number
	}
	ethernet?: {
		oct_in: number
		oct_out: number
		mac: string
	}
	ip4?: {
		ipcfg: [number, string]
		max_sock_cnt: number
	}
	events?: {
		events_count: number
		mails_count: number
		syslog_count: number
		traps_count: number
		overflow: number
	}
	http?: Array<{
		taskId: number
		time: number
		locked: number
		free: number
		keep_alive: number
	}>
	dns_state?: any
	hardware?: any
	diagnostic?: any
	fileupload?: any
	mqtt?: any
}

export interface GudeFullStatus {
	outputs: GudeFullStatus_OutputsItem[]
	sensor_descr: GudeFullStatus_Sensor_descrItem[]
	sensor_values: GudeFullStatus_Sensor_valuesItem[]
	misc: GudeFullStatus_Misc
	clock: GudeFullStatus_Clock
}

export interface GudeFullStatus_OutputsItem {
	name: string
	state: number
	ph_state: number
	twin: number
	sw_cnt: number
	type: number
	batch: any[]
	wdog: any[]
}

export interface GudeFullStatus_Sensor_descrItem {
	type: number
	num: number
	options: GudeFullStatus_Sensor_descrItem_Options
	fields: GudeFullStatus_Sensor_descrItem_FieldsItem[]
	properties: GudeFullStatus_Sensor_descrItem_PropertiesItem[]
}

export interface GudeFullStatus_Sensor_descrItem_Options {}

export interface GudeFullStatus_Sensor_descrItem_FieldsItem {
	name: string
	unit: string
	decPrecision: number
}

export interface GudeFullStatus_Sensor_descrItem_PropertiesItem {
	id: string
	name: string
}

export interface GudeFullStatus_Sensor_valuesItem {
	type: number
	num: number
	index: number
	options: GudeFullStatus_Sensor_valuesItem_Options
	values: object[][] // Consider replacing with more specific shape
}

export interface GudeFullStatus_Sensor_valuesItem_Options {}

export interface GudeFullStatus_Misc {
	product_name: string
	vendor_name: string
	prodid: string
	hostname: string
	firm_v: string
	uptime: number
	build: number
	cpuid: number
	chipid: string[]
}

export interface GudeFullStatus_Clock {
	running: number
	unixts: number
	systemtime: GudeFullStatus_Clock_Systemtime
	localtime: GudeFullStatus_Clock_Localtime
}

export interface GudeFullStatus_Clock_Systemtime {
	hour: number
	minute: number
	second: number
	day: number
	month: number
	year: number
	dow: number
}

export interface GudeFullStatus_Clock_Localtime {
	hour: number
	minute: number
	second: number
	day: number
	month: number
	year: number
	dow: number
}
