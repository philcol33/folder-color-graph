import {
	Menu,
	TAbstractFile,
	TFolder,
	Notice,
	PluginSettingTab,
} from 'obsidian'
import { FileColorPlugin } from './FileColorPlugin'
import { FolderColorModal } from '../explorer/FolderColorModal'
import { FolderColorSettingsTab } from './FolderColorSettingsTab'

export class FolderColorGraphPlugin extends FileColorPlugin {
	protected addColorMenu(menu: Menu, file: TAbstractFile) {
		if (!(file instanceof TFolder)) return
		menu.addItem((item) =>
			item
				.setTitle('Set color')
				.setIcon('palette')
				.onClick(() => new FolderColorModal(this, file).open())
		)
		if (this.settings.fileColors.some((a) => a.path === file.path)) {
			menu.addItem((item) =>
				item
					.setTitle('Remove color')
					.setIcon('x')
					.onClick(() => {
						void this.assign(file, null).catch(
							() => new Notice('Could not save folder color.')
						)
					})
			)
		}
	}

	protected createSettingTab(): PluginSettingTab {
		return new FolderColorSettingsTab(this.app, this)
	}

	async assign(folder: TFolder, color: string | null) {
		if (this.app.vault.getAbstractFileByPath(folder.path) !== folder) {
			throw new Error('The folder no longer exists.')
		}
		const before = this.settings.fileColors
		this.settings.fileColors = before.filter((a) => a.path !== folder.path)
		if (color) this.settings.fileColors.push({ path: folder.path, color })
		try {
			await this.saveSettings(true)
		} catch (error) {
			this.settings.fileColors = before
			throw error
		}
		this.applyColorStyles()
	}

	generateColorStyles() {
		/* Explorer uses a validated variable on the explicit title. */
	}

	protected styleFileItem(path: string, el: HTMLElement) {
		const title = el.querySelector<HTMLElement>(
			':scope > .nav-folder-title > .nav-folder-title-content'
		)
		if (!title) return
		const assignment = this.settings.fileColors.find((a) => a.path === path)
		const color = this.settings.palette.find(
			(c) => c.id === assignment?.color
		)?.value
		title.classList.toggle('folder-color-graph-title', !!color)
		if (color) title.style.setProperty('--folder-color-graph-color', color)
		else title.style.removeProperty('--folder-color-graph-color')
	}

	onunload() {
		this.app.workspace.containerEl
			.querySelectorAll<HTMLElement>('.folder-color-graph-title')
			.forEach((el) => {
				el.classList.remove('folder-color-graph-title')
				el.style.removeProperty('--folder-color-graph-color')
			})
		document.getElementById('folderColorGraphGooberStyles')?.remove()
	}
}
