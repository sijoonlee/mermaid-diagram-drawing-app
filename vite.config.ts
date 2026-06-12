import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset URLs so the build works from any path
  // (e.g. https://<user>.github.io/<repo>/)
  base: './',
  server: { port: 5173, open: true },
});
