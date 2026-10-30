import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "node:path";
import fs from "node:fs";

// Discover the icons actually used by the app before the dev server starts.
// This avoids optimizer reloads when a lazily loaded page first imports an icon.
const sourceDir = path.resolve(__dirname, "src");
const iconDependencies = [...new Set(fs.readdirSync(sourceDir, { recursive: true })
  .filter(file => /\.[jt]sx?$/.test(file) && !/(^|[\\/])test[\\/]/.test(file))
  .flatMap(file => [...fs.readFileSync(path.join(sourceDir, file), "utf8").matchAll(/from\s*["'](@mui\/icons-material\/[^"']+)["']/g)].map(match => match[1])))];

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, "..");
  const env = loadEnv(mode, envDir, ["VITE_", "REACT_APP_", "WEB_"]);
  const port = parseInt(env.WEB_PORT || process.env.WEB_PORT || "3100", 10);
  const apiUrl = env.REACT_APP_API_URL || process.env.REACT_APP_API_URL || "http://localhost:3001";

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
      // Remove @mui/icons-material mock so real esbuild-bundled icons are used
      transformed = transformed.replace(
        /(?:jest|vi)\.mock\(\s*["']@mui\/icons-material["'][\s\S]*?\);/g,
        ""
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
      include: iconDependencies,
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
    server: {
      port,
      host: "0.0.0.0",
      strictPort: false,
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
      testTimeout: 30000,
      // jsdom workers are memory hungry; letting Vitest spawn one per CPU
      // starves the main thread and causes spurious onTaskUpdate timeouts.
      maxWorkers: process.env.CI ? 2 : 4,
      minWorkers: 1,
      include: ["src/**/*.{test,spec}.{js,jsx}"],
      exclude: ["node_modules", "dist"],
    },
  };
});
