// Companion's bundled Node runtime (observed: v18.20.8 on Windows) is missing a few
// JS runtime features that the standalone `undici` package (used here for HTTPS
// self-signed-certificate support) assumes are present. Without these, `undici`
// either fails to load, or throws when its WebIDL layer converts fetch() arguments.
//
// This must be imported first, before anything that transitively imports `undici`
// (i.e. before `./api.js`), so these are all in place before that module loads.
import { File } from 'node:buffer'

if (typeof globalThis.File === 'undefined') {
	;(globalThis as any).File = File
}

// String.prototype.isWellFormed / toWellFormed (ES2024) — added in Node 20, missing
// on Node 18. A "well-formed" string has no lone (unpaired) UTF-16 surrogates.
function isWellFormedString(str: string): boolean {
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i)
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = str.charCodeAt(i + 1)
			if (next >= 0xdc00 && next <= 0xdfff) {
				i++
				continue
			}
			return false
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			return false
		}
	}
	return true
}

function toWellFormedString(str: string): string {
	let result = ''
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i)
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = str.charCodeAt(i + 1)
			if (next >= 0xdc00 && next <= 0xdfff) {
				result += str[i] + str[i + 1]
				i++
				continue
			}
			result += '�'
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			result += '�'
		} else {
			result += str[i]
		}
	}
	return result
}

declare global {
	interface String {
		isWellFormed?(): boolean
		toWellFormed?(): string
	}
}

if (typeof String.prototype.isWellFormed !== 'function') {
	// eslint-disable-next-line no-extend-native
	String.prototype.isWellFormed = function (this: string) {
		return isWellFormedString(String(this))
	}
}

if (typeof String.prototype.toWellFormed !== 'function') {
	// eslint-disable-next-line no-extend-native
	String.prototype.toWellFormed = function (this: string) {
		return toWellFormedString(String(this))
	}
}

export {}
