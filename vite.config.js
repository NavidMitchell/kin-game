import { defineConfig } from 'vite';

// `npm run build` writes a normal multi-file site to dist/web.
// `npm run build:standalone` inlines every asset as a data URI, then tools/inline.mjs
// folds the script into the page to produce one self-contained dist/kin-runner.html.
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  return {
    base: './',
    build: {
      outDir: standalone ? 'dist/.standalone' : 'dist/web',
      emptyOutDir: true,
      assetsInlineLimit: standalone ? Number.MAX_SAFE_INTEGER : 4096,
      chunkSizeWarningLimit: 4000,
    },
  };
});
