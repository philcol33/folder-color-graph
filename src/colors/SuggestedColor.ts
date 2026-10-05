import {
	assignmentColor,
	parseColor,
	Assignment,
	PaletteColor,
} from './ColorStore'

function hexForHsl(hue: number, saturation: number, lightness: number): string {
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
	const sector = hue / 60
	const x = chroma * (1 - Math.abs((sector % 2) - 1))
	const channels =
		sector < 1
			? [chroma, x, 0]
			: sector < 2
			? [x, chroma, 0]
			: sector < 3
			? [0, chroma, x]
			: sector < 4
			? [0, x, chroma]
			: sector < 5
			? [x, 0, chroma]
			: [chroma, 0, x]
	const offset = lightness - chroma / 2
	return (
		'#' +
		channels
			.map((c) =>
				Math.round((c + offset) * 255)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	)
}
function channels(hex: string): number[] {
	return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
}
function seedForPath(path: string): number {
	let hash = 2166136261
	for (let i = 0; i < path.length; i++)
		hash = Math.imul(hash ^ path.charCodeAt(i), 16777619)
	return hash >>> 0
}

/** Exact color uniqueness across explicit folder assignments, including custom/RGB colors. */
export function suggestColorForFolder(
	path: string,
	assignments: Assignment[],
	palette: PaletteColor[]
): PaletteColor | null {
	const used = new Set<string>()
	let current: Assignment | undefined
	for (const a of assignments) {
		if (a.path === path) {
			current = a
			continue
		}
		const hex = assignmentColor(a.color, palette)
		if (hex) used.add(hex)
	}
	const currentHex = current && assignmentColor(current.color, palette)
	if (current && currentHex && !used.has(currentHex)) {
		const id = current.color
		const preset = palette.find((c) => c.id === id)
		return {
			id,
			name: preset?.name ?? `Custom ${currentHex}`,
			value: currentHex,
		}
	}
	for (const color of palette) {
		const hex = parseColor(color.value)
		if (hex && !used.has(hex)) return { ...color, value: hex }
	}

	// Palette exhaustion creates a custom hex assignment; it never wraps the palette.
	// Score moderately saturated midtones by their minimum RGB distance from used colors.
	const reserved = new Set<string>()
	for (const color of palette) {
		const id = parseColor(color.id)
		if (id && parseColor(color.value) !== id) reserved.add(id)
	}
	const unavailable = (hex: string) => used.has(hex) || reserved.has(hex)
	const existing = [...used].map(channels)
	const seed = seedForPath(path)
	let best: string | null = null,
		bestDistance = -1
	for (let i = 0; i < 96; i++) {
		const hue = ((seed % 360) + i * 137.507764) % 360
		for (const saturation of [0.55, 0.7])
			for (const lightness of [0.47, 0.6]) {
				const hex = hexForHsl(hue, saturation, lightness)
				if (unavailable(hex)) continue
				const rgb = channels(hex)
				let distance = Infinity
				for (const other of existing)
					distance = Math.min(
						distance,
						rgb.reduce((sum, c, index) => sum + (c - other[index]) ** 2, 0)
					)
				if (distance > bestDistance) {
					best = hex
					bestDistance = distance
				}
			}
	}
	if (!best) {
		// An odd stride visits every 24-bit RGB value. N occupied values need at most N+1 probes.
		let rgb = seed & 0xffffff
		for (let i = 0; i <= Math.min(0xffffff, used.size + reserved.size); i++) {
			const hex = '#' + rgb.toString(16).padStart(6, '0')
			if (!unavailable(hex)) {
				best = hex
				break
			}
			rgb = (rgb + 0x9e3779) & 0xffffff
		}
	}
	return best ? { id: best, name: `Generated ${best}`, value: best } : null
}

/** Preserve the first use of each color and replace only repeated folder colors. */
export function uniquifyFolderColors(
	assignments: Assignment[],
	palette: PaletteColor[],
	isFolder: (path: string) => boolean = () => true
): Assignment[] {
	const result = assignments.map((a) => ({ ...a }))
	const seen = new Set<string>()
	for (const a of result) {
		if (!isFolder(a.path)) continue
		const hex = assignmentColor(a.color, palette)
		if (!hex) continue
		if (!seen.has(hex)) {
			seen.add(hex)
			continue
		}
		const suggestion = suggestColorForFolder(
			a.path,
			result.filter((a) => isFolder(a.path)),
			palette
		)
		if (!suggestion) throw new Error('No unused RGB colors remain.')
		a.color = suggestion.id
		seen.add(suggestion.value)
	}
	return result
}
