import { defineConfig } from 'tsup'

/*
 * Bundling (rather than plain tsc) is what keeps the Docker image simple: the
 * workspace-linked @elegantsip/shared source is compiled straight into dist, so
 * the runtime stage needs no symlinks and no monorepo layout at all.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Keep node_modules external — bundling native/dynamic deps breaks them.
  skipNodeModulesBundle: true,
  noExternal: [/@elegantsip\//],
})
