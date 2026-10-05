import type { FileColorPluginSettings } from '../settings'
import { parseColor } from './ColorStore'
import { defaultPalette } from './palette'

export type FolderColorGraphSettings = FileColorPluginSettings & {
	schemaVersion: number
	graphEnabled: boolean
	localGraphEnabled: boolean
	includeFolderNotes: boolean
	automaticSuggestions: boolean
	preferUnused: boolean
	explorerEnabled: boolean
	groupPrecedence: 'folder' | 'native'
	folderNoteConvention: 'auto' | 'inside' | 'outside'
}

export function migrateSettings(raw: unknown): FolderColorGraphSettings {
	const data =
		raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
	const palette = Array.isArray(data.palette)
		? data.palette
				.filter(
					(c) => c && typeof c.id === 'string' && typeof c.name === 'string'
				)
				.map((c) => ({ ...c, value: parseColor(c.value) ?? c.value }))
		: defaultPalette.map((c) => ({ ...c }))
	const fileColors = Array.isArray(data.fileColors)
		? data.fileColors
				.filter(
					(a) => a && typeof a.path === 'string' && typeof a.color === 'string'
				)
				.map((a) => ({ ...a }))
		: []
	const toggle = (key: string) =>
		typeof data[key] === 'boolean' ? (data[key] as boolean) : true
	return {
		...data,
		schemaVersion: 1,
		cascadeColors: false,
		colorBackground: false,
		palette,
		fileColors,
		graphEnabled: toggle('graphEnabled'),
		localGraphEnabled: toggle('localGraphEnabled'),
		includeFolderNotes: toggle('includeFolderNotes'),
		automaticSuggestions: toggle('automaticSuggestions'),
		preferUnused: toggle('preferUnused'),
		explorerEnabled: toggle('explorerEnabled'),
		groupPrecedence: data.groupPrecedence === 'native' ? 'native' : 'folder',
		folderNoteConvention:
			data.folderNoteConvention === 'inside' ||
			data.folderNoteConvention === 'outside'
				? data.folderNoteConvention
				: 'auto',
	}
}
