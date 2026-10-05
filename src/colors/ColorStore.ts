import type { FileColorPluginSettings } from '../settings'

export type Assignment = FileColorPluginSettings['fileColors'][number]
export type PaletteColor = FileColorPluginSettings['palette'][number]

/** Only opaque colors are accepted; never interpolate arbitrary persisted CSS. */
export function parseColor(value: unknown): string | null {
	if (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 0 &&
		value <= 0xffffff
	)
		return '#' + value.toString(16).padStart(6, '0')
	if (typeof value === 'object' && value !== null && 'rgb' in value)
		return parseColor((value as { rgb: unknown }).rgb)
	if (typeof value !== 'string') return null
	const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)
	if (hex)
		return (
			'#' +
			(hex[1].length === 3
				? [...hex[1]].map((c) => c + c).join('')
				: hex[1]
			).toLowerCase()
		)
	const rgb = value
		.trim()
		.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
	if (rgb && rgb.slice(1).every((n) => Number(n) <= 255))
		return (
			'#' +
			rgb
				.slice(1)
				.map((n) => Number(n).toString(16).padStart(2, '0'))
				.join('')
		)
	return null
}

export function assignmentColor(
	color: string,
	palette: PaletteColor[]
): string | null {
	return parseColor(palette.find((c) => c.id === color)?.value ?? color)
}
export function isWithin(path: string, folder: string): boolean {
	return (
		path === folder || (folder === '' ? true : path.startsWith(folder + '/'))
	)
}
export function parentPath(path: string): string {
	return path.slice(0, Math.max(0, path.lastIndexOf('/')))
}
export function renameAssignments(
	assignments: Assignment[],
	oldPath: string,
	newPath: string
): Assignment[] {
	return assignments.map((a) =>
		isWithin(a.path, oldPath)
			? { ...a, path: newPath + a.path.slice(oldPath.length) }
			: a
	)
}
export function deleteAssignments(
	assignments: Assignment[],
	path: string
): Assignment[] {
	return assignments.filter((a) => !isWithin(a.path, path))
}
