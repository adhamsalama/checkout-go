// jeep-sqlite (the browser implementation of @capacitor-community/sqlite) bundles an older
// sql.js build and loads its wasm from /assets at runtime. The wasm must match that build:
// sql.js >= 1.13 fails with a LinkError, hence the pinned "sql.js-jeep" alias.
// (The legacy importer uses the regular sql.js package and imports its own wasm.)
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/assets", { recursive: true });
copyFileSync("node_modules/sql.js-jeep/dist/sql-wasm.wasm", "public/assets/sql-wasm.wasm");
