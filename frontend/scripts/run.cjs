const path = require("node:path");
const { createRequire } = require("node:module");

const scriptsRequire = createRequire(require.resolve("react-scripts/package.json"));
const dotenv = scriptsRequire("dotenv");
const expand = scriptsRequire("dotenv-expand");
const result = dotenv.config({ path: path.resolve(__dirname, "../../.env") });
if (result.error) throw result.error;
expand(result);
if (!process.env.WEB_PORT || !process.env.REACT_APP_API_URL) {
  throw new Error("Set WEB_PORT and REACT_APP_API_URL in the root .env");
}
process.env.PORT = process.env.WEB_PORT;
require("react-scripts/bin/react-scripts.js");
