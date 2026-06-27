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
    <div className="space-y-6">
      <div className="flex justify-end items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>{currentTime.toLocaleDateString()}</span>
        <Clock className="ml-2 h-4 w-4" />
        <span>{currentTime.toLocaleTimeString()}</span>
      </div>

      {/* Stats Grid */}
      {showDashboardStats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Link key={stat.title} href={stat.href} className="group block">
              <Card className="h-full transition-shadow group-hover:shadow-md group-hover:border-gold/40">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-5 w-5 text-gold" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="mt-2 flex items-center text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    View listing
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}

      <DashboardFlightSearch />

      {showDashboardStats ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Link href="/portal/bookings">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentBookings.map((booking) => (
                <div
                  key={booking.name}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{booking.payer_name}</p>
                    <p className="text-sm text-muted-foreground">{booking.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatMoney(booking.total_fare)}</p>
                    <span className="text-xs text-muted-foreground">
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
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
