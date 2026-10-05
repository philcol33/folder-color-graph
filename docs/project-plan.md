# Folder Color Graph

Folder metadata drives explicit Explorer folder text and inherited native graph node colors. No note or graph configuration writes.

## Environment
macOS 26.6.2 ARM, Git 2.50.1, Node 25.9.0, npm 11.12.1, gh 2.97.0 authenticated as philcol33, VS Code installed, Obsidian 1.13.7. Origin is philcol33/folder-color-graph; upstream is ecustic/obsidian-file-color with push disabled.

The requested existing test vault is reused via the parent workspace test-vault symlink. Synthetic fixtures live under Folder Color Graph Tests; existing files/plugins are preserved.

## Milestones
0. Setup, baseline, attribution, metadata — complete.
1. Folder-only Explorer/menu — complete.
2. Central cached inherited resolver and safe path changes — complete.
3. Deterministic suggested palette/modal — complete.
4. Read-only Folder Notes conventions — complete.
5. Guarded global native graph coloring — complete.
6. Local graph — complete.
7. Lifecycle, performance, coexistence verification — complete.
8. Focused settings, accessibility, README — complete.

Each milestone receives a local commit; no implementation is pushed without a request.

## Final status
All nine milestones implemented and committed locally. The test vault has the final build enabled, with the course blue and Assignments orange. Global/Local Graph are verified on desktop 1.13.7. The temporary QA runner was disabled and moved out of the vault; its disposable test fixtures were sent to Trash. The test vault's original light scheme was restored after dark-theme verification. Colors survived an Obsidian quit/reopen.

Validation: 35 tests in 8 suites; ESLint and strict production TypeScript/build pass; 18 in-app lifecycle checks pass. Ten thousand synthetic resolver lookups tested without creating ten thousand vault files. Folder Notes configuration interop is unit-tested against the inspected schema; real enabled Folder Notes and mobile remain unverified. Compatibility details and evidence are in verification.md.
