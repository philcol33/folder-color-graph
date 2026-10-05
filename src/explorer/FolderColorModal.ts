import { TFolder, Setting, Notice } from 'obsidian'
import { SetColorModal } from '../plugin/SetColorModal'
import type { FolderColorGraphPlugin } from '../plugin/FolderColorGraphPlugin'
import { assignmentColor, parseColor } from '../colors/ColorStore'

export class FolderColorModal extends SetColorModal {
	declare plugin: FolderColorGraphPlugin
	declare file: TFolder
	onOpen() {
		this.titleEl.setText('Set folder color')
		this.contentEl.empty()
		this.contentEl.createEl('p', { text: this.file.path })
		const current = this.plugin.settings.fileColors.find(
			(a) => a.path === this.file.path
		)?.color
		const suggested = this.plugin.settings.automaticSuggestions
			? this.plugin.suggest(this.file.path)
			: null
		let selected = current ?? suggested?.id ?? ''
		let acceptSuggestion = !current && !!suggested
		const summary = this.contentEl.createEl('p', {
			cls: 'folder-color-graph-selection',
		})
		const describeSelection = () => {
			const preset = this.plugin.settings.palette.find((c) => c.id === selected)
			summary.setText(
				`${
					!current && selected === suggested?.id ? 'Suggested: ' : 'Selected: '
				}${
					preset?.name ??
					(selected === suggested?.id
						? suggested.name
						: selected || 'Choose a color')
				}`
			)
		}
		describeSelection()
		const grid = this.contentEl.createDiv({ cls: 'folder-color-graph-palette' })
		grid.setAttribute('role', 'group')
		grid.setAttribute('aria-label', 'Palette')
		const choices: { id: string; button: HTMLButtonElement }[] = []
		for (const color of this.plugin.settings.palette) {
			const hex = parseColor(color.value)
			if (!hex) continue
			const button = grid.createEl('button', { text: color.name })
			button.setAttribute('aria-label', `${color.name} ${hex}`)
			button.style.setProperty('--swatch-color', hex)
			button.classList.add('folder-color-graph-swatch')
			choices.push({ id: color.id, button })
			button.onclick = () => {
				acceptSuggestion = false
				selected = color.id
				update()
			}
		}
		let customPicker: import('obsidian').ColorComponent | undefined
		const update = () => {
			customPicker?.setValue(
				assignmentColor(selected, this.plugin.settings.palette) ?? '#4f83cc'
			)
			choices.forEach((c) =>
				c.button.setAttribute('aria-pressed', String(c.id === selected))
			)
			describeSelection()
			apply.buttonEl.disabled = !assignmentColor(
				selected,
				this.plugin.settings.palette
			)
		}
		new Setting(this.contentEl)
			.setName('Custom color')
			.addColorPicker((picker) => {
				customPicker = picker
				picker
					.setValue(
						assignmentColor(selected, this.plugin.settings.palette) ?? '#4f83cc'
					)
					.onChange((value) => {
						acceptSuggestion = false
						selected = value
						update()
					})
			})
		let pending = false
		const commit = async (color: string | null) => {
			if (pending) return
			pending = true
			apply.setDisabled(true)
			try {
				if (acceptSuggestion && color !== null)
					await this.plugin.assignSuggested(this.file)
				else await this.plugin.assign(this.file, color)
				this.close()
			} catch {
				new Notice(
					'Could not save folder color. Check that the folder exists and the vault is writable.'
				)
				pending = false
				update()
			}
		}
		let apply!: import('obsidian').ButtonComponent
		new Setting(this.contentEl)
			.addButton((b) =>
				b
					.setButtonText('Remove color')
					.setDisabled(!current)
					.onClick(() => {
						void commit(null)
					})
			)
			.addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((b) => {
				apply = b
				b.setButtonText('Apply')
					.setCta()
					.onClick(() => {
						void commit(selected)
					})
			})
		update()
		apply.buttonEl.focus()
	}
}
