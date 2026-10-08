# Admin interaction previews

Development-only previews render production components with explicitly labelled fixture data. They never bypass route or API authorization.

- `/design-preview/admin-controls`: UIArc FilterToolbar mapped to content query parameters; Cult CopyButton on sample input.
- `/design-preview/editor`: the actual ArticleEditor, including full-input copy in Publishing and management.
- `/design-preview/onboarding`: the official Cult multi-step guide with employee and admin fixture modes.

Production integration: content filters in TasksFilters; copying in ArticleEditor and InputBackup; usage guides in the signed-in account menu. The shared JUYU visual tokens and the published Fumadocs reader controls are preserved.
