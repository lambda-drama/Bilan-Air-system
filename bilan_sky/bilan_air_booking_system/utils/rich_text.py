"""Convert Desk Text Editor (Quill) HTML to plain text for portal text fields."""

from __future__ import annotations

import re

from frappe.utils import strip_html


def rich_text_to_plain(text: str | None) -> str:
	"""Strip HTML from Text Editor fields; preserve basic line breaks."""
	if not text:
		return ""
	html = str(text)
	html = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
	html = re.sub(r"</(?:p|div|li|h[1-6]|tr)[^>]*>", "\n", html, flags=re.IGNORECASE)
	plain = strip_html(html)
	plain = re.sub(r"[ \t]+\n", "\n", plain)
	plain = re.sub(r"\n{3,}", "\n\n", plain)
	return plain.strip()
