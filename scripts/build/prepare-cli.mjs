import { chmod } from "node:fs/promises";

await chmod("dist/launcher/main.js", 0o755);
