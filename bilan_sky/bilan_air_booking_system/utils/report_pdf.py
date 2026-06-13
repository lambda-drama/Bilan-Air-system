# Copyright (c) 2026, NF and contributors

import base64
import html
from datetime import datetime

import frappe
from frappe import _
from frappe.utils.pdf import get_pdf


def export_tabular_report_pdf(title, subtitle, columns, rows, filename=None):
	"""Render rows to a PDF file and return base64 content for portal download."""
	title = (title or "Report").strip()
	subtitle = (subtitle or "").strip()
	columns = columns or []
	rows = rows or []

	if not rows:
		frappe.throw(_("No data to export."))
	if not columns:
		frappe.throw(_("Report columns are required."))

	safe_filename = (filename or f"{title.lower().replace(' ', '-')}.pdf").strip()
	if not safe_filename.lower().endswith(".pdf"):
		safe_filename += ".pdf"

	html_doc = _render_tabular_report_html(title, subtitle, columns, rows)
	try:
		pdf_bytes = get_pdf(html_doc)
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "Portal report PDF export failed")
		frappe.throw(_("Could not generate PDF. {0}").format(str(exc)))

	return {
		"filename": safe_filename,
		"content": base64.b64encode(pdf_bytes).decode("ascii"),
	}


def _cell_value(row, column):
	key = column.get("key") if isinstance(column, dict) else None
	if not key:
		return ""
	value = row.get(key) if isinstance(row, dict) else ""
	return "" if value is None else str(value)


def _render_tabular_report_html(title, subtitle, columns, rows):
	generated_at = datetime.now().strftime("%d %b %Y %H:%M")
	col_headers = "".join(
		f"<th>{html.escape(str(col.get('label') or col.get('key') or ''))}</th>"
		for col in columns
	)
	body_rows = []
	for index, row in enumerate(rows, start=1):
		cells = "".join(
			f"<td>{html.escape(_cell_value(row, col))}</td>" for col in columns
		)
		body_class = "even" if index % 2 == 0 else "odd"
		body_rows.append(f'<tr class="{body_class}">{cells}</tr>')

	subtitle_html = (
		f'<p class="subtitle">{html.escape(subtitle)}</p>' if subtitle else ""
	)

	return f"""<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8" />
	<style>
		@page {{
			size: A4 landscape;
			margin: 10mm 12mm;
		}}
		body {{
			font-family: Helvetica, Arial, sans-serif;
			font-size: 9px;
			color: #0f1f3d;
			margin: 0;
		}}
		.header {{
			background: #0f2b5b;
			color: #ffffff;
			padding: 12px 14px;
			margin-bottom: 10px;
		}}
		.header h1 {{
			margin: 0;
			font-size: 16px;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}}
		.subtitle {{
			margin: 6px 0 0;
			font-size: 10px;
			color: #dbe7ff;
		}}
		.meta {{
			margin: 0 0 10px;
			font-size: 9px;
			color: #4b5d7a;
		}}
		table {{
			width: 100%;
			border-collapse: collapse;
		}}
		th {{
			background: #e8eef8;
			color: #0f2b5b;
			text-align: left;
			padding: 6px 5px;
			border: 1px solid #c5d0e6;
			font-size: 8px;
			text-transform: uppercase;
		}}
		td {{
			padding: 5px;
			border: 1px solid #d7deec;
			vertical-align: top;
			word-break: break-word;
		}}
		tr.odd td {{
			background: #ffffff;
		}}
		tr.even td {{
			background: #f7f9fc;
		}}
	</style>
</head>
<body>
	<div class="header">
		<h1>{html.escape(title)}</h1>
		{subtitle_html}
	</div>
	<p class="meta">Generated {html.escape(generated_at)} · {len(rows)} record(s)</p>
	<table>
		<thead><tr>{col_headers}</tr></thead>
		<tbody>{"".join(body_rows)}</tbody>
	</table>
</body>
</html>"""
