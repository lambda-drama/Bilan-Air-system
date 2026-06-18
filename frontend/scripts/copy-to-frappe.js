import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cpSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.join(__dirname, "../out");
const publicFrontendDir = path.join(__dirname, "../../bilan_sky/public/frontend");

function fixFaviconPaths(html) {
	const favicon = "/assets/bilan_sky/frontend/favicon.svg";
	return html.replace(
		/href="\/(?:favicon\.svg|icon\.svg|icon-light-32x32\.png|icon-dark-32x32\.png|apple-icon\.png)"/g,
		`href="${favicon}"`,
	);
}

function collectHtmlRelPaths(srcDir, relBase = "") {
	const paths = new Set();

	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			if (entry.name === "_next") continue;
			for (const nested of collectHtmlRelPaths(path.join(srcDir, entry.name), relPath)) {
				paths.add(nested);
			}
			continue;
		}

		if (!entry.name.endsWith(".html")) continue;
		if (entry.name === "404.html") continue;
		paths.add(relPath);
	}

	return paths;
}

function pruneStaleHtmlFiles(expectedRelPaths, destDir, relBase = "") {
	if (!fs.existsSync(destDir)) return;

	for (const entry of fs.readdirSync(destDir, { withFileTypes: true })) {
		if (entry.name === "_next") continue;

		const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
		const fullPath = path.join(destDir, entry.name);

		if (entry.isDirectory()) {
			pruneStaleHtmlFiles(expectedRelPaths, fullPath, relPath);
			if (fs.readdirSync(fullPath).length === 0) {
				fs.rmdirSync(fullPath);
			}
			continue;
		}

		if (!entry.name.endsWith(".html")) continue;
		if (!expectedRelPaths.has(relPath)) {
			fs.unlinkSync(fullPath);
			console.log("Removed stale HTML:", relPath);
		}
	}
}

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
		const html = fixFaviconPaths(fs.readFileSync(srcPath, "utf8"));
		fs.writeFileSync(destPath, html);
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

const expectedHtmlPaths = collectHtmlRelPaths(outDir);
pruneStaleHtmlFiles(expectedHtmlPaths, publicFrontendDir);
copyHtmlFiles(outDir, publicFrontendDir);
console.log("Copied route HTML files to bilan_sky/public/frontend/");

copyStaticFiles(outDir, publicFrontendDir);
console.log("Copied static assets to bilan_sky/public/frontend/");
console.log("Frappe serves pages via www/bilan_frontend.py (path-based HTML)");
