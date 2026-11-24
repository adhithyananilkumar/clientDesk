# Features

Each product capability is a self-contained module. Screens in `src/app` stay thin and only
compose what a feature exports.

```
features/<name>/
├── screens/       route-level screens (imported by the files in src/app)
├── components/    UI used only by this feature
├── hooks/         feature state and queries
├── repository.ts  data access: local SQLite + Supabase (via src/database, src/services)
├── types.ts       feature types
└── index.ts       the feature's public API; import from here, never from deeper paths
```

Rules of thumb

- A feature may use `components/`, `hooks/`, `services/`, `database/`, `constants/`, `utils/`,
  `validation/` and `types/`, but never another feature's internals. Share through `index.ts`.
- Anything needed by two or more features moves up into `components/`, `hooks/` or `utils/`.
- Folders containing only a `.gitkeep` are reserved for upcoming work.
