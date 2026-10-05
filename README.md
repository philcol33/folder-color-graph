# Folder Color Graph

Assign a folder color once. The folder title uses that text color in File Explorer, and its notes use the same color in Obsidian's native Global and Local Graph views.

Based on [File Color by ecustic](https://github.com/ecustic/obsidian-file-color). MIT license and original Emil Custic copyright retained.

## Use

Right-click a folder → **Set color** → accept **Suggested** with **Apply**, or select a preset/custom color. **Assign suggested color** is also available directly in the context menu. **Remove color** restores normal Explorer text and inherited/default graph coloring.

Graph notes inherit the nearest explicitly colored folder. A nested folder can override its parent. New contained notes inherit automatically. Only explicitly assigned folder titles change in Explorer; filenames, backgrounds, arrows, icons and typography remain native.

Folder Notes by LostPaul is supported read-only for Markdown inside/parent-folder conventions and basename templates. Without that plugin, same-name inside notes are tried before outside notes. Unsupported configurations and ambiguous matches are skipped. See [Folder Notes integration](docs/folder-notes-integration.md).

## Settings

- Enable Global Graph, Local Graph, folder-note correspondence, and Explorer text separately.
- Prefer folder colors (default) or existing native graph group colors.
- Enable suggestions and prefer unused colors.
- Add, edit, remove, reorder, or reset the palette. Removing/resetting a palette preserves assignments as custom hex colors.

The eight default swatches use moderately saturated midtones: Blue `#4f83cc`, Orange `#ca8135`, Teal `#389b90`, Purple `#9174c6`, Rose `#c96d88`, Green `#789e46`, Red `#c46b61`, Ochre `#b49b44`. They balance hue separation and visibility on native light/dark graph backgrounds, avoiding neon colors. They are not a guarantee of WCAG text contrast on every theme. Presets have text names, keyboard focus and pressed-state labels; colors are never silently changed with the theme.

Suggestions deterministically avoid the nearest parent, then immediately colored siblings, then favor least-used colors; ties follow palette order. An empty palette still permits a custom color.

## Installation and development

Requires Node/npm for development. From this repository:

```sh
npm ci
npm test
npm run lint
npm run build
npm run dev
```

Copy `main.js`, `manifest.json`, and `styles.css` to `<test-vault>/.obsidian/plugins/folder-color-graph/`, then enable **Folder Color Graph** in Community plugins. Build output and vault data are not committed. Original File Color has a distinct ID and can remain installed; disable it when testing to avoid its own Explorer cascades/backgrounds.

Settings live only in this plugin's `data.json`. The upstream palette/fileColors schema is retained. To migrate existing File Color data, disable the fork, copy the original plugin's data.json into this plugin's directory (keep a backup), and enable the fork. Valid folder assignments remain; legacy file assignments are retained but not rendered. Hex and inherited RGB colors are accepted. Existing empty palettes remain empty; fresh installations receive defaults. The original plugin's data is never changed automatically.

Graph integration uses private native renderer APIs and has been verified on Obsidian **1.13.7 desktop/macOS**. Unsupported renderers fall back to native behavior with one notice. Mobile and other Obsidian versions have not been verified. No native graph groups/settings are rewritten, and no notes, frontmatter, tags, or graph links are created for coloring. See [graph architecture and compatibility](docs/graph-integration.md).

## Development notes

- [Upstream architecture](docs/upstream-architecture.md)
- [Milestones and environment](docs/project-plan.md)
- [Verification results](docs/verification.md)

`scripts/runtime-qa.cjs` is an optional development-only plugin runner. It refuses vaults not named test-vault/test_vault, uses an isolated Runtime QA fixture, restores coloring settings and sends temporary fixtures to Trash. It is never bundled into Folder Color Graph. Its temporary plugin manifest uses ID `folder-color-graph-qa`; run its command only after coloring the provided course blue and Assignments orange and opening a Local Graph for Lecture 01. The runner writes a result JSON inside its own plugin directory.
