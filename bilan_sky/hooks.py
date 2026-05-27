app_name = "bilan_sky"
app_title = "Bilan Air Booking System"
app_publisher = "NF"
app_description = "Air booking system"
app_email = "maniajrmania@gmail.com"
app_license = "mit"

# Fixtures (exported with: bench --site <site> export-fixtures)
fixtures = [
	{
		"dt": "Role",
		"filters": [
			[
				"name",
				"in",
				[
					"Booking Agent",
					"Check-in Agent",
					"Crew Member",
					"Support Agent",
					"Pricing Manager",
					"Baggage Handler",
				],
			]
		],
	},
]

# Apps
# ------------------

# required_apps = []

add_to_apps_screen = [
	{
		"name": "bilan_sky",
		"logo": "/assets/bilan_sky/image/logo_1.jpg",
		"title": "Bilan Air",
		"route": "/bilan",
	},
]

website_route_rules = [
	{"from_route": "/bilan", "to_route": "bilan_frontend"},
	{"from_route": "/bilan/<path:app_path>", "to_route": "bilan_frontend"},
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/bilan_sky/css/bilan_sky.css"
# app_include_js = "/assets/bilan_sky/js/bilan_sky.js"

# include js, css files in header of web template
# web_include_css = "/assets/bilan_sky/css/bilan_sky.css"
# web_include_js = "/assets/bilan_sky/js/bilan_sky.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "bilan_sky/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "bilan_sky/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "bilan_sky.utils.jinja_methods",
# 	"filters": "bilan_sky.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "bilan_sky.install.before_install"
# after_install = "bilan_sky.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "bilan_sky.uninstall.before_uninstall"
# after_uninstall = "bilan_sky.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "bilan_sky.utils.before_app_install"
# after_app_install = "bilan_sky.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "bilan_sky.utils.before_app_uninstall"
# after_app_uninstall = "bilan_sky.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "bilan_sky.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# hooks.py

#Will check later if we need to add scheduled tasks for things like releasing expired seats, sending reminders, etc.
# scheduler_events = {
#     "all": [
#         "bilan_air.utils.tasks.release_expired_seats"
#     ],
#     "daily": [
#         "bilan_air.utils.tasks.send_flight_reminders"
#     ],
#     "hourly": [
#         "bilan_air.utils.tasks.update_flight_statuses"
#     ]
# }

# scheduler_events = {
# 	"all": [
# 		"bilan_sky.tasks.all"
# 	],
# 	"daily": [
# 		"bilan_sky.tasks.daily"
# 	],
# 	"hourly": [
# 		"bilan_sky.tasks.hourly"
# 	],
# 	"weekly": [
# 		"bilan_sky.tasks.weekly"
# 	],
# 	"monthly": [
# 		"bilan_sky.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "bilan_sky.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "bilan_sky.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "bilan_sky.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "bilan_sky.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["bilan_sky.utils.before_request"]
# after_request = ["bilan_sky.utils.after_request"]

# Job Events
# ----------
# before_job = ["bilan_sky.utils.before_job"]
# after_job = ["bilan_sky.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"bilan_sky.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

