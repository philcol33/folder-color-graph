import {
	assignmentColor,
	parentPath,
	parseColor,
	Assignment,
	PaletteColor,
} from './ColorStore'
import { ColorResolver } from './ColorResolver'

export function suggestColorForFolder(
	path: string,
	assignments: Assignment[],
	palette: PaletteColor[],
	preferUnused = true
): PaletteColor | null {
	const colors = new Map<string, string>()
	const counts = new Map<string, number>()
	for (const a of assignments) {
		if (a.path === path) continue
		const color = assignmentColor(a.color, palette)
		if (!color) continue
		colors.set(a.path, color)
		counts.set(color, (counts.get(color) ?? 0) + 1)
	}
	const parent = new ColorResolver(colors).resolveFolder(parentPath(path))
	const siblings = new Set(
		[...colors]
			.filter(([p]) => parentPath(p) === parentPath(path))
			.map(([, c]) => c)
	)
	return (
		palette
			.map((p, index) => ({ p, index, hex: parseColor(p.value) }))
			.filter(
				(c): c is { p: PaletteColor; index: number; hex: string } => !!c.hex
			)
			.sort((a, b) => {
				const score = (hex: string) => [
					Number(hex === parent),
					Number(siblings.has(hex)),
					preferUnused ? counts.get(hex) ?? 0 : 0,
				]
				const sa = score(a.hex),
					sb = score(b.hex)
				return (
					sa[0] - sb[0] || sa[1] - sb[1] || sa[2] - sb[2] || a.index - b.index
				)
			})[0]?.p ?? null
	)
}
