import {
	Menu,
	TAbstractFile,
	TFolder,
	TFile,
	Notice,
	PluginSettingTab,
} from 'obsidian'
import { GraphAdapter } from '../graph/GraphAdapter'
import { FileColorPlugin } from './FileColorPlugin'
import { FolderColorModal } from '../explorer/FolderColorModal'
import { FolderColorSettingsTab } from './FolderColorSettingsTab'
import { assignmentColor } from '../colors/ColorStore'
import { ColorResolver } from '../colors/ColorResolver'
import { migrateSettings, FolderColorGraphSettings } from '../colors/Settings'
import {
	suggestColorForFolder,
	uniquifyFolderColors,
} from '../colors/SuggestedColor'
import {
	readFolderNotesSettings,
	folderNoteOptions,
	indexFolderNotes,
} from '../folder-notes/FolderNoteResolver'

export class FolderColorGraphPlugin extends FileColorPlugin {
	declare settings: FolderColorGraphSettings
	async loadSettings() {
		this.settings = migrateSettings(await this.loadData())
	}
	suggest(path: string) {
		return suggestColorForFolder(
			path,
			this.settings.fileColors.filter(
				(a) => this.app.vault.getAbstractFileByPath(a.path) instanceof TFolder
			),
			this.settings.palette
		)
	}
	readonly resolver = new ColorResolver(new Map())
	private explicitColors = new Map<string, string>()
	private graph?: GraphAdapter
	private loaded = false
	private folderNotesSignature = ''
	private assignmentQueue: Promise<void> = Promise.resolve()
	private saveQueue: Promise<void> = Promise.resolve()

	async onload() {
		this.loaded = true
		await super.onload()
		this.graph = new GraphAdapter(
			(path) => this.resolver.resolveColorForFile(path),
			(path) => {
				const file = this.app.vault.getAbstractFileByPath(path)
				return file instanceof TFile && file.extension === 'md'
			},
			() =>
				new Notice(
					'Folder Color Graph: native graph coloring is unavailable for this view. Explorer colors still work.'
				)
		)
		this.registerEvent(
			this.app.workspace.on('layout-change', () => this.refreshColors())
		)
		this.registerInterval(
			window.setInterval(() => {
				this.syncGraph()
				const signature = JSON.stringify(readFolderNotesSettings(this.app))
				if (signature !== this.folderNotesSignature) {
					this.folderNotesSignature = signature
					this.refreshColors()
				}
			}, 1000)
		)
		const observer = new MutationObserver(() => this.applyColorStyles())
		observer.observe(this.app.workspace.containerEl, {
			childList: true,
			subtree: true,
		})
		this.register(() => observer.disconnect())
		this.registerEvent(this.app.vault.on('create', () => this.refreshColors()))
		this.registerEvent(this.app.vault.on('delete', () => this.refreshColors()))
		this.registerEvent(this.app.vault.on('rename', () => this.refreshColors()))
		this.addCommand({
			id: 'make-folder-colors-unique',
			name: 'Make existing folder colors unique',
			callback: () => {
				void this.makeColorsUnique()
					.then(
						(count) => new Notice(`${count} repeated folder colors replaced.`)
					)
					.catch(() => new Notice('Could not save unique folder colors.'))
			},
		})
		this.refreshColors()
	}

	private syncGraph() {
		this.graph?.sync(
			this.app.workspace,
			this.settings.graphEnabled,
			this.settings.localGraphEnabled,
			this.settings.groupPrecedence === 'native'
		)
	}

	refreshColors() {
		if (!this.loaded) return
		const explicit = new Map<string, string>()
		for (const a of this.settings.fileColors) {
			if (!(this.app.vault.getAbstractFileByPath(a.path) instanceof TFolder))
				continue
			const color = assignmentColor(a.color, this.settings.palette)
			if (color) explicit.set(a.path, color)
		}
		const notes = this.settings.includeFolderNotes
			? indexFolderNotes(
					this.app.vault
						.getAllLoadedFiles()
						.filter((file): file is TFolder => file instanceof TFolder)
						.map((file) => file.path),
					(path) => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
					folderNoteOptions(
						readFolderNotesSettings(this.app),
						this.settings.folderNoteConvention
					)
			  )
			: new Map<string, string>()
		this.explicitColors = explicit
		this.resolver.reset(explicit, notes)
		this.syncGraph()
		this.graph?.refresh()
		this.applyColorStyles()
	}

	async saveSettings() {
		this.refreshColors()
		const snapshot = JSON.parse(JSON.stringify(this.settings))
		const write = this.saveQueue
			.catch(() => undefined)
			.then(() => this.saveData(snapshot))
		this.saveQueue = write
		return write
	}

	protected addColorMenu(menu: Menu, file: TAbstractFile) {
		if (!(file instanceof TFolder)) return
		menu.addItem((item) =>
			item
				.setTitle('Set color')
				.setIcon('palette')
				.onClick(() => new FolderColorModal(this, file).open())
		)
		if (this.settings.automaticSuggestions)
			menu.addItem((item) =>
				item
					.setTitle('Assign suggested color')
					.setIcon('wand')
					.onClick(() => {
						void this.assignSuggested(file).catch(
							() => new Notice('Could not save a unique folder color.')
						)
					})
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

	private enqueueAssignment<T>(work: () => Promise<T>): Promise<T> {
		const operation = this.assignmentQueue.catch(() => undefined).then(work)
		this.assignmentQueue = operation.then(
			() => undefined,
			() => undefined
		)
		return operation
	}

	assign(folder: TFolder, color: string | null): Promise<void> {
		return this.enqueueAssignment(() => this.applyAssignment(folder, color))
	}

	assignSuggested(folder: TFolder): Promise<void> {
		return this.enqueueAssignment(() => {
			const suggestion = this.suggest(folder.path)
			if (!suggestion) throw new Error('No unused RGB colors remain.')
			return this.applyAssignment(folder, suggestion.id)
		})
	}

	makeColorsUnique(): Promise<number> {
		return this.enqueueAssignment(async () => {
			const before = this.settings.fileColors
			const unique = uniquifyFolderColors(
				before,
				this.settings.palette,
				(path) => this.app.vault.getAbstractFileByPath(path) instanceof TFolder
			)
			const changed = unique.filter(
				(a, i) => a.color !== before[i].color
			).length
			if (!changed) return 0
			this.settings.fileColors = unique
			try {
				await this.saveSettings()
			} catch (error) {
				this.settings.fileColors = before
				this.refreshColors()
				throw error
			}
			return changed
		})
	}

	private async applyAssignment(folder: TFolder, color: string | null) {
		if (this.app.vault.getAbstractFileByPath(folder.path) !== folder) {
			throw new Error('The folder no longer exists.')
		}
		if (color && !assignmentColor(color, this.settings.palette))
			throw new Error('Invalid color')
		const before = this.settings.fileColors
		this.settings.fileColors = before.filter((a) => a.path !== folder.path)
		if (color) this.settings.fileColors.push({ path: folder.path, color })
		try {
			await this.saveSettings()
		} catch (error) {
			this.settings.fileColors = before
			this.refreshColors()
			throw error
		}
		this.applyColorStyles()
	}

	generateColorStyles() {
		/* Explorer uses a validated variable on the explicit title. */
	}

	protected styleFileItem(path: string, el: HTMLElement) {
		if (!this.loaded) return
		const title = el.querySelector<HTMLElement>(
			':scope > .nav-folder-title > .nav-folder-title-content'
		)
		if (!title) return
		const color = this.settings.explorerEnabled
			? this.explicitColors.get(path)
			: null
		title.classList.toggle('folder-color-graph-title', !!color)
		if (color) title.style.setProperty('--folder-color-graph-color', color)
		else title.style.removeProperty('--folder-color-graph-color')
	}

	onunload() {
		this.loaded = false
		this.graph?.dispose()
		this.graph = undefined
		this.app.workspace.containerEl
			.querySelectorAll<HTMLElement>('.folder-color-graph-title')
			.forEach((el) => {
				el.classList.remove('folder-color-graph-title')
				el.style.removeProperty('--folder-color-graph-color')
			})
		document.getElementById('folderColorGraphGooberStyles')?.remove()
	}
}
