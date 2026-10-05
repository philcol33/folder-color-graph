import { describe, expect, it } from 'vitest'
import {
	suggestColorForFolder,
	uniquifyFolderColors,
} from '../../src/colors/SuggestedColor'
import { assignmentColor } from '../../src/colors/ColorStore'
import { defaultPalette as p } from '../../src/colors/palette'
import { migrateSettings } from '../../src/colors/Settings'

describe('strictly unique suggestions', () => {
	it('uses an unused preset and generates a stable color after exhaustion', () => {
		const assignments = [
			{ path: 'A', color: 'blue' },
			{ path: 'A/Other', color: 'orange' },
			{ path: 'Else', color: 'teal' },
		]
		expect(suggestColorForFolder('A/New', assignments, p)?.id).toBe('purple')
		const first = suggestColorForFolder('A/New', assignments, p.slice(0, 2))!
		expect(first).toEqual(
			suggestColorForFolder('A/New', assignments, p.slice(0, 2))
		)
		expect(['#4f83cc', '#ca8135', '#389b90']).not.toContain(first.value)
		expect(assignmentColor(first.id, p)).toBe(first.value)
	})
	it('normalizes RGB/custom colors and duplicate palette entries', () => {
		const palette = [
			{ id: 'duplicate', name: 'Blue', value: 'rgb(79,131,204)' },
			p[0],
			p[1],
		]
		expect(
			suggestColorForFolder(
				'New',
				[{ path: 'Other', color: '#4F83CC' }],
				palette
			)?.id
		).toBe('orange')
		expect(suggestColorForFolder('Empty', [], [])?.value).toMatch(
			/^#[0-9a-f]{6}$/
		)
	})
	it('keeps the current unique color on repeated automatic assignment', () => {
		expect(
			suggestColorForFolder(
				'A',
				[
					{ path: 'A', color: 'blue' },
					{ path: 'B', color: 'orange' },
				],
				p
			)?.id
		).toBe('blue')
		expect(
			suggestColorForFolder('A', [{ path: 'A', color: '#123456' }], p)?.id
		).toBe('#123456')
		expect(
			suggestColorForFolder(
				'A',
				[
					{ path: 'A', color: 'blue' },
					{ path: 'B', color: 'blue' },
				],
				p
			)?.id
		).toBe('orange')
	})
	it('never repeats a color across 200 assignments beyond the eight presets', () => {
		const assignments: { path: string; color: string }[] = [],
			used = new Set<string>()
		for (let i = 0; i < 200; i++) {
			const suggested = suggestColorForFolder(`Folders/${i}`, assignments, p)!
			expect(used.has(suggested.value)).toBe(false)
			used.add(suggested.value)
			assignments.push({ path: `Folders/${i}`, color: suggested.id })
		}
		expect(used.size).toBe(200)
	})
	it('repairs duplicates without changing the first assignment or legacy file colors', () => {
		const original = Array.from({ length: 23 }, (_, i) => ({
			path: 'Folder ' + i,
			color: p[i % 8].id,
		}))
		original.push({ path: 'Legacy.md', color: 'blue' })
		const repaired = uniquifyFolderColors(
			original,
			p,
			(path) => !path.endsWith('.md')
		)
		expect(
			new Set(repaired.slice(0, 23).map((a) => assignmentColor(a.color, p)))
				.size
		).toBe(23)
		expect(repaired.slice(0, 8)).toEqual(original.slice(0, 8))
		expect(repaired[23]).toEqual(original[23])
		expect(original[8].color).toBe('blue')
		expect(
			uniquifyFolderColors(repaired, p, (path) => !path.endsWith('.md'))
		).toEqual(repaired)
	})
	it('preserves upstream assignments and custom options without mutating input', () => {
		const original = {
			palette: [{ id: 'old', name: 'Old', value: 'rgb(79,131,204)' }],
			fileColors: [
				{ path: 'Courses', color: 'old' },
				{ path: 'Note.md', color: 'old' },
			],
			cascadeColors: true,
			colorBackground: true,
			unknownOption: 'retain',
		}
		const migrated = migrateSettings(original)
		expect(migrated.palette[0].value).toBe('#4f83cc')
		expect(migrated.fileColors).toEqual(original.fileColors)
		expect(migrated.cascadeColors).toBe(false)
		expect((migrated as unknown as Record<string, unknown>).unknownOption).toBe(
			'retain'
		)
		expect(original.palette[0].value).toBe('rgb(79,131,204)')
		expect(migrateSettings(null).palette).toHaveLength(8)
		expect(migrateSettings({ palette: [] }).palette).toHaveLength(0)
	})
})
