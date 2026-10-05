# Native graph integration

## Research and decision
Tested against installed Obsidian 1.13.7 (desktop macOS). Native graphs use a Canvas/WebGL renderer, an array of nodes, renderer.setData/changed, and per-node getFillColor. Native groups supply node.color from ordered queries. The Groups UI creates hues by group count (40° steps, theme-dependent saturation); this is internal, not a stable exported palette API. The fork uses a documented curated palette instead.

Studied [folderandgraphs-plus](https://github.com/pilafdob/folderandgraphs-plus) and [graph-color-propagation](https://github.com/Tacitustus/obsidian-graph-color-propagation), both MIT, as references only. No reference implementation code copied.

Option A, managed native groups, requires escaped search syntax, depth ordering, extra outside-note rules, and ownership tracking in graph settings. Obsidian does not expose a stable rule-ownership API. Persisted mutations risk conflating user rules and plugin rules.

Chosen option B: runtime instance wrappers. Each enabled graph renderer's setData is wrapped to discover freshly created nodes; each supported node's getFillColor receives a cached resolved color. Renderer.changed requests a redraw. No graph queries, artificial nodes/edges, physics changes, graph.json access, or user group mutations. Punctuation/Unicode paths are literal map keys.

## Precedence and fallback
Nearest explicit folder wins, then higher ancestors, then original getFillColor. Markdown nodes only; tags, attachments and unresolved nodes retain native behavior. Highlighted nodes retain the native highlight. Prefer folder colors is default; Prefer existing graph groups defers to a native node.color. Disabling a graph toggle restores wrappers and redraws native colors.

Private access is confined to GraphAdapter.ts. Feature detection checks renderer nodes/setData/changed and node id/getFillColor; unsupported views emit one Notice per plugin instance and leave native behavior. Wrapper failures fall back safely. Disposal restores only functions still owned by the adapter; foreign wrappers retaining an old wrapper encounter an inactive pass-through. No shared prototypes are patched.

Resolution is cached by folder. Full correspondence indexing runs on settings/path/layout changes, never on animation frames. A one-second scan discovers new graph views and checks Folder Notes configuration; node updates are intercepted by setData. Rendering performs a cached value lookup only.

Global Graph implemented first. Local Graph uses the same renderer shape, enabled in its own milestone. Compatibility must be rechecked on future Obsidian versions; this is a private adapter and deliberately fails closed when its shape changes.
