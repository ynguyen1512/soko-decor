import { defineConfig } from 'vite'

// base './' keeps asset URLs relative so the build also works on GitHub Pages sub-paths.
// three.js alone is ~600 kB minified (≈165 kB gzip), so the default 500 kB warning is expected.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 800 },
})
