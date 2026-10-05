import { describe, it, expect } from 'vitest'
import { ColorResolver } from '../../src/colors/ColorResolver'
import {
	parseColor,
	renameAssignments,
	deleteAssignments,
} from '../../src/colors/ColorStore'

describe('inherited folder colors', () => {
	it('uses the nearest ancestor and falls back on removal', () => {
		const colors = new Map([
			['University', '#0000ff'],
			['University/Chemistry', '#ff9900'],
		])
		const resolver = new ColorResolver(colors)
		expect(resolver.resolveColorForFile('University/Note.md')).toBe('#0000ff')
		expect(
			resolver.resolveColorForFile('University/Chemistry/Lab/Note.md')
		).toBe('#ff9900')
		expect(resolver.resolveColorForFile('University2/Note.md')).toBeNull()
		colors.delete('University/Chemistry')
		resolver.reset(colors)
		expect(
			resolver.resolveColorForFile('University/Chemistry/Lab/Note.md')
		).toBe('#0000ff')
		resolver.reset(new Map())
		expect(resolver.resolveColorForFile('University/Note.md')).toBeNull()
	})
	it('treats path punctuation and Unicode literally', () => {
		const path = `Übungen (2026)/Children's Literature # & "é"`
		expect(
			new ColorResolver(new Map([[path, '#123456']])).resolveColorForFile(
				path + '/N.md'
			)
		).toBe('#123456')
	})
	it('renames/moves descendants without changing similar siblings', () => {
		const assignments = [
			{ path: 'A', color: 'blue' },
			{ path: 'A/Child', color: 'orange' },
			{ path: 'AB', color: 'green' },
		]
		expect(
			renameAssignments(assignments, 'A', 'Archive/Course').map((a) => a.path)
		).toEqual(['Archive/Course', 'Archive/Course/Child', 'AB'])
		expect(deleteAssignments(assignments, 'A')).toEqual([assignments[2]])
	})
	it('accepts inherited hex/RGB, rejects unsafe or transparent CSS', () => {
		expect(parseColor('#aBc')).toBe('#aabbcc')
		expect(parseColor('rgb(79, 131, 204)')).toBe('#4f83cc')
		expect(parseColor({ rgb: 0x4f83cc })).toBe('#4f83cc')
		for (const value of [
			'rgb(999,0,0)',
			'red; color: black',
			'#12345678',
			'url(x)',
			'rgba(1,2,3,0)',
		])
			expect(parseColor(value)).toBeNull()
	})
})
