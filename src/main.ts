import './polyfill.js'
import { InstanceBase, runEntrypoint, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { CheckVariables, UpdateVariableDefinitions } from './variables.js'
import { InitConnection, RefreshStatus } from './api.js'
import { UpdatePresets } from './presets.js'
import { GudeStatusResponse } from './types.js'

export class SmartPDUInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()
	authHeader: Record<string, string> = {} // Authentication header for API requests
	pollingInterval!: NodeJS.Timeout // Polling interval for status updates
	CHOICES_OUTLETS: { id: number; label: string }[] = [] // Choices for outlets
	CHOICES_OUTLETS_ALL: { id: number; label: string }[] = [] // Choices for outlets including "All Outlets"
	CHOICES_LINES: { id: string; label: string }[] = [] // Choices for line power meters (energy counter reset)
	STATUS: GudeStatusResponse = {} as GudeStatusResponse // Status data from the PDU

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
		this.updatePresets() // export presets

		await InitConnection(this) // Initialize connection
	}

	/** Debug-level log, shown only when "Enable Verbose Logging" is on in module config */
	debugLog(message: string): void {
		if (this.config.verbose) this.log('debug', message)
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config

		await InitConnection(this)
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	checkVariables(): void {
		CheckVariables(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	async refreshStatus(): Promise<void> {
		await RefreshStatus(this)
	}
}

runEntrypoint(SmartPDUInstance, UpgradeScripts)
