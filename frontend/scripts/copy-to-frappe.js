import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cpSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.join(__dirname, "../out");
const publicFrontendDir = path.join(__dirname, "../../bilan_sky/public/frontend");

function copyHtmlFiles(srcDir, destDir) {
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const srcPath = path.join(srcDir, entry.name);

		if (entry.isDirectory()) {
			if (entry.name === "_next") continue;
			copyHtmlFiles(srcPath, path.join(destDir, entry.name));
			continue;
		}

		if (!entry.name.endsWith(".html")) continue;
		if (entry.name === "404.html") continue;

		const destPath = path.join(destDir, entry.name);
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.copyFileSync(srcPath, destPath);
	}
}

function copyStaticFiles(srcDir, destDir) {
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		if (entry.name.endsWith(".html") || entry.name.endsWith(".txt")) continue;
		if (entry.name.startsWith("__next")) continue;

		fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
	}
}

const srcNextDir = path.join(outDir, "_next");
const destNextDir = path.join(publicFrontendDir, "_next");

if (!fs.existsSync(srcNextDir)) {
	console.error('Build output not found at', srcNextDir, '- run "yarn build" first');
	process.exit(1);
}

fs.mkdirSync(publicFrontendDir, { recursive: true });

if (fs.existsSync(destNextDir)) {
	fs.rmSync(destNextDir, { recursive: true });
}
cpSync(srcNextDir, destNextDir, { recursive: true });
console.log("Copied _next/ assets to bilan_sky/public/frontend/_next/");

copyHtmlFiles(outDir, publicFrontendDir);
console.log("Copied route HTML files to bilan_sky/public/frontend/");

copyStaticFiles(outDir, publicFrontendDir);
console.log("Copied static assets to bilan_sky/public/frontend/");
console.log("Frappe serves pages via www/bilan_frontend.py (path-based HTML)");
