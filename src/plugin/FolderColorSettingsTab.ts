import { App, PluginSettingTab, Setting, Notice } from 'obsidian'
import { nanoid } from 'nanoid'
import type { FolderColorGraphPlugin } from './FolderColorGraphPlugin'
import type { FolderColorGraphSettings } from '../colors/Settings'
import { assignmentColor, parseColor } from '../colors/ColorStore'
import { defaultPalette } from '../colors/palette'

export class FolderColorSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: FolderColorGraphPlugin) {
		super(app, plugin)
	}

	private async change(mutate: () => void, redraw = false) {
		const before: FolderColorGraphSettings = JSON.parse(
			JSON.stringify(this.plugin.settings)
		)
		mutate()
		try {
			await this.plugin.saveSettings()
			if (redraw) this.display()
		} catch {
			this.plugin.settings = before
			this.plugin.refreshColors()
			new Notice('Could not save Folder Color Graph settings.')
			this.display()
		}
	}
	/** Preserve the visible assignment before deleting/resetting its palette ID. */
	private detachColors(ids: Set<string>) {
		this.plugin.settings.fileColors = this.plugin.settings.fileColors.map(
			(a) => ({
				...a,
				color: ids.has(a.color)
					? assignmentColor(a.color, this.plugin.settings.palette) ?? a.color
					: a.color,
			})
		)
	}

	display() {
		const el = this.containerEl,
			settings = this.plugin.settings
		el.empty()
		el.createEl('h2', { text: 'Folder Color Graph' })
		el.createEl('p', {
			text: 'Folder title colors in the Explorer; inherited note colors in native Graph View.',
		})
		const toggle = (
			name: string,
			key:
				| 'graphEnabled'
				| 'localGraphEnabled'
				| 'includeFolderNotes'
				| 'automaticSuggestions'
				| 'preferUnused'
				| 'explorerEnabled',
			description: string
		) => {
			new Setting(el)
				.setName(name)
				.setDesc(description)
				.addToggle((t) =>
					t.setValue(settings[key]).onChange((value) => {
						void this.change(() => {
							settings[key] = value
						})
					})
				)
		}
		el.createEl('h3', { text: 'Graph View' })
		toggle(
			'Apply colors to Global Graph',
			'graphEnabled',
			'Updates open graph views live.'
		)
		toggle(
			'Apply colors to Local Graph',
			'localGraphEnabled',
			'Uses the same guarded native graph adapter.'
		)
		toggle(
			'Include folder notes',
			'includeFolderNotes',
			'Recognize corresponding notes, including notes stored outside folders.'
		)
		new Setting(el)
			.setName('Color precedence')
			.setDesc('Native graph groups are always preserved.')
			.addDropdown((d) =>
				d
					.addOption('folder', 'Prefer folder colors')
					.addOption('native', 'Prefer existing graph groups')
					.setValue(settings.groupPrecedence)
					.onChange((value) => {
						void this.change(() => {
							settings.groupPrecedence =
								value === 'native' ? 'native' : 'folder'
						})
					})
			)
		new Setting(el)
			.setName('Folder note fallback')
			.setDesc(
				'Used when Folder Notes is unavailable. Enabled Folder Notes naming settings take precedence.'
			)
			.addDropdown((d) =>
				d
					.addOption('auto', 'Inside, then outside')
					.addOption('inside', 'Inside only')
					.addOption('outside', 'Outside only')
					.setValue(settings.folderNoteConvention)
					.onChange((value) => {
						void this.change(() => {
							settings.folderNoteConvention =
								value === 'inside' || value === 'outside' ? value : 'auto'
						})
					})
			)
		el.createEl('h3', { text: 'Suggestions' })
		toggle(
			'Automatic color suggestions',
			'automaticSuggestions',
			'Preselect a stable suggestion when coloring a new folder.'
		)
		el.createEl('p', {
			text: 'Automatic suggestions always use a color unique to its folder. When presets run out, a new color is generated.',
		})
		new Setting(el)
			.setName('Remove repeated folder colors')
			.setDesc(
				'Keep the first use of each color and give repeated assignments new unique colors.'
			)
			.addButton((b) =>
				b.setButtonText('Make colors unique').onClick(() => {
					void this.plugin
						.makeColorsUnique()
						.then(
							(count) => new Notice(`${count} repeated folder colors replaced.`)
						)
						.catch(() => new Notice('Could not save unique folder colors.'))
				})
			)
		el.createEl('h3', { text: 'File Explorer' })
		toggle(
			'Color folder text',
			'explorerEnabled',
			'Only explicitly colored folder titles change.'
		)
		el.createEl('h3', { text: 'Palette' })
		el.createEl('p', {
			text: 'Palette edits update assigned colors live. Removing a swatch preserves existing assignments as custom colors.',
		})
		settings.palette.forEach((color, index) => {
			new Setting(el)
				.setName(color.name || 'Unnamed color')
				.addText((t) =>
					t
						.setPlaceholder('Color name')
						.setValue(color.name)
						.onChange((value) => {
							void this.change(() => {
								color.name = value
							})
						})
				)
				.addColorPicker((p) =>
					p.setValue(parseColor(color.value) ?? '#4f83cc').onChange((value) => {
						void this.change(() => {
							color.value = value
						})
					})
				)
				.addButton((b) =>
					b
						.setIcon('arrow-up')
						.setTooltip('Move up')
						.setDisabled(index === 0)
						.onClick(() => {
							void this.change(() => {
								;[settings.palette[index - 1], settings.palette[index]] = [
									settings.palette[index],
									settings.palette[index - 1],
								]
							}, true)
						})
				)
				.addButton((b) =>
					b
						.setIcon('arrow-down')
						.setTooltip('Move down')
						.setDisabled(index === settings.palette.length - 1)
						.onClick(() => {
							void this.change(() => {
								;[settings.palette[index + 1], settings.palette[index]] = [
									settings.palette[index],
									settings.palette[index + 1],
								]
							}, true)
						})
				)
				.addButton((b) =>
					b
						.setIcon('trash')
						.setTooltip('Remove palette color')
						.onClick(() => {
							void this.change(() => {
								this.detachColors(new Set([color.id]))
								settings.palette.splice(index, 1)
							}, true)
						})
				)
		})
		new Setting(el)
			.addButton((b) =>
				b.setButtonText('Add color').onClick(() => {
					void this.change(() => {
						settings.palette.push({
							id: nanoid(),
							name: 'New color',
							value: '#4f83cc',
						})
					}, true)
				})
			)
			.addButton((b) =>
				b.setButtonText('Reset palette').onClick(() => {
					void this.change(() => {
						this.detachColors(new Set(settings.palette.map((c) => c.id)))
						settings.palette = defaultPalette.map((c) => ({ ...c }))
					}, true)
				})
			)
		el.createEl('p', {
			text: 'Based on File Color by ecustic. Native graph access is private and may require updates after Obsidian upgrades.',
		})
	}
}
