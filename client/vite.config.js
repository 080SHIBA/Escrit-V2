import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Explicit rather than relying on the default: the automatic JSX
  // runtime means no file needs `import React from 'react'` just to
  // use JSX. If this ever reads "classic" instead, every component
  // will throw "React is not defined" at runtime, since none of them
  // import React by name.
  plugins: [react({ jsxRuntime: 'automatic' })],
  server: {
    port: 5173,
    proxy: {
      // Keep the client proxy aligned with the server's dev port so auth,
      // password reset, and checkout requests do not fail on a mismatched port.
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
  // vite.config.js
  build: {
    chunkSizeWarningLimit: 1000, // raises limit to 1000 kB (1 MB)
  },
});
