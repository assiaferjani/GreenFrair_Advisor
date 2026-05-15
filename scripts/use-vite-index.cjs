const fs = require("node:fs");
const path = require("node:path");

fs.copyFileSync(path.join(process.cwd(), "index.vite.html"), path.join(process.cwd(), "index.html"));
