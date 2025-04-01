import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: resolve(__dirname, "src"), // assumes your client code is under /src
  resolve: {
    alias: {
      "three/examples/jsm": fileURLToPath(
        new URL("node_modules/three/examples/jsm", import.meta.url),
      ),
    },
  },
  server: {
    open: false,
  },
  build: {
    outDir: resolve(__dirname, "dist"),
  },
});
