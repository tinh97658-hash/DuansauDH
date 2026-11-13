import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, "..");
  const env = loadEnv(mode, envDir, ["VITE_", "REACT_APP_", "WEB_"]);
  const port = parseInt(env.WEB_PORT || process.env.WEB_PORT || "3100", 10);
  const apiUrl = env.REACT_APP_API_URL || process.env.REACT_APP_API_URL || "/api";
  const apiProxyTarget = process.env.API_PROXY_TARGET || "http://127.0.0.1:3001";

  const vitestJestCompat = {
    name: "vitest-jest-compat",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("/test/") && !id.includes("\\test\\")) return null;
      if (!/\.[jt]sx?$/.test(id)) return null;

      let transformed = code;
      // Legacy CommonJS factories must expose the default imported by ESM.
      transformed = transformed.replace(
        /(?:jest|vi)\.mock\(\s*["']axios["']\s*,\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\)\s*\);/g,
        (match, body) => /\bdefault\s*:/.test(body) ? match : `vi.mock("axios", () => ({ default: { ${body} } }));`,
      );
      // Normalize FeatureLayout mocks
      transformed = transformed.replace(
        /(?:jest|vi)\.mock\(\s*["'][^"']*components\/FeatureLayout["'][\s\S]*?\);/g,
        'vi.mock("../../components/FeatureLayout", () => ({ default: ({ children }) => <div>{children}</div> }));'
      );
      // Normalize function component mock factories: () => function Name(...) { ... }
      transformed = transformed.replace(
        /(?:jest|vi)\.mock\(\s*(["'][^"']+["']),\s*\(\)\s*=>\s*function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}\s*\);/g,
        'vi.mock($1, () => ({ default: function $2($3) { $4 } }));'
      );
      // Normalize arrow component mock factories: () => ({ children }) => ...
      transformed = transformed.replace(
        /(?:jest|vi)\.mock\(\s*(["'][^"']+["']),\s*\(\)\s*=>\s*\(\{\s*children\s*\}\)\s*=>\s*([^;]+)\);/g,
        'vi.mock($1, () => ({ default: ({ children }) => $2 }));'
      );
      // Replace remaining jest.mock with vi.mock
      transformed = transformed.replace(/\bjest\.mock\(/g, "vi.mock(");
      return { code: transformed, map: null };
    },
  };

  return {
    envDir,
    // Worktrees may share node_modules via a junction. Keep optimizer caches
    // separate from other servers and from Vitest to avoid mixed React chunks.
    cacheDir: path.resolve(__dirname, "../.tmp/vite-cache", mode),
    resolve: { dedupe: ["react", "react-dom", "@emotion/react", "@emotion/styled"] },
    envPrefix: ["VITE_", "REACT_APP_"],
    plugins: [
      vitestJestCompat,
      react({
        include: /\.(jsx|js)$/,
      }),
      svgr({
        svgrOptions: {
          exportType: "named",
          ref: true,
          svgo: false,
          titleProp: true,
        },
        include: "**/assets/icons/**/*.svg",
      }),
    ],
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      // Only scan the app entry, not legacy build/public HTML in this workspace.
      entries: ["index.html"],
      // Initialize MUI's styling engine in the same pre-bundle as its components.
      // Icon/deep imports can otherwise evaluate Popper before styled is ready.
      include: ["@emotion/react", "@emotion/styled", "@mui/material", "@mui/material/styles", "@heroicons/react/24/outline"],
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          rewrite: requestPath => requestPath.replace(/^\/api(?=\/|$)/, ""),
        },
      },
      port,
      host: "0.0.0.0",
      strictPort: false,
      watch: {
        ignored: ["**/build/**", "**/node_modules-before-*/**"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
    },
    define: {
      "process.env.REACT_APP_API_URL": JSON.stringify(apiUrl),
      "process.env.PUBLIC_URL": JSON.stringify(""),
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/setupTests.js",
      css: true,
      clearMocks: true,
      testTimeout: 25000,
      include: ["src/**/*.{test,spec}.{js,jsx}"],
      exclude: ["node_modules", "dist"],
    },
  };
});
