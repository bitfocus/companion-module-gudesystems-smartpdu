import { Regex } from '@companion-module/base'
import type { SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	ip: string
	useHttps: boolean
	port: number
	allowSelfSigned: boolean
	useAuthentication: boolean
	username: string
	password: string
	enablePolling: boolean
	pollingInterval: number
	enableSsh: boolean
	sshPort: number
	sshUsername: string
	sshPassword: string
	verbose: boolean
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module is for controlling Smart PDUs by Gude Systems',
		},
		{
			type: 'textinput',
			id: 'ip',
			label: 'PDU IP Address',
			width: 6,
			regex: Regex.IP,
		},
		{
			type: 'checkbox',
			id: 'useHttps',
			label: 'Use HTTPS',
			width: 3,
			default: false,
		},
		{
			type: 'number',
			id: 'port',
			label: 'HTTP(S) Port',
			width: 3,
			default: 0,
			min: 0,
			max: 65535,
			tooltip: '0 = use the default port for the selected protocol (80 for HTTP, 443 for HTTPS)',
		},
		{
			type: 'checkbox',
			id: 'allowSelfSigned',
			label: 'Allow Self-Signed Certificate',
			width: 6,
			default: true,
			isVisible: (config) => config.useHttps == true,
			tooltip: 'Gude PDUs ship with a self-signed certificate by default',
		},
		{
			type: 'checkbox',
			id: 'useAuthentication',
			label: 'Use Authentication',
			width: 6,
			default: true,
		},
		{
			type: 'textinput',
			id: 'username',
			label: 'Username',
			width: 6,
			default: 'admin',
			isVisible: (config) => config.useAuthentication == true,
		},
		{
			type: 'textinput',
			id: 'password',
			label: 'Password',
			width: 6,
			default: 'admin',
			isVisible: (config) => config.useAuthentication == true,
		},
		{
			type: 'static-text',
			id: 'hr1',
			width: 12,
			label: ' ',
			value: '<hr />',
		},
		{
			type: 'checkbox',
			id: 'enablePolling',
			label: 'Enable Polling',
			width: 6,
			default: true,
		},
		{
			type: 'number',
			id: 'pollingInterval',
			label: 'Polling Interval (milliseconds)',
			width: 6,
			default: 1000,
			min: 100,
			max: 10000,
		},
		{
			type: 'static-text',
			id: 'hr2',
			width: 12,
			label: ' ',
			value: '<hr />',
		},
		{
			type: 'static-text',
			id: 'info3',
			width: 12,
			label: 'Console (SSH)',
			value:
				'Only needed for the Reset Energy Counter action — the PDU console has its own separate login, not the HTTP credentials above. Enable SSH on the PDU under Configuration → Protocols → Console.',
		},
		{
			type: 'checkbox',
			id: 'enableSsh',
			label: 'Enable Console (SSH) Access',
			width: 6,
			default: false,
		},
		{
			type: 'number',
			id: 'sshPort',
			label: 'SSH Port',
			width: 6,
			default: 22,
			min: 1,
			max: 65535,
			isVisible: (config) => config.enableSsh == true,
		},
		{
			type: 'textinput',
			id: 'sshUsername',
			label: 'Console Username',
			width: 6,
			isVisible: (config) => config.enableSsh == true,
		},
		{
			type: 'textinput',
			id: 'sshPassword',
			label: 'Console Password',
			width: 6,
			isVisible: (config) => config.enableSsh == true,
		},
		{
			type: 'static-text',
			id: 'hr3',
			width: 12,
			label: ' ',
			value: '<hr />',
		},
		{
			type: 'static-text',
			id: 'info2',
			label: 'Verbose Logging',
			width: 12,
			value: 'Enabling this option will put more detail in the log, which can be useful for troubleshooting purposes.',
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Enable Verbose Logging',
			default: false,
			width: 12,
		},
	]
}
