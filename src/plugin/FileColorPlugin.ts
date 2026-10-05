import {
	debounce,
	Menu,
	MenuItem,
	Plugin,
	PluginSettingTab,
	TAbstractFile,
} from 'obsidian'
import { SetColorModal } from 'plugin/SetColorModal'
import { FileColorSettingTab } from 'plugin/FileColorSettingTab'

import type { FileColorPluginSettings } from 'settings'
import { defaultSettings } from 'settings'
import { renameAssignments, deleteAssignments } from '../colors/ColorStore'

export class FileColorPlugin extends Plugin {
	settings: FileColorPluginSettings = defaultSettings
	saveSettingsInternalDebounced = debounce(
		this.saveSettingsInternal,
		3000,
		true
	)

	async onload() {
		await this.loadSettings()

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				this.addColorMenu(menu, file)
			})
		)

		this.app.workspace.onLayoutReady(async () => {
			this.generateColorStyles()
			this.applyColorStyles()
		})

		this.registerEvent(
			this.app.workspace.on('layout-change', () => this.applyColorStyles())
		)

		this.registerEvent(
			this.app.vault.on('rename', async (newFile, oldPath) => {
				this.settings.fileColors = renameAssignments(
					this.settings.fileColors,
					oldPath,
					newFile.path
				)
				void this.saveSettings().catch(() =>
					console.warn('Folder color settings could not be saved.')
				)
				this.applyColorStyles()
			})
		)

		this.registerEvent(
			this.app.vault.on('delete', async (file) => {
				this.settings.fileColors = deleteAssignments(
					this.settings.fileColors,
					file.path
				)
				void this.saveSettings().catch(() =>
					console.warn('Folder color settings could not be saved.')
				)
			})
		)

		this.addSettingTab(this.createSettingTab())
	}

	protected addColorMenu(menu: Menu, file: TAbstractFile) {
		menu.addItem((item: MenuItem) =>
			item
				.setTitle('Set color')
				.setIcon('palette')
				.onClick(() => new SetColorModal(this, file).open())
		)
	}

	protected createSettingTab(): PluginSettingTab {
		return new FileColorSettingTab(this.app, this)
	}

	protected styleFileItem(path: string, el: HTMLElement) {
		const itemClasses = el.classList.value
			.split(' ')
			.filter((cls) => !cls.startsWith('file-color'))
		const file = this.settings.fileColors.find((file) => file.path === path)
		if (file) {
			itemClasses.push(
				'file-color-file',
				'file-color-color-' + file.color,
				'file-color-type-' +
					(this.settings.colorBackground ? 'background' : 'text')
			)
			if (this.settings.cascadeColors) itemClasses.push('file-color-cascade')
		}
		el.classList.value = itemClasses.join(' ')
	}

	onunload() {
		document.getElementById('fileColorPluginStyles')?.remove()
		document.getElementById('fileColorPluginGooberStyles')?.remove()
	}

	async loadSettings() {
		this.settings = Object.assign({}, defaultSettings, await this.loadData())
	}

	async saveSettings(immediate?: boolean) {
		if (immediate) {
			return this.saveSettingsInternal()
		}
		return this.saveSettingsInternalDebounced()
	}

	private saveSettingsInternal() {
		return this.saveData(this.settings)
	}

	generateColorStyles() {
		let colorStyleEl = document.getElementById('fileColorPluginStyles')

		if (!colorStyleEl) {
			colorStyleEl = this.app.workspace.containerEl.createEl('style')
			colorStyleEl.id = 'fileColorPluginStyles'
		}

		colorStyleEl.innerHTML = this.settings.palette
			.map(
				(color) =>
					`.file-color-color-${color.id} { --file-color-color: ${color.value}; }`
			)
			.join('\n')
	}
	applyColorStyles = debounce(this.applyColorStylesInternal, 50, true)

	private applyColorStylesInternal() {
		const fileExplorers = this.app.workspace.getLeavesOfType('file-explorer')
		fileExplorers.forEach((fileExplorer) => {
			Object.entries(fileExplorer.view.fileItems ?? {}).forEach(
				([path, fileItem]) => {
					if (fileItem?.el instanceof HTMLElement) this.styleFileItem(path, fileItem.el)
				}
			)
		})
	}
}
