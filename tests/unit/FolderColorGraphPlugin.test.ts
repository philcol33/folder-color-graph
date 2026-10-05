import { describe, it, expect, vi } from 'vitest'
import { FolderColorGraphPlugin } from '../../src/plugin/FolderColorGraphPlugin'
import { assignmentColor } from '../../src/colors/ColorStore'
import {
	createMockPluginApp,
	createMockFileExplorer,
	TFolder,
	TFile,
} from './mocks/obsidian'

describe('fork lifecycle integration', () => {
	it('keeps concurrent automatic assignments unique beyond the palette and stable on repeat', async () => {
		const app = createMockPluginApp()
		const folders = Array.from(
			{ length: 24 },
			(_, i) => new TFolder(`Folder ${i}`)
		)
		for (const folder of folders) app.files.set(folder.path, folder)
		app.vault.getAbstractFileByPath = (path) => app.files.get(path) ?? null
		app.vault.getAllLoadedFiles = () => folders
		const plugin = new FolderColorGraphPlugin(app)
		await plugin.onload()
		try {
			vi.spyOn(plugin, 'saveData').mockRejectedValueOnce(new Error('disk full'))
			const failed = plugin.assignSuggested(folders[0] as never)
			const rest = folders
				.slice(1)
				.map((folder) => plugin.assignSuggested(folder as never))
			await expect(failed).rejects.toThrow('disk full')
			await Promise.all(rest)
			await plugin.assignSuggested(folders[0] as never)
			const values = plugin.settings.fileColors.map((a) =>
				assignmentColor(a.color, plugin.settings.palette)
			)
			expect(values).not.toContain(null)
			expect(new Set(values).size).toBe(24)
			const before = new Map(
				plugin.settings.fileColors.map((a) => [a.path, a.color])
			)
			await Promise.all(
				folders.map((folder) => plugin.assignSuggested(folder as never))
			)
			expect(
				new Map(plugin.settings.fileColors.map((a) => [a.path, a.color]))
			).toEqual(before)
		} finally {
			plugin.onunload()
			plugin.cleanups.forEach((fn) => fn())
		}
	})
	it('repairs only existing folder duplicates and rolls back if repair cannot save', async () => {
		const app = createMockPluginApp()
		const folders = ['A', 'B', 'C'].map((path) => new TFolder(path))
		for (const folder of folders) app.files.set(folder.path, folder)
		app.files.set('A/legacy.md', new TFile('A/legacy.md'))
		app.vault.getAbstractFileByPath = (path) => app.files.get(path) ?? null
		app.vault.getAllLoadedFiles = () => [...app.files.values()]
		const plugin = new FolderColorGraphPlugin(app)
		await plugin.onload()
		try {
			plugin.settings.fileColors = [
				'A',
				'B',
				'C',
				'A/legacy.md',
				'Missing',
			].map((path) => ({ path, color: 'blue' }))
			const before = structuredClone(plugin.settings.fileColors)
			vi.spyOn(plugin, 'saveData').mockRejectedValueOnce(new Error('disk full'))
			await expect(plugin.makeColorsUnique()).rejects.toThrow('disk full')
			expect(plugin.settings.fileColors).toEqual(before)
			expect(await plugin.makeColorsUnique()).toBe(2)
			expect(plugin.settings.fileColors[0]).toEqual(before[0])
			expect(plugin.settings.fileColors.slice(3)).toEqual(before.slice(3))
			expect(
				new Set(
					plugin.settings.fileColors
						.slice(0, 3)
						.map((a) => assignmentColor(a.color, plugin.settings.palette))
				).size
			).toBe(3)
			expect(await plugin.makeColorsUnique()).toBe(0)
		} finally {
			plugin.onunload()
			plugin.cleanups.forEach((fn) => fn())
		}
	})
	it('persists explicit colors, restricts Explorer text, renames and deletes subtrees', async () => {
		const app = createMockPluginApp()
		const files = app.files
		for (const path of ['A', 'A/Child', 'AB'])
			files.set(path, new TFolder(path))
		for (const path of ['A/N.md', 'A/Child/N.md'])
			files.set(path, new TFile(path))
		app.vault.getAbstractFileByPath = (path) => files.get(path) ?? null
		app.vault.getAllLoadedFiles = () => [...files.values()]
		const explorer = createMockFileExplorer([...files.keys()])
		for (const [path, item] of Object.entries(explorer.view.fileItems)) {
			item.el.innerHTML =
				files.get(path) instanceof TFolder
					? '<div class="nav-folder-title"><span class="collapse-icon"></span><div class="nav-folder-title-content">Folder</div></div>'
					: '<div class="nav-file-title">File</div>'
		}
		app.workspace.fileExplorers.push(explorer)
		const plugin = new FolderColorGraphPlugin(app)
		const save = vi.spyOn(plugin, 'saveData')
		await plugin.onload()
		try {
			const folder = files.get('A') as TFolder
			await plugin.assign(folder as never, 'blue')
			expect(plugin.resolver.resolveColorForFile('A/Child/N.md')).toBe(
				'#4f83cc'
			)
			const title = explorer.view.fileItems.A.el.querySelector(
				'.nav-folder-title-content'
			)!
			expect(title.classList.contains('folder-color-graph-title')).toBe(true)
			expect(
				explorer.view.fileItems['A/Child'].el.querySelector(
					'.nav-folder-title-content'
				)!.className
			).toBe('nav-folder-title-content')
			expect(explorer.view.fileItems['A/N.md'].el.className).toBe('')
			expect(
				explorer.view.fileItems.A.el.querySelector('.collapse-icon')!.className
			).toBe('collapse-icon')
			await plugin.assign(files.get('A/Child') as never, 'orange')
			expect(plugin.resolver.resolveColorForFile('A/Child/N.md')).toBe(
				'#ca8135'
			)
			await plugin.assign(files.get('A/Child') as never, null)
			expect(plugin.resolver.resolveColorForFile('A/Child/N.md')).toBe(
				'#4f83cc'
			)
			await plugin.assign(files.get('A/Child') as never, 'orange')
			for (const [path, file] of [...files])
				if (path === 'A' || path.startsWith('A/')) {
					files.delete(path)
					file.path = 'Archive/' + path
					files.set(file.path, file)
				}
			await app.vault.emit('rename', folder, 'A')
			expect(plugin.settings.fileColors.map((a) => a.path)).toEqual([
				'Archive/A',
				'Archive/A/Child',
			])
			expect(plugin.resolver.resolveColorForFile('Archive/A/Child/N.md')).toBe(
				'#ca8135'
			)
			await plugin.assign(files.get('AB') as never, 'green')
			await app.vault.emit('delete', folder)
			expect(plugin.settings.fileColors.map((a) => a.path)).toEqual(['AB'])
			expect(save).toHaveBeenCalled()
		} finally {
			plugin.onunload()
			plugin.cleanups.forEach((fn) => fn())
		}
		expect(
			explorer.view.fileItems.A.el.querySelector('.folder-color-graph-title')
		).toBeNull()
	})
	it('rolls back a failed save and does not color deleted folders', async () => {
		const app = createMockPluginApp(),
			folder = new TFolder('A')
		app.vault.getAbstractFileByPath = (path) => (path === 'A' ? folder : null)
		app.vault.getAllLoadedFiles = () => [folder]
		const plugin = new FolderColorGraphPlugin(app)
		await plugin.onload()
		try {
			vi.spyOn(plugin, 'saveData').mockRejectedValueOnce(new Error('disk full'))
			await expect(plugin.assign(folder as never, 'blue')).rejects.toThrow(
				'disk full'
			)
			expect(plugin.settings.fileColors).toEqual([])
			expect(plugin.resolver.resolveColorForFile('A/N.md')).toBeNull()
			await plugin.assign(folder as never, 'orange')
			app.vault.getAbstractFileByPath = () => null
			await expect(plugin.assign(folder as never, 'blue')).rejects.toThrow(
				'no longer exists'
			)
		} finally {
			plugin.onunload()
			plugin.cleanups.forEach((fn) => fn())
		}
	})
	it('serializes assignments so a failed write cannot discard a later assignment', async () => {
		const app = createMockPluginApp(),
			a = new TFolder('A'),
			b = new TFolder('B')
		app.vault.getAbstractFileByPath = (path) =>
			path === 'A' ? a : path === 'B' ? b : null
		app.vault.getAllLoadedFiles = () => [a, b]
		const plugin = new FolderColorGraphPlugin(app)
		await plugin.onload()
		try {
			vi.spyOn(plugin, 'saveData').mockRejectedValueOnce(new Error('disk full'))
			const first = plugin.assign(a as never, 'blue')
			const second = plugin.assign(b as never, 'orange')
			await expect(first).rejects.toThrow('disk full')
			await second
			expect(plugin.settings.fileColors).toEqual([
				{ path: 'B', color: 'orange' },
			])
		} finally {
			plugin.onunload()
			plugin.cleanups.forEach((fn) => fn())
		}
	})
})
