import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Custom plugin that skips public files whose names contain spaces (EAGAIN on some filesystems)
function skipSpacedPublicFiles() {
  return {
    name: 'skip-spaced-public-files',
    enforce: 'pre' as const,
    configResolved(config: { publicDir: string; build: { outDir: string } }) {
      const origCopy = fs.copyFileSync.bind(fs);
      (fs as unknown as Record<string, unknown>).copyFileSync = (src: fs.PathLike, dest: fs.PathLike, ...rest: unknown[]) => {
        const srcStr = String(src);
        if (srcStr.includes(' ')) return;
        return (origCopy as (...a: unknown[]) => unknown)(src, dest, ...rest);
      };
      void config;
    },
  };
}

export default defineConfig({
  plugins: [react(), skipSpacedPublicFiles()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
