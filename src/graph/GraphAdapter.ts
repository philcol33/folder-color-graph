import { parseColor } from '../colors/ColorStore'

type Fill = { rgb: number; a: number }
type Node = {
	id: string
	type?: string
	color?: unknown
	getFillColor: (...args: unknown[]) => unknown
}
type Renderer = {
	nodes: unknown[]
	setData: (...args: unknown[]) => unknown
	changed: () => void
	getHighlightNode?: () => unknown
}
type NodePatch = {
	node: Node
	original: Node['getFillColor']
	wrapper: Node['getFillColor']
	fill: Fill | null
	active: boolean
}
type RendererPatch = {
	renderer: Renderer
	original: Renderer['setData']
	wrapper: Renderer['setData']
	nodes: Map<Node, NodePatch>
	active: boolean
}

function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object'
		? (value as Record<string, unknown>)
		: null
}
function rendererOf(view: unknown): Renderer | null {
	const r = record(record(view)?.renderer)
	return r &&
		Array.isArray(r.nodes) &&
		typeof r.setData === 'function' &&
		typeof r.changed === 'function'
		? (r as unknown as Renderer)
		: null
}
function nodeOf(value: unknown): Node | null {
	const n = record(value)
	return n && typeof n.id === 'string' && typeof n.getFillColor === 'function'
		? (n as unknown as Node)
		: null
}

/** The only module that touches native Graph internals. No settings/data mutation. */
export class GraphAdapter {
	private renderers = new Map<Renderer, RendererPatch>()
	private active = true
	private preferNative = false
	private reported = false
	constructor(
		private resolve: (id: string) => string | null,
		private isMarkdown: (id: string) => boolean,
		private unavailable: () => void = () => undefined
	) {}

	sync(
		workspace: unknown,
		global: boolean,
		local = false,
		preferNative = false
	) {
		if (!this.active) return
		this.preferNative = preferNative
		const seen = new Set<Renderer>()
		try {
			const ws = record(workspace)
			if (typeof ws?.getLeavesOfType !== 'function') return
			for (const type of ['graph', 'localgraph']) {
				if (type === 'graph' ? !global : !local) continue
				const leaves: unknown = ws.getLeavesOfType.call(workspace, type)
				if (!Array.isArray(leaves)) continue
				for (const leaf of leaves) {
					const renderer = rendererOf(record(leaf)?.view)
					if (!renderer) {
						if (record(record(leaf)?.view)?.renderer) this.report()
						continue
					}
					seen.add(renderer)
					if (!this.renderers.has(renderer)) this.attach(renderer)
				}
			}
		} catch {
			this.report()
		}
		for (const [renderer, patch] of this.renderers)
			if (!seen.has(renderer)) {
				this.restore(patch)
				this.renderers.delete(renderer)
			}
	}

	refresh() {
		for (const patch of this.renderers.values()) {
			try {
				this.reconcile(patch)
				patch.renderer.changed()
			} catch {
				this.report()
			}
		}
	}

	private report() {
		if (!this.reported) {
			this.reported = true
			this.unavailable()
		}
	}

	private attach(renderer: Renderer) {
		const original = renderer.setData
		const patch: RendererPatch = {
			renderer,
			original,
			wrapper: original,
			nodes: new Map(),
			active: true,
		}
		// Keep native receiver semantics in wrappers.
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const adapter = this
		patch.wrapper = function (this: Renderer, ...args) {
			const result = original.apply(this, args)
			if (adapter.active && patch.active) {
				try {
					adapter.reconcile(patch)
					renderer.changed()
				} catch {
					adapter.report()
				}
			}
			return result
		}
		try {
			renderer.setData = patch.wrapper
			this.renderers.set(renderer, patch)
			this.reconcile(patch)
			renderer.changed()
		} catch {
			this.restore(patch)
			this.renderers.delete(renderer)
			this.report()
		}
	}

	private reconcile(patch: RendererPatch) {
		const seen = new Set<Node>()
		for (const value of patch.renderer.nodes) {
			const node = nodeOf(value)
			if (!node) {
				this.report()
				continue
			}
			seen.add(node)
			let state = patch.nodes.get(node)
			if (!state) {
				const original = node.getFillColor
				state = { node, original, wrapper: original, fill: null, active: true }
				const cached = state
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				const adapter = this
				state.wrapper = function (this: Node, ...args) {
					if (
						!adapter.active ||
						!patch.active ||
						!cached.active ||
						!cached.fill
					)
						return original.apply(this, args)
					try {
						if (patch.renderer.getHighlightNode?.() === this)
							return original.apply(this, args)
						if (adapter.preferNative && parseColor(this.color))
							return original.apply(this, args)
						return cached.fill
					} catch {
						return original.apply(this, args)
					}
				}
				node.getFillColor = state.wrapper
				patch.nodes.set(node, state)
			}
			// Resolve only during updates, never inside a render/animation frame.
			const hex = this.isMarkdown(node.id)
				? parseColor(this.resolve(node.id))
				: null
			state.fill = hex ? { rgb: parseInt(hex.slice(1), 16), a: 1 } : null
		}
		for (const [node, state] of patch.nodes)
			if (!seen.has(node)) {
				this.restoreNode(state)
				patch.nodes.delete(node)
			}
	}

	private restoreNode(state: NodePatch) {
		state.active = false
		try {
			if (state.node.getFillColor === state.wrapper)
				state.node.getFillColor = state.original
		} catch {
			/* A frozen foreign node is already guarded by active=false. */
		}
	}
	private restore(patch: RendererPatch) {
		patch.active = false
		for (const state of patch.nodes.values()) this.restoreNode(state)
		patch.nodes.clear()
		try {
			if (patch.renderer.setData === patch.wrapper)
				patch.renderer.setData = patch.original
		} catch {
			/* Foreign renderer may have become immutable. */
		}
		try {
			patch.renderer.changed()
		} catch {
			/* Closed renderer; nothing to redraw. */
		}
	}
	dispose() {
		this.active = false
		for (const patch of this.renderers.values()) this.restore(patch)
		this.renderers.clear()
	}
	get status() {
		return {
			renderers: this.renderers.size,
			nodes: [...this.renderers.values()].reduce(
				(sum, p) => sum + [...p.nodes.values()].filter((n) => !!n.fill).length,
				0
			),
			compatible: !this.reported,
		}
	}
}
