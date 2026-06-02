# Copyright (c) 2026, NF and contributors

"""HTTP client for the external ERPNext accounting site (BA Settings)."""

from __future__ import annotations

import json
import time
from typing import Any
from urllib.parse import quote, urljoin

import frappe
import requests
from frappe import _


def _get_ba_settings_doc(settings=None):
	"""BA Settings single doc (pass a doc in tests, otherwise load from DB)."""
	if settings is not None:
		return settings
	return frappe.get_single("BA Settings")


def _remote_credentials(settings=None) -> tuple[str, str] | None:
	"""API key + secret from Password fields (never read from plain columns)."""
	doc = _get_ba_settings_doc(settings)
	api_key = doc.get_password("api_key", raise_exception=False)
	api_secret = doc.get_password("secret_key", raise_exception=False)
	if not api_key or not api_secret:
		return None
	return api_key, api_secret


def remote_accounting_config(settings=None) -> dict | None:
	"""Return connection config when remote accounting is fully configured."""
	doc = _get_ba_settings_doc(settings)
	site_url = (doc.site_url or "").strip()
	company = (doc.company or "").strip()
	credentials = _remote_credentials(doc)
	if not all([site_url, company, credentials]):
		return None
	api_key, api_secret = credentials
	return {
		"site_url": _normalize_site_url(site_url),
		"company": company,
		"api_key": api_key,
		"api_secret": api_secret,
		"settings": doc,
	}


def is_remote_accounting_enabled(settings=None) -> bool:
	return remote_accounting_config(settings) is not None


def _normalize_site_url(url: str) -> str:
	url = (url or "").strip().rstrip("/")
	if not url.startswith(("http://", "https://")):
		url = f"https://{url}"
	return url


def _encode_docname(name: str) -> str:
	"""Encode document name for /api/resource/{doctype}/{name} (spaces, slashes, etc.)."""
	return quote((name or "").strip(), safe="")


class RemoteERPClient:
	def __init__(self, config: dict | None = None):
		config = config or remote_accounting_config()
		if not config:
			frappe.throw(
				_("Set Site URL, API Key, Secret Key, and Company on BA Settings to use remote accounting."),
				title=_("Remote accounting not configured"),
			)

		self.settings = config.get("settings") or _get_ba_settings_doc()
		self.base_url = config["site_url"]
		self.company = config["company"]

		credentials = _remote_credentials(self.settings)
		if not credentials:
			frappe.throw(
				_("API Key and Secret Key are required on BA Settings (Password fields)."),
				title=_("Remote accounting not configured"),
			)
		api_key, api_secret = credentials
		self._auth = (api_key, api_secret)

		self._session = requests.Session()
		self._session.auth = self._auth
		self._timeout = 60

	def request(
		self,
		method: str,
		path: str,
		*,
		params: dict | None = None,
		json_body: dict | None = None,
		data: dict | None = None,
	) -> Any:
		url = urljoin(self.base_url + "/", path.lstrip("/"))
		try:
			response = self._session.request(
				method.upper(),
				url,
				params=params,
				json=json_body,
				data=data,
				timeout=self._timeout,
				headers={"Accept": "application/json"},
			)
		except requests.RequestException as exc:
			frappe.throw(_("Could not reach accounting site {0}: {1}").format(self.base_url, exc))

		if response.status_code >= 400:
			message = response.text
			try:
				payload = response.json()
				message = payload.get("exception") or payload.get("message") or message
			except Exception:
				pass
			frappe.throw(_("Accounting site error ({0}): {1}").format(response.status_code, message))

		if not response.text:
			return {}
		try:
			return response.json()
		except json.JSONDecodeError:
			return {"message": response.text}

	def get_count(
		self,
		doctype: str,
		*,
		filters: list | dict | None = None,
	) -> int:
		kwargs: dict[str, Any] = {"doctype": doctype}
		if filters:
			kwargs["filters"] = json.dumps(filters)
		message = self.run_method("frappe.client.get_count", **kwargs)
		try:
			return int(message or 0)
		except (TypeError, ValueError):
			return 0

	def get_list(
		self,
		doctype: str,
		*,
		filters: list | dict | None = None,
		fields: list[str] | None = None,
		limit: int = 100,
		order_by: str | None = None,
	) -> list[dict]:
		params: dict[str, Any] = {
			"limit_page_length": limit,
		}
		if fields:
			params["fields"] = json.dumps(fields)
		if filters:
			params["filters"] = json.dumps(filters)
		if order_by:
			params["order_by"] = order_by

		payload = self.request("GET", f"/api/resource/{doctype}", params=params)
		return payload.get("data") or []

	def get_doc(self, doctype: str, name: str) -> dict:
		encoded = _encode_docname(name)
		payload = self.request("GET", f"/api/resource/{doctype}/{encoded}")
		return payload.get("data") or {}

	def insert_doc(self, doc: dict) -> dict:
		"""Insert document via frappe.client.insert (handles validation/child tables)."""
		message = self.run_method("frappe.client.insert", doc=json.dumps(doc))
		if isinstance(message, str):
			message = json.loads(message)
		if not isinstance(message, dict):
			frappe.throw(_("Unexpected response when creating {0} on accounting site.").format(doc.get("doctype")))
		return message

	def insert(self, doc: dict) -> str:
		created = self.insert_doc(doc)
		return created.get("name") or doc.get("name") or doc.get("item_code")

	def submit(self, doctype: str, name: str) -> None:
		"""Submit a document using the latest version from the accounting site."""
		last_error: Exception | None = None
		for attempt in range(3):
			doc = self.get_doc(doctype, name)
			if doc.get("docstatus") == 1:
				return
			try:
				self.request(
					"POST",
					"/api/method/frappe.client.submit",
					data={"doc": json.dumps(doc)},
				)
				return
			except frappe.ValidationError as exc:
				last_error = exc
				msg = str(exc)
				if "TimestampMismatch" not in msg or attempt >= 2:
					raise
				time.sleep(0.25)
		if last_error:
			raise last_error

	def run_method(self, method: str, **kwargs) -> Any:
		payload = self.request("POST", f"/api/method/{method}", data=kwargs)
		return payload.get("message")

	def doc_exists(self, doctype: str, name: str) -> bool:
		"""Check existence via list API (reliable for names with spaces)."""
		if not name:
			return False
		if self.get_list(doctype, filters={"name": name}, fields=["name"], limit=1):
			return True
		if doctype == "Item":
			return bool(
				self.get_list(doctype, filters={"item_code": name}, fields=["name"], limit=1)
			)
		return False


def get_remote_client() -> RemoteERPClient:
	return RemoteERPClient()
