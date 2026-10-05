import { isWithin, parentPath } from '../colors/ColorStore'

export type FolderNoteOptions = {
	location: 'inside' | 'outside' | 'auto'
	template: string
	excluded: { path: string; descendants: boolean }[]
	supported: boolean
}
export const fallbackOptions: FolderNoteOptions = {
	location: 'auto',
	template: '{{folder_name}}',
	excluded: [],
	supported: true,
}

/** Read only interop metadata; no dependency on or code from Folder Notes. */
export function folderNoteOptions(
	settings: unknown,
	fallback: FolderNoteOptions['location']
): FolderNoteOptions {
	if (!settings || typeof settings !== 'object')
		return { ...fallbackOptions, location: fallback }
	const data = settings as Record<string, unknown>
	const excluded: FolderNoteOptions['excluded'] = []
	if (Array.isArray(data.excludeFolders))
		for (const raw of data.excludeFolders as unknown[]) {
			if (!raw || typeof raw !== 'object') continue
			const e = raw as Record<string, unknown>
			if (
				typeof e.path === 'string' &&
				(e.disableFolderNote === true || e.detached === true)
			)
				excluded.push({ path: e.path, descendants: e.subFolders === true })
		}
	return {
		location: data.storageLocation === 'parentFolder' ? 'outside' : 'inside',
		template:
			typeof data.folderNoteName === 'string'
				? data.folderNoteName
				: '{{folder_name}}',
		excluded,
		supported:
			(data.storageLocation === undefined ||
				data.storageLocation === 'insideFolder' ||
				data.storageLocation === 'parentFolder') &&
			(data.folderNoteType === undefined ||
				data.folderNoteType === '.md' ||
				data.folderNoteType === 'md'),
	}
}

export function resolveFolderNoteForFolder(
	folder: string,
	hasMarkdown: (path: string) => boolean,
	options = fallbackOptions
): string | null {
	if (
		!folder ||
		!options.supported ||
		options.excluded.some((e) =>
			e.descendants ? isWithin(folder, e.path) : folder === e.path
		)
	)
		return null
	const name = options.template.replace(
		'{{folder_name}}',
		folder.split('/').pop() ?? ''
	)
	// A basename template, never a filesystem traversal or nested path.
	if (
		!name ||
		name.includes('/') ||
		name.includes('\\') ||
		name === '.' ||
		name === '..'
	)
		return null
	const note = name + '.md'
	const inside = folder + '/' + note
	const parent = parentPath(folder)
	const outside = (parent ? parent + '/' : '') + note
	if (options.location !== 'outside' && hasMarkdown(inside)) return inside
	if (options.location !== 'inside' && hasMarkdown(outside)) return outside
	return null
}

export function indexFolderNotes(
	folders: string[],
	hasMarkdown: (path: string) => boolean,
	options: FolderNoteOptions
): Map<string, string> {
	const result = new Map<string, string>()
	const ambiguous = new Set<string>()
	for (const folder of folders) {
		const note = resolveFolderNoteForFolder(folder, hasMarkdown, options)
		if (!note || ambiguous.has(note)) continue
		if (result.has(note)) {
			result.delete(note)
			ambiguous.add(note)
		} else result.set(note, folder)
	}
	return result
}

/** Private plugin registry access is confined here and guarded. */
export function readFolderNotesSettings(app: unknown): unknown {
	try {
		const plugins = (
			app as { plugins?: { getPlugin?: (id: string) => unknown } }
		).plugins
		const plugin = plugins?.getPlugin?.('folder-notes')
		return plugin && typeof plugin === 'object'
			? (plugin as { settings?: unknown }).settings
			: undefined
	} catch {
		return undefined
	}
}
