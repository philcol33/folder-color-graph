import { describe, expect, it, vi } from 'vitest'
import { GraphAdapter } from '../../src/graph/GraphAdapter'

function fixture() {
	const native = { rgb: 0x444444, a: 1 }
	const node = (id: string) => ({
		id,
		color: undefined as unknown,
		getFillColor: vi.fn(() => native),
	})
	const renderer = {
		nodes: [node('A/Note.md'), node('Other.md'), node('#tag')],
		setData: vi.fn(function (this: { nodes: unknown[] }, nodes: unknown[]) {
			this.nodes = nodes
		}),
		changed: vi.fn(),
		getHighlightNode: () => null as unknown,
	}
	const groups = [{ query: 'tag:#keep', color: { rgb: 0x123456, a: 1 } }]
	const workspace = {
		getLeavesOfType: (type: string) =>
			type === 'graph' ? [{ view: { renderer, groups } }] : [],
	}
	return { node, renderer, workspace, groups, native }
}

describe('native runtime graph safety', () => {
	it('colors eligible nodes, updates live, intercepts new nodes and restores originals', () => {
		const f = fixture(),
			original = f.renderer.nodes[0].getFillColor,
			setData = f.renderer.setData
		let color: string | null = '#4f83cc'
		const resolve = vi.fn((id: string) => (id.startsWith('A/') ? color : null))
		const adapter = new GraphAdapter(resolve, (id) => id.endsWith('.md'))
		const groups = JSON.stringify(f.groups)
		adapter.sync(f.workspace, true)
		expect(f.renderer.nodes[0].getFillColor()).toEqual({ rgb: 0x4f83cc, a: 1 })
		expect(f.renderer.nodes[1].getFillColor()).toBe(f.native)
		expect(f.renderer.nodes[2].getFillColor()).toBe(f.native)
		const calls = resolve.mock.calls.length
		for (let i = 0; i < 100; i++) f.renderer.nodes[0].getFillColor()
		expect(resolve).toHaveBeenCalledTimes(calls)
		color = '#ca8135'
		adapter.refresh()
		expect(f.renderer.nodes[0].getFillColor()).toEqual({ rgb: 0xca8135, a: 1 })
		const next = f.node('A/New.md')
		f.renderer.setData([next])
		expect(next.getFillColor()).toEqual({ rgb: 0xca8135, a: 1 })
		expect(original).toHaveBeenCalledTimes(0)
		color = null
		adapter.refresh()
		expect(next.getFillColor()).toBe(f.native)
		adapter.dispose()
		expect(f.renderer.setData).toBe(setData)
		expect(JSON.stringify(f.groups)).toBe(groups)
	})
	it('preserves native group precedence and hover, handles foreign wrappers on unload', () => {
		const f = fixture(),
			n = f.renderer.nodes[0]
		n.color = { rgb: 0x123456, a: 1 }
		const adapter = new GraphAdapter(
			() => '#4f83cc',
			() => true
		)
		adapter.sync(f.workspace, true, false, true)
		expect(n.getFillColor()).toBe(f.native)
		adapter.sync(f.workspace, true, false, false)
		expect(n.getFillColor()).toEqual({ rgb: 0x4f83cc, a: 1 })
		f.renderer.getHighlightNode = () => n
		expect(n.getFillColor()).toBe(f.native)
		f.renderer.getHighlightNode = () => null
		const ours = n.getFillColor
		n.getFillColor = vi.fn(() => ours())
		adapter.dispose()
		expect(n.getFillColor()).toBe(f.native)
	})
	it('fails safely on unsupported renderers and restores when disabled', () => {
		const notify = vi.fn(),
			adapter = new GraphAdapter(
				() => '#123456',
				() => true,
				notify
			)
		adapter.sync(
			{ getLeavesOfType: () => [{ view: { renderer: { nodes: [] } } }] },
			true
		)
		adapter.sync({ getLeavesOfType: () => [{ view: {} }] }, true)
		expect(notify).toHaveBeenCalledTimes(1)
		const f = fixture(),
			original = f.renderer.nodes[0].getFillColor
		adapter.sync(f.workspace, true)
		adapter.sync(f.workspace, false)
		expect(f.renderer.nodes[0].getFillColor).toBe(original)
	})
  it('independently enables local and global graphs', () => {
    const global = fixture(), local = fixture()
    const workspace = { getLeavesOfType: (type: string) => [{view:{renderer: type === 'graph' ? global.renderer : local.renderer}}] }
    const adapter = new GraphAdapter(() => '#123456', () => true)
    adapter.sync(workspace, false, true)
    expect(global.renderer.nodes[0].getFillColor()).toBe(global.native)
    expect(local.renderer.nodes[0].getFillColor()).toEqual({rgb:0x123456,a:1})
    adapter.sync(workspace, true, false)
    expect(local.renderer.nodes[0].getFillColor()).toBe(local.native)
    expect(global.renderer.nodes[0].getFillColor()).toEqual({rgb:0x123456,a:1})
    adapter.dispose()
  })

})
