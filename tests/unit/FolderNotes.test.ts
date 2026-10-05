import { describe, expect, it } from 'vitest'
import {
	folderNoteOptions,
	indexFolderNotes,
	resolveFolderNoteForFolder,
} from '../../src/folder-notes/FolderNoteResolver'
import { ColorResolver } from '../../src/colors/ColorResolver'

describe('Folder Notes correspondence', () => {
	it('resolves inside and outside notes and prefers inside when ambiguous', () => {
		const exists = (p: string) =>
			['Courses/DH/DH.md', 'Courses/DH.md'].includes(p)
		expect(resolveFolderNoteForFolder('Courses/DH', exists)).toBe(
			'Courses/DH/DH.md'
		)
		const options = folderNoteOptions(
			{ storageLocation: 'parentFolder' },
			'auto'
		)
		expect(resolveFolderNoteForFolder('Courses/DH', exists, options)).toBe(
			'Courses/DH.md'
		)
		const notes = indexFolderNotes(['Courses/DH'], exists, options)
		expect(
			new ColorResolver(
				new Map([['Courses/DH', '#123456']]),
				notes
			).resolveColorForFile('Courses/DH.md')
		).toBe('#123456')
	})
	it('supports configured templates and safe exclusion', () => {
		const raw = {
			storageLocation: 'insideFolder',
			folderNoteName: 'Index {{folder_name}}',
			excludeFolders: [
				{ path: 'Courses/Excluded', disableFolderNote: true, subFolders: true },
			],
		}
		const options = folderNoteOptions(raw, 'auto')
		expect(
			resolveFolderNoteForFolder(
				'Courses/É & #',
				(p) => p === 'Courses/É & #/Index É & #.md',
				options
			)
		).toBe('Courses/É & #/Index É & #.md')
		expect(
			resolveFolderNoteForFolder('Courses/Excluded/Child', () => true, options)
		).toBeNull()
		expect(raw.folderNoteName).toBe('Index {{folder_name}}')
		expect(
			resolveFolderNoteForFolder(
				'A',
				() => true,
				folderNoteOptions({ folderNoteName: '../secret' }, 'auto')
			)
		).toBeNull()
	})
	it('fails safely for unsupported types or ambiguous static outside notes', () => {
		expect(
			resolveFolderNoteForFolder(
				'A',
				() => true,
				folderNoteOptions({ folderNoteType: '.canvas' }, 'auto')
			)
		).toBeNull()
		expect(
			indexFolderNotes(
				['Courses/A', 'Courses/B'],
				() => true,
				folderNoteOptions(
					{ storageLocation: 'parentFolder', folderNoteName: 'Index' },
					'auto'
				)
			).size
		).toBe(0)
	})
})
