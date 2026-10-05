import { App, PluginSettingTab, Setting } from 'obsidian'
import type { FolderColorGraphPlugin } from './FolderColorGraphPlugin'

export class FolderColorSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: FolderColorGraphPlugin) {
		super(app, plugin)
	}
	display() {
		this.containerEl.empty()
		this.containerEl.createEl('h2', { text: 'Folder Color Graph' })
		for (const color of this.plugin.settings.palette) {
			new Setting(this.containerEl).setName(color.name).addColorPicker((p) =>
				p.setValue(color.value).onChange(async (value) => {
					color.value = value
					await this.plugin.saveSettings(true)
					this.plugin.applyColorStyles()
				})
			)
		}
	}
}
