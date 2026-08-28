// Companion's bundled Node runtime (observed: v18.20.8 on Windows) does not expose
// `File` as a global, but the standalone `undici` package (used here for HTTPS
// self-signed-certificate support) references the global `File` constructor at
// module-load time, in its WebIDL type converters. Without this, requiring `undici`
// throws `ReferenceError: File is not defined` before any module code runs.
//
// This must be imported first, before anything that transitively imports `undici`
// (i.e. before `./api.js`), so the global is in place before that module loads.
import { File } from 'node:buffer'

if (typeof globalThis.File === 'undefined') {
	;(globalThis as any).File = File
}
