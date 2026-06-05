"use client"

import { useState, useEffect } from "react"
import {
  Plane,
  Users,
  Ticket,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookingStartLink } from "@/components/portal/booking-start-link"
import Link from "next/link"
import { getDashboardStats } from "@/services/portal"
import { listBookings } from "@/services/portal"
import type { AirBookingRow } from "@/services/portal"
import { useCurrency } from "@/contexts/currency-context"
export default function PortalDashboard() {
  const { formatMoney } = useCurrency()
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
    getDashboardStats().then(setStats)
    listBookings({ limit: 5 }).then((res) => setRecentBookings(res.data))
  }, [])

  const statCards = [
    { title: "Total Bookings", value: String(stats.total_bookings), icon: Ticket },
    { title: "Upcoming Flights", value: String(stats.upcoming_flights), icon: Plane },
    { title: "Pending Payments", value: String(stats.pending_payments), icon: DollarSign },
    { title: "Available Seats", value: String(stats.available_seats), icon: Users },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg text-muted-foreground">
            Here&apos;s what&apos;s happening with your airline today.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{currentTime.toLocaleDateString()}</span>
          <Clock className="ml-2 h-4 w-4" />
          <span>{currentTime.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-5 w-5 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

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
            <Link href="/portal/reports">
              <Button variant="outline" className="w-full">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Reports
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
