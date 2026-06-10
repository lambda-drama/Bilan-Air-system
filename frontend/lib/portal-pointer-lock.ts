/** Clear Radix dialog/sheet scroll locks and orphaned overlays that block clicks. */
export function clearPortalPointerLocks() {
  if (typeof document === "undefined") return;

  document.body.style.pointerEvents = "";
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-locked");

  document.querySelectorAll("[data-radix-focus-guard]").forEach((el) => el.remove());

  document
    .querySelectorAll('[data-slot="dialog-overlay"], [data-slot="sheet-overlay"]')
    .forEach((el) => el.remove());

  document.querySelectorAll("main").forEach((el) => {
    if (el instanceof HTMLElement) {
      el.removeAttribute("aria-hidden");
      el.removeAttribute("data-aria-hidden");
      el.style.pointerEvents = "";
    }
  });
}
