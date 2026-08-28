// Single source of truth for parsing Gude sensor property IDs.
// Gude property ids come in three shapes:
//   "2: 7210 - I1"  -> sensor 2, input 1   (multi-input external probe)
//   "2: 7210"       -> sensor 2            (single-input external probe)
//   "L1"            -> no sensor number    (line/outlet power meters use plain labels)
const WITH_INPUT = /^(\d+):.*?- I(\d+)$/
const WITHOUT_INPUT = /^(\d+):/

export interface ParsedSensorId {
	/** Sensor number when the id follows the "N: ..." convention, otherwise the sanitized raw id */
	sensorNumber: string
	/** Input number when the id follows the "N: ... - I<n>" convention */
	inputNumber?: string
	/** The property id exactly as reported by the device */
	raw: string
}

export function parseSensorPropertyId(id: string): ParsedSensorId {
	const withInput = id.match(WITH_INPUT)
	if (withInput) {
		return { sensorNumber: withInput[1], inputNumber: withInput[2], raw: id }
	}

	const withoutInput = id.match(WITHOUT_INPUT)
	if (withoutInput) {
		return { sensorNumber: withoutInput[1], raw: id }
	}

	return { sensorNumber: id.replace(/[^\w]/g, '_'), raw: id }
}

/** Human-readable form, e.g. "2 Input 1", "2", or the raw id when it has no sensor number */
export function sensorDisplayName(parsed: ParsedSensorId): string {
	if (parsed.inputNumber) return `${parsed.sensorNumber} Input ${parsed.inputNumber}`
	return parsed.sensorNumber
}

/** Safe-for-variable-id form: lowercase, no whitespace/punctuation */
export function normalizeLabel(label: string): string {
	return label.replace(/\s+/g, '_').replace(/[^\w]/g, '').toLowerCase()
}
