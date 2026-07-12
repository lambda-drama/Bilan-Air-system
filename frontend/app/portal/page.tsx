"use client"

import { useState, useEffect } from "react"
import {
  Plane,
  Users,
  Ticket,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookingStartLink } from "@/components/portal/booking-start-link"
import Link from "next/link"
import { DashboardFlightSearch } from "@/components/portal/dashboard-flight-search"
import { getDashboardStats } from "@/services/portal"
import { listBookings } from "@/services/portal"
import type { AirBookingRow } from "@/services/portal"
import { useCurrency } from "@/contexts/currency-context"
import { usePermissions } from "@/contexts/permissions-context"

export default function PortalDashboard() {
  const { formatMoney } = useCurrency()
  const { canViewReport } = usePermissions()
  const showDashboardStats = canViewReport("dashboard")
  const showAnalyticsLink = canViewReport("analytics")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [stats, setStats] = useState({
    total_bookings: 0,
    pending_payments: 0,
    upcoming_flights: 0,
    available_seats: 0,
  })
  const [recentBookings, setRecentBookings] = useState<AirBookingRow[]>([])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showDashboardStats) return
    getDashboardStats().then(setStats)
    listBookings({ limit: 5 }).then((res) => setRecentBookings(res.data))
  }, [showDashboardStats])

  const statCards = [
    {
      title: "Total Bookings",
      value: String(stats.total_bookings),
      icon: Ticket,
      href: "/portal/bookings",
    },
    {
      title: "Upcoming Flights",
      value: String(stats.upcoming_flights),
      icon: Plane,
      href: "/portal/flights?view=upcoming",
    },
    {
      title: "Pending Payments",
      value: String(stats.pending_payments),
      icon: DollarSign,
      href: "/portal/bookings?payment=Pending",
    },
    {
      title: "Available Seats",
      value: String(stats.available_seats),
      icon: Users,
      href: "/portal/seat-inventory",
    },
  ]

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="mb-0.5 flex items-end justify-between gap-3">
        <div>
          <p className="section-label mb-1">Overview</p>
          <h1 className="font-serif-display text-xl font-semibold tracking-tight sm:text-2xl">
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{currentTime.toLocaleDateString()}</span>
          <Clock className="ml-1 h-3.5 w-3.5" />
          <span>{currentTime.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      {showDashboardStats ? (
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Link key={stat.title} href={stat.href} className="group block">
              <Card className="bilan-kpi-card h-full transition-colors group-hover:border-gold/40 group-hover:bg-muted/30">
                <CardContent className="px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="bilan-stat-value mt-1 text-xl sm:text-2xl">{stat.value}</p>
                      <p className="mt-0.5 flex items-center text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        View listing
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </p>
                    </div>
                    <div className="shrink-0 rounded-full bg-gold/15 p-1.5">
                      <stat.icon className="h-3.5 w-3.5 text-gold" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}

      <DashboardFlightSearch />

      {showDashboardStats ? (
        <Card className="gap-2 py-3">
          <CardHeader className="flex flex-row items-center justify-between px-3.5 py-0 pb-1">
            <div>
              <p className="section-label mb-1">Bookings</p>
              <CardTitle className="text-base">Recent Bookings</CardTitle>
            </div>
            <Link href="/portal/bookings">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-3.5 pt-0">
            <div className="space-y-2.5">
              {recentBookings.map((booking) => (
                <div
                  key={booking.name}
                  className="flex items-center justify-between border-b border-border/70 pb-2.5 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-[13px] font-medium tracking-tight">
                      {booking.payer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{booking.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-medium tracking-tight">
                      {formatMoney(booking.total_fare)}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {booking.booking_status} / {booking.payment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Quick Actions */}
      <Card className="gap-2 py-3">
        <CardHeader className="px-3.5 py-0 pb-1">
          <p className="section-label mb-1">Actions</p>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-3.5 pt-0">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <BookingStartLink className="w-full">Office booking</BookingStartLink>
            <Link href="/portal/flights">
              <Button variant="outline" className="w-full">
                <Plane className="mr-2 h-4 w-4" />
                Flight schedule
              </Button>
            </Link>
            <Link href="/portal/passengers">
              <Button variant="outline" className="w-full">
                <Users className="mr-2 h-4 w-4" />
                Passengers
              </Button>
            </Link>
            {showAnalyticsLink ? (
              <Link href="/portal/reports/analytics">
                <Button variant="outline" className="w-full">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Reports
                </Button>
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
