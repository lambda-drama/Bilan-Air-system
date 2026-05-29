import os
import re

import frappe

FRONTEND_ROOT = os.path.join(
	frappe.get_app_path("bilan_sky"),
	"public",
	"frontend",
)


def get_context(context):
	context.no_cache = 1
	context.csrf_token = frappe.sessions.get_csrf_token()
	context.frontend_html = _get_frontend_html(context.csrf_token)
	return context


def _get_route_path() -> str:
	app_path = frappe.form_dict.get("app_path") or ""
	if isinstance(app_path, str):
		route = app_path.strip("/")
		# Home page resolves to this www route name; not a Next.js path segment.
		if route in ("", "bilan_frontend"):
			return ""
		return route
	return ""


def _resolve_html_file(route_path: str) -> str:
	candidates = []
	if route_path:
		candidates.append(f"{route_path}.html")
		candidates.append(os.path.join(route_path, "index.html"))
	candidates.append("index.html")

	for name in candidates:
		full_path = os.path.join(FRONTEND_ROOT, name)
		if os.path.isfile(full_path):
			return full_path

	frappe.throw("Bilan frontend page not found. Run yarn build from the app root.", frappe.PageDoesNotExistError)


def _inject_csrf(html: str, csrf_token: str) -> str:
	html = html.replace("{{ csrf_token }}", csrf_token)

	if 'name="csrf-token"' not in html:
		html = re.sub(
			r'(<meta name="viewport"[^>]*>)',
			f'\\1\n    <meta name="csrf-token" content="{csrf_token}" />',
			html,
			count=1,
			flags=re.IGNORECASE,
		)

	if "window.csrf_token" not in html:
		html = re.sub(
			r"</body>",
			f'  <script>window.csrf_token = "{csrf_token}";</script>\n</body>',
			html,
			count=1,
			flags=re.IGNORECASE,
		)

	return html


def _get_frontend_html(csrf_token: str) -> str:
	route_path = _get_route_path()
	html_path = _resolve_html_file(route_path)

	with open(html_path, encoding="utf-8") as html_file:
		html = html_file.read()

	return _inject_csrf(html, csrf_token)
