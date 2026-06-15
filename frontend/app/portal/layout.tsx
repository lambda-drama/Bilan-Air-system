"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { UserAvatar } from "@/components/portal/user-avatar"
import { formatRoleLabel, getDisplayFirstName } from "@/lib/user-display"
import { hasPortalAccess } from "@/lib/portal-access"
import { useAuth } from "@/contexts/auth-context"
import { PortalLoadingScreen } from "@/components/portal/portal-loading-screen"
import { signalPortalNavStart } from "@/lib/portal-navigation"
import { clearPortalPointerLocks } from "@/lib/portal-pointer-lock"
import {
  clearAllPortalReportStates,
  isPortalReportsPath,
} from "@/lib/portal-report-storage"
import {
  Bell,
  ChevronDown,
  Menu,
  X,
} from "lucide-react"
import { PortalSidebar } from "@/components/portal/portal-sidebar"
import { PortalGenerationBanner } from "@/components/portal/portal-generation-banner"
import { ThemeDropdownSubmenu } from "@/components/theme-dropdown-items"
import { FlightPlanGenerationProvider } from "@/contexts/flight-plan-generation-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const AUTH_ROUTES = ["/portal/login", "/portal/forgot-password"]

const NOTIFICATION_COUNT = 3

const PORTAL_NOTIFICATIONS = [
  {
    title: "New booking received",
    detail: "Booking #BL2024001 - MGQ to JIB",
  },
  {
    title: "Flight schedule updated",
    detail: "BA101 departure time changed",
  },
  {
    title: "Payment confirmed",
    detail: "$450 received for booking #BL2024002",
  },
] as const

function PortalNotificationItems() {
  return (
    <>
      {PORTAL_NOTIFICATIONS.map((notification) => (
        <DropdownMenuItem
          key={notification.title}
          className="flex flex-col items-start gap-1 p-3"
        >
          <span className="font-medium">{notification.title}</span>
          <span className="text-xs text-muted-foreground">{notification.detail}</span>
        </DropdownMenuItem>
      ))}
    </>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalLayoutInner>{children}</PortalLayoutInner>
}

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname?.endsWith(route),
  )
  const portalAccess = user ? hasPortalAccess(user.roles) : false
  const firstName = getDisplayFirstName(user)
  const previousPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    clearPortalPointerLocks()
  }, [pathname])

  useEffect(() => {
    const previous = previousPathnameRef.current
    const current = pathname || ""
    if (previous && isPortalReportsPath(previous) && !isPortalReportsPath(current)) {
      clearAllPortalReportStates()
    }
    previousPathnameRef.current = current
  }, [pathname])

  useEffect(() => {
    if (isLoading) return

    if (isAuthRoute) {
      if (isAuthenticated && portalAccess) {
        router.replace("/portal")
      }
      return
    }

    if (!isAuthenticated) {
      router.replace("/portal/login")
      return
    }

    if (!portalAccess) {
      router.replace("/portal/login?reason=access_denied")
    }
  }, [isLoading, isAuthenticated, isAuthRoute, portalAccess, router])

  if (isAuthRoute) {
    return <>{children}</>
  }

  if (isLoading || !isAuthenticated || !portalAccess) {
    return (
      <PortalLoadingScreen
        message={
          isLoading
            ? "Signing you in"
            : !portalAccess
              ? "Checking access"
              : "Loading portal"
        }
      />
    )
  }

  return (
    <FlightPlanGenerationProvider>
    <div className="flex h-svh overflow-hidden bg-muted/30">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer — fixed slide-in panel */}
      <aside
        className={`fixed left-0 top-0 z-50 h-svh w-64 overflow-hidden transform bg-navy text-cream transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute right-3 top-4 z-10"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-cream" />
          </button>
          <PortalSidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
      </aside>

      {/* Desktop sidebar — above sheet/dialog overlays so nav stays clickable */}
      <aside className="relative z-[60] hidden h-full min-h-0 w-64 shrink-0 overflow-hidden bg-navy text-cream lg:flex lg:flex-col">
        <PortalSidebar />
      </aside>

      {/* Main content area — only this column scrolls */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="z-30 flex min-h-16 shrink-0 flex-col gap-2 border-b bg-background px-4 py-2 lg:gap-3 lg:px-6 lg:py-3">
          <div className="flex items-center gap-3 lg:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex min-w-0 items-center gap-2 lg:gap-4">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="shrink-0 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="flex min-w-0 shrink-0 items-baseline gap-1.5 truncate">
                <span className="shrink-0 font-serif text-xs font-normal tracking-wide text-muted-foreground lg:hidden">
                  Welcome back,
                </span>
                <span className="truncate text-base font-semibold text-foreground lg:hidden">
                  {firstName}
                </span>
                <span className="hidden truncate text-lg font-semibold text-foreground lg:inline">
                  Welcome back, {firstName}
                </span>
              </h1>
            </div>
            <PortalGenerationBanner />
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative flex h-9 items-center gap-2 px-1 lg:h-10 lg:px-2"
                >
                  {user ? (
                    <UserAvatar user={user} />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-navy">
                      <span className="text-sm font-semibold">?</span>
                    </div>
                  )}
                  <span className="hidden max-w-[140px] truncate text-sm font-medium lg:inline">
                    {user?.full_name || "Account"}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 shrink-0 lg:inline" />
                  {NOTIFICATION_COUNT > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy lg:hidden">
                      {NOTIFICATION_COUNT}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(20rem,calc(100vw-2rem))] lg:w-56"
              >
                {user && (
                  <div className="border-b px-3 py-2">
                    <p className="truncate text-sm font-medium">{user.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{formatRoleLabel(user.roles)}</p>
                  </div>
                )}
                <div className="lg:hidden">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notifications
                    {NOTIFICATION_COUNT > 0 && (
                      <span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-navy">
                        {NOTIFICATION_COUNT}
                      </span>
                    )}
                  </DropdownMenuLabel>
                  <PortalNotificationItems />
                  <DropdownMenuSeparator />
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/portal/profile" prefetch={false} onClick={signalPortalNavStart}>
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portal/settings" prefetch={false} onClick={signalPortalNavStart}>
                    Settings
                  </Link>
                </DropdownMenuItem>
                <ThemeDropdownSubmenu />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => logout().then(() => router.push("/portal/login"))}
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop only — bell stays rightmost */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hidden lg:inline-flex">
                  <Bell className="h-5 w-5" />
                  {NOTIFICATION_COUNT > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy">
                      {NOTIFICATION_COUNT}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-2">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <DropdownMenuSeparator />
                <PortalNotificationItems />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </div>
        </header>

        {/* Page content */}
        <main
          className={`flex-1 overflow-y-auto p-4 lg:p-6${
            sidebarOpen ? " max-lg:overflow-hidden" : ""
          }`}
        >
          {children}
        </main>
      </div>
    </div>
    </FlightPlanGenerationProvider>
  )
}
