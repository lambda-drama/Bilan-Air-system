"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { UserAvatar } from "@/components/portal/user-avatar"
import { formatRoleLabel } from "@/lib/user-display"
import { AuthProvider, useAuth } from "@/contexts/auth-context"
import {
  Plane,
  LayoutDashboard,
  CalendarDays,
  Users,
  Ticket,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  Menu,
  X,
  MapPin,
  FileText,
  CreditCard,
  BarChart3,
  ClipboardCheck,
  Luggage,
  MessageSquare,
  Armchair,
  Percent,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const sidebarLinks = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/flights", label: "Flights", icon: Plane },
  { href: "/portal/schedules", label: "Schedules", icon: CalendarDays },
  { href: "/portal/seat-inventory", label: "Seat inventory", icon: Armchair },
  { href: "/portal/bookings", label: "Bookings", icon: Ticket },
  { href: "/portal/check-in", label: "Check-in", icon: ClipboardCheck },
  { href: "/portal/baggage", label: "Baggage", icon: Luggage },
  { href: "/portal/passengers", label: "Passengers", icon: Users },
  { href: "/portal/direct-messages", label: "Direct Message", icon: MessageSquare },
  { href: "/portal/routes", label: "Routes", icon: MapPin },
  { href: "/portal/fare-rules", label: "Fare rules", icon: Percent },
  { href: "/portal/invoices", label: "Invoices", icon: FileText },
  { href: "/portal/payments", label: "Payments", icon: CreditCard },
  { href: "/portal/reports", label: "Reports", icon: BarChart3 },
  { href: "/portal/settings", label: "Settings", icon: Settings },
]

const AUTH_ROUTES = ["/portal/login", "/portal/forgot-password"]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </AuthProvider>
  )
}

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname?.endsWith(route),
  )

  useEffect(() => {
    if (isLoading) return
    if (!isAuthRoute && !isAuthenticated) {
      router.replace("/portal/login")
    }
    if (isAuthRoute && isAuthenticated) {
      router.replace("/portal")
    }
  }, [isLoading, isAuthenticated, isAuthRoute, router])

  if (isAuthRoute) {
    return <>{children}</>
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Loading portal...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — navy matches public site; gold reserved for buttons/active states */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-64 transform bg-navy text-cream transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-navy-light px-4">
            <Link href="/portal" className="flex items-center gap-2">
              <Plane className="h-8 w-8 text-gold" />
              <span className="font-serif text-xl font-bold text-cream">Bilan Air</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {sidebarLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gold text-navy"
                      : "text-cream/70 hover:bg-navy-light hover:text-cream"
                  }`}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="border-t border-navy-light p-4">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream/70 transition-colors hover:bg-navy-light hover:text-cream"
            >
              <LogOut className="h-5 w-5" />
              Back to Website
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Top navbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">
              Admin Portal
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Profile — before notifications; bell stays rightmost */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  {user ? (
                    <UserAvatar user={user} />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-navy">
                      <span className="text-sm font-semibold">?</span>
                    </div>
                  )}
                  <span className="hidden max-w-[140px] truncate text-sm font-medium md:inline">
                    {user?.full_name || "Account"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user && (
                  <div className="border-b px-3 py-2">
                    <p className="truncate text-sm font-medium">{user.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{formatRoleLabel(user.roles)}</p>
                  </div>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/portal/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portal/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => logout().then(() => router.push("/portal/login"))}
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications — always last in header */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy">
                    3
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-2">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                  <span className="font-medium">New booking received</span>
                  <span className="text-xs text-muted-foreground">
                    Booking #BL2024001 - MGQ to JIB
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                  <span className="font-medium">Flight schedule updated</span>
                  <span className="text-xs text-muted-foreground">
                    BA101 departure time changed
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                  <span className="font-medium">Payment confirmed</span>
                  <span className="text-xs text-muted-foreground">
                    $450 received for booking #BL2024002
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
