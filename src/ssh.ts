import { Client } from 'ssh2'
import type { SmartPDUInstance } from './main.js'

/**
 * Runs a single command against the PDU's console (SSH/Telnet CLI) and returns its raw
 * response text. Connects on demand, one command per connection — the console is only
 * needed for the handful of things the HTTP CGI interface can't do (e.g. energy-counter
 * reset), so there's no value in holding a session open.
 */
export async function runConsoleCommand(self: SmartPDUInstance, command: string): Promise<string> {
	if (!self.config.enableSsh) {
		throw new Error('Console (SSH) access is not enabled in module configuration')
	}
	if (!self.config.sshUsername) {
		throw new Error('Console (SSH) username is not configured')
	}

	return new Promise((resolve, reject) => {
		const conn = new Client()
		const timeout = setTimeout(() => {
			conn.end()
			reject(new Error('SSH connection timed out'))
		}, 8000)

		conn
			.on('ready', () => {
				conn.exec(command, (err, stream) => {
					if (err) {
						clearTimeout(timeout)
						conn.end()
						reject(err)
						return
					}

					let output = ''
					stream
						.on('close', () => {
							clearTimeout(timeout)
							conn.end()
							resolve(output.trim())
						})
						.on('data', (data: Buffer) => {
							output += data.toString()
						})
						.stderr.on('data', (data: Buffer) => {
							output += data.toString()
						})
				})
			})
			.on('error', (err) => {
				clearTimeout(timeout)
				reject(err)
			})
			.connect({
				host: self.config.ip,
				port: self.config.sshPort || 22,
				username: self.config.sshUsername,
				password: self.config.sshPassword,
				readyTimeout: 5000,
			})
	})
}

/** Throws if the console response starts with "ERR." (the device's own error convention) */
export function assertConsoleOk(response: string): void {
	if (response.startsWith('ERR.')) {
		throw new Error(`Console command failed: ${response}`)
	}
}
