import { describe, expect, it } from 'vitest'
import { suggestColorForFolder } from '../../src/colors/SuggestedColor'
import { defaultPalette as p } from '../../src/colors/palette'
import { migrateSettings } from '../../src/colors/Settings'

describe('suggestions and migration', () => {
	it('is stable, avoids parent/siblings and picks least used available color', () => {
		const assignments = [
			{ path: 'A', color: 'blue' },
			{ path: 'A/Other', color: 'orange' },
			{ path: 'Else', color: 'teal' },
		]
		expect(suggestColorForFolder('A/New', assignments, p)?.id).toBe('purple')
		expect(suggestColorForFolder('A/New', assignments, p)?.id).toBe('purple')
		expect(suggestColorForFolder('A/New', assignments, p.slice(0, 2))?.id).toBe(
			'orange'
		)
	})
	it('counts duplicate palette values and custom colors together', () => {
		expect(
			suggestColorForFolder(
				'New',
				[{ path: 'Else', color: '#4f83cc' }],
				[{ id: 'duplicate', name: 'Blue', value: '#4f83cc' }, p[1]]
			)?.id
		).toBe('orange')
		expect(suggestColorForFolder('New', [], [])).toBeNull()
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
