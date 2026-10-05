import { TFolder, Setting, Notice } from 'obsidian'
import { SetColorModal } from '../plugin/SetColorModal'
import type { FolderColorGraphPlugin } from '../plugin/FolderColorGraphPlugin'

export class FolderColorModal extends SetColorModal {
	declare plugin: FolderColorGraphPlugin
	declare file: TFolder
	onOpen() {
		this.titleEl.setText('Set folder color')
		this.contentEl.empty()
		for (const color of this.plugin.settings.palette) {
			new Setting(this.contentEl).setName(color.name).addButton((button) =>
				button.setButtonText('Apply').onClick(() => {
					void this.apply(color.id)
				})
			)
		}
		new Setting(this.contentEl)
			.addButton((b) =>
				b.setButtonText('Remove color').onClick(() => {
					void this.apply(null)
				})
			)
			.addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
	}
	async apply(color: string | null) {
		try {
			await this.plugin.assign(this.file, color)
			this.close()
		} catch {
			new Notice(
				'Could not save folder color. Check that the folder exists and the vault is writable.'
			)
		}
	}
}
