# rolldown-plugin-relay

A Rolldown/Vite 8 plugin that tries to be a drop-in replacement for `babel-plugin-relay`

Given a file containing `graphql` tagged template literals, the plugin replaces each tag with an import of the corresponding Relay compiler artifact. This is the same transform that `babel-plugin-relay` performs, implemented as a native Rolldown plugin using OXC for parsing

## Install

```bash
npm install rolldown-plugin-relay
```

`graphql` and `rolldown` (or `vite` v8+) are peer dependencies

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import relay from 'rolldown-plugin-relay'

export default defineConfig({
  plugins: [
    react(),
    relay(),
  ],
})
```

Then remove `babel-plugin-relay` from your Babel/Vite config and dependencies

## Options

All options are optional. Defaults match `babel-plugin-relay`

| Option | Type | Default | Description |
|---|---|---|---|
| `artifactDirectory` | `string` | `undefined` | Custom artifact directory. When unset, uses colocated `__generated__/` folders |
| `isDev` | `boolean` | `true` | Emit runtime hash staleness warnings |
| `isDevVariableName` | `string` | `undefined` | Gate dev warnings behind a runtime variable (e.g. `"__DEV__"`) instead of a build-time boolean |
| `eagerEsModules` | `boolean` | `true` | Generates `import` declarations. When `false`, generates memoized `require()` calls instead |
| `jsModuleFormat` | `"commonjs" \| "haste"` | `undefined` | When `"haste"`, uses bare filenames for artifact imports |
| `codegenCommand` | `string` | `"relay-compiler"` | Command name shown in staleness warning messages |
| `legacyFiltering` | `boolean` | `false` | Enable handler-side filtering for older Rollup/Vite versions that don't support [hook filters](https://rolldown.rs/apis/plugin-api/hook-filters) |

Note: `eagerEsModules` defaults to `true`, same as the Babel plugin as of ~v19

## Vite 8 compatibility

Vite 8 uses Rolldown internally but does not currently pass `meta.ast` to plugin transform hooks (as far as I can tell). The plugin falls back to parsing with `oxc-parser` in this case. If Vite exposes `meta.ast` in a future release, the fallback will be skipped automatically

## Developing

### Setup
```bash
pnpm install
```

### Testing
```bash
pnpm test
```

Update snapshots:
```bash
pnpm test -- -u
```

### Building
```bash
pnpm lint
pnpm build
```

## License

MIT
