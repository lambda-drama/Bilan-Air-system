/** Standard page-size options for portal data tables (server-paginated lists). */
export const PORTAL_LIST_PAGE_SIZE_OPTIONS = [20, 100, 500, 2500] as const;

export const DEFAULT_PORTAL_LIST_PAGE_SIZE = 20;

export type PortalListPageSize = (typeof PORTAL_LIST_PAGE_SIZE_OPTIONS)[number];
