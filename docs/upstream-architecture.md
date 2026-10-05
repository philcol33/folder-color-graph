# File Color foundation

Based on [ecustic/obsidian-file-color](https://github.com/ecustic/obsidian-file-color) at 51bf599b (MIT, Emil Custic 2022). The original license is preserved.

`src/index.ts` exports `FileColorPlugin`. Its onload loads `data.json`, registers File Explorer menus and workspace/vault lifecycle listeners, injects palette styles, and adds the React settings tab. Settings retain `palette: {id,name,value}[]` and `fileColors: {path,color}[]`; colors reference palette IDs. Saving originally debounces for three seconds.

`SetColorModal` mounts the React palette in Obsidian Modal. Clicking a swatch immediately saves a file or folder assignment. `SettingsPanel` edits the palette and offers background/cascade toggles. Goober supplies component styles; the build gives its style element a plugin-specific ID.

Explorer styling traverses native `view.fileItems` and sets palette/type/cascade classes on each item. Original CSS colors folder and file titles, optionally descendant titles and backgrounds. This private Explorer access is retained behind a styling adapter; the fork limits the selector to the explicit folder title text.

Original rename handling updates only an exact assigned path. Delete uses startsWith, which can mistakenly match similarly named siblings. The fork will extend renames to descendants and require a slash boundary for both operations.

Build: npm ci; TypeScript strict check then esbuild CommonJS, with obsidian/electron external. Vitest/jsdom tests React components and plugin lifecycle using an Obsidian mock. Original baseline: 16 tests in 3 suites pass, typecheck/build and ESLint pass. Prettier reports 38 pre-existing formatting issues.

Baseline on macOS 26.6.2 / Obsidian 1.13.7: installed unmodified File Color in the pre-existing development vault. Right-click Baseline Rename → Set color → Blue produced blue text; data.json persisted blue. Renaming to Baseline Renamed retained the saved assignment and Explorer color. No real vault was used.
