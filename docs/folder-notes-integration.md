# Folder Notes integration

Inspected [LostPaul/obsidian-folder-notes](https://github.com/LostPaul/obsidian-folder-notes), `src/functions/folderNoteFunctions.ts` and `src/settings/SettingsTab.ts`. This reference is AGPL-3.0; no code was copied and no dependency is bundled. Its module-level getFolderNote helper is not a documented public plugin API.

The adapter reads an enabled folder-notes instance's settings through a guarded registry lookup. Supported: insideFolder and parentFolder storage, Markdown notes, same-name and static/prefix/suffix basename templates using {{folder_name}}. Explicit disabled/detached folder entries and subFolders exclusions are honored. Unsupported storage/type configurations safely omit special correspondence; vaultFolder is not claimed (the current lookup helper does not clearly implement it). Glob/regex exclusion patterns and non-Markdown folder notes are not supported. Invalid path templates are rejected.

Without an active plugin, automatic convention checks Folder/Folder.md first and then sibling Folder.md. A settings dropdown can constrain this fallback to inside or outside. Existing files only; ambiguous matches are discarded. An outside folder note resolves from its corresponding folder before normal filesystem inheritance, including nearest ancestor overrides.

Include folder notes disables special correspondence. Inside-folder notes still inherit like all contained Markdown notes. Creation/deletion/rename and layout changes rebuild the index; a lightweight configuration signature check detects changes made in Folder Notes settings. Nothing is created, moved, renamed, or saved in Folder Notes. No note contents/frontmatter are inspected.
