import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicFrontendDir = path.join(__dirname, "../../bilan_sky/public/frontend");
const nextDir = path.join(publicFrontendDir, "_next");

function listHtmlFiles(dir) {
	const files = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "_next") continue;
			files.push(...listHtmlFiles(fullPath));
			continue;
		}
		if (entry.name.endsWith(".html") && entry.name !== "404.html" && entry.name !== "_not-found.html") {
			files.push(fullPath);
		}
	}
	return files;
}

function chunkRefsFromHtml(html) {
	const refs = new Set();
	const patterns = [
		/\/assets\/bilan_sky\/frontend\/(_next\/static\/chunks\/[A-Za-z0-9_./-]+\.js)/g,
		/"static\/chunks\/([A-Za-z0-9_./-]+\.js)"/g,
	];
	for (const pattern of patterns) {
		for (const match of html.matchAll(pattern)) {
			refs.add(match[1]);
		}
	}
	return [...refs];
}

if (!fs.existsSync(nextDir)) {
	console.error("Missing frontend build output at", nextDir);
	process.exit(1);
}

const missing = [];
for (const htmlPath of listHtmlFiles(publicFrontendDir)) {
	const html = fs.readFileSync(htmlPath, "utf8");
	for (const ref of chunkRefsFromHtml(html)) {
		const assetPath = path.join(publicFrontendDir, ref);
		if (!fs.existsSync(assetPath)) {
			missing.push({ html: path.relative(publicFrontendDir, htmlPath), asset: ref });
		}
	}
}

if (missing.length) {
	console.error("Frontend build verification failed. HTML references missing assets:");
	for (const item of missing) {
		console.error(`- ${item.html} -> ${item.asset}`);
	}
	console.error('Run "yarn build" from frontend/ to regenerate HTML and _next together.');
	process.exit(1);
}

console.log("Frontend build verification passed.");
