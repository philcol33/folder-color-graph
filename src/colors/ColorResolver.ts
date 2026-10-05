import { parentPath } from './ColorStore'

export class ColorResolver {
	private cache = new Map<string, string | null>()
	constructor(
		private explicit: ReadonlyMap<string, string>,
		private folderNotes: ReadonlyMap<string, string> = new Map()
	) {}
	reset(
		explicit: ReadonlyMap<string, string>,
		folderNotes: ReadonlyMap<string, string> = new Map()
	) {
		this.explicit = explicit
		this.folderNotes = folderNotes
		this.cache.clear()
	}
	resolveFolder(folder: string): string | null {
		const cached = this.cache.get(folder)
		if (cached !== undefined) return cached
		let path = folder
		while (true) {
			const color = this.explicit.get(path)
			if (color) {
				this.cache.set(folder, color)
				return color
			}
			if (!path) break
			path = parentPath(path)
		}
		this.cache.set(folder, null)
		return null
	}
	resolveColorForFile(path: string): string | null {
		return this.resolveFolder(this.folderNotes.get(path) ?? parentPath(path))
	}
}
