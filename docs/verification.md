# Verification

Environment: macOS 26.6.2 ARM, Obsidian 1.13.7, native Default theme. All vault operations used the existing development test vault. Initial development verification used only the test vault; production deployment was performed afterward on explicit user request.

## Automated checks

35 tests across 8 suites pass, including 16 preserved upstream tests. Production TypeScript check/build and ESLint pass. Coverage includes nearest ancestor resolution; remove/nested overrides; subtree rename/move/delete boundaries; Unicode, accents, spaces, punctuation and quoted paths; safe hex/RGB parsing; deterministic suggestions; migration preservation; inside/outside/custom-template Folder Notes; group/native fallback; late nodes and disabled views; no per-frame resolution; foreign/frozen wrappers; failed/concurrent saves; and Explorer title-only styling. A 10,000-note resolver workload passes (synthetic paths, not 10,000 files).

## Running Obsidian

See [machine-readable runtime report](runtime-verification.json): **18 checks, all passed**. The temporary development-only runner invoked the loaded plugin and inspected native renderer getFillColor results. It used a separate Runtime QA folder, restored original coloring settings, and trashed temporary fixtures. The runner was then disabled and moved out of the vault.

Verified global blue inheritance and orange nested overrides; Local Graph; blue→purple with an open graph; removal restoring inherited color; outside sibling folder note; native vs folder precedence using an ephemeral native node.color (no persisted group creation); unchanged uncolored nodes; new notes; Unicode folder rename and matching note rename; folder move; new descendants; unload/native restoration; plugin reload; delete pruning; byte-for-byte unchanged graph.json; and unchanged original fixture Markdown hashes. Graph settings were read only for verification, never written by the coloring plugin or runner.

Manual checks: upstream right-click workflow and persistence before features; Suggested Blue and then Suggested Orange with Apply; folder title text only (normal files and arrows); Global and Local Graph screenshots; palette add/name/reorder/remove/reset; assigned colors preserved by reset; light and dark native themes without color mutation; full Obsidian quit/reopen with final build, retaining blue/orange in both graph and Explorer. The original light scheme was restored. A macOS clipboard timing issue during UI automation briefly pasted the supplied project brief into a temporary swatch name; resetting removed it, and direct field input verified naming successfully.

Original File Color remains installed with its distinct ID, disabled for fork tests. Existing Calendar Hub configuration and original test-vault notes were not edited for coloring.

## Limits

Graph hooks use guarded private APIs; confirmed only on Obsidian 1.13.7 desktop/macOS. Other versions/mobile and real enabled Folder Notes interoperability have not been manually validated. Folder Notes setting-based correspondence is unit-tested; same-name fallback works in actual Graph. Unsupported Folder Notes storage/types and pattern exclusions are documented. Native group precedence uses native node.color, so another runtime coloring plugin that overrides only getFillColor may still conflict; foreign wrappers are preserved and made safe on unload.

No personal note contents, vault data, generated bundles or dependency directories are tracked in Git. The MIT license is unchanged. After explicit user approval, implementation commits were pushed to origin/master and the production build was installed and enabled using `.obsidian-mac`. Upstream push remains disabled. The real-vault settings/menu preview and configuration preservation were checked; no folder color was assigned during that preview.
