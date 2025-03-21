import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'src'), // assumes your client code is under /src
  server: {
    open: false
  },
  build: {
    outDir: resolve(__dirname, 'dist')
  }
});
