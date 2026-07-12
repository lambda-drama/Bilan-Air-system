"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  Users,
  Plane,
  DollarSign,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCurrency } from "@/contexts/currency-context"
import {
  getPortalReports,
  type PortalReportsData,
} from "@/services/portal"

function formatCount(value: number) {
  return value.toLocaleString()
}

function formatYoy(pct: number | null, priorYear: number) {
  if (pct === null) return null
  const sign = pct > 0 ? "+" : ""
  return `${sign}${pct}% vs ${priorYear}`
}

export default function PortalReports() {
  const { formatMoney, symbol } = useCurrency()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<PortalReportsData | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPortalReports(Number(year))
      .then((data) => {
        if (!cancelled) setReports(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year])

  const monthlyData = reports?.monthly ?? []
  const topRoutes = reports?.top_routes ?? []
  const summary = reports?.summary
  const yoy = reports?.yoy
  const priorYear = Number(year) - 1
  const availableYears =
    reports?.available_years?.length
      ? reports.available_years
      : [currentYear]

  const maxRevenue = useMemo(
    () => Math.max(...monthlyData.map((d) => d.revenue), 1),
    [monthlyData],
  )

  const summaryCards = [
    {
      title: "Total Revenue",
      value: summary ? formatMoney(summary.total_revenue) : "—",
      hint: yoy ? formatYoy(yoy.total_revenue, priorYear) : null,
      icon: DollarSign,
      href: "/portal/payments",
      linkLabel: "View payments & fares",
    },
    {
      title: "Total Bookings",
      value: summary ? formatCount(summary.total_bookings) : "—",
      hint: yoy ? formatYoy(yoy.total_bookings, priorYear) : null,
      icon: BarChart3,
      href: "/portal/bookings",
      linkLabel: "View bookings",
    },
    {
      title: "Total Passengers",
      value: summary ? formatCount(summary.total_passengers) : "—",
      hint: yoy ? formatYoy(yoy.total_passengers, priorYear) : null,
      icon: Users,
      href: "/portal/passengers",
      linkLabel: "View passengers",
    },
    {
      title: "Flights Operated",
      value: summary ? formatCount(summary.flights_operated) : "—",
      hint: yoy ? formatYoy(yoy.flights_operated, priorYear) : null,
      icon: Plane,
      href: "/portal/flights",
      linkLabel: "View flight schedules",
    },
  ] as const

  const recentMonths = monthlyData.filter((m) => m.bookings > 0 || m.revenue > 0).slice(-4)
  const displayMonths =
    recentMonths.length > 0 ? recentMonths : monthlyData.slice(-4)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground">
            View business performance and insights for {year}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Link key={card.title} href={card.href} className="group block">
            <Card className="bilan-kpi-card h-full transition-colors group-hover:border-gold/40 group-hover:bg-muted/30">
              <CardContent className="px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="bilan-stat-value mt-1 text-xl sm:text-2xl">
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        card.value
                      )}
                    </p>
                    {card.hint && !loading && (
                      <p
                        className={`mt-0.5 text-[11px] ${
                          card.hint.startsWith("+")
                            ? "text-green-500"
                            : card.hint.startsWith("-")
                              ? "text-red-500"
                              : "text-muted-foreground"
                        }`}
                      >
                        {card.hint}
                      </p>
                    )}
                    <p className="mt-0.5 flex items-center text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {card.linkLabel}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full bg-gold/15 p-1.5">
                    <card.icon className="h-3.5 w-3.5 text-gold" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : monthlyData.every((d) => d.revenue === 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No booking revenue recorded for {year}.
              </p>
            ) : (
              <div className="space-y-4">
                {monthlyData.map((data) => (
                  <div key={data.month} className="flex items-center gap-4">
                    <span className="w-8 text-sm text-muted-foreground">
                      {data.month}
                    </span>
                    <div className="flex-1">
                      <div className="h-6 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{
                            width: `${(data.revenue / maxRevenue) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-20 text-right text-sm font-medium">
                      {data.revenue >= 1000
                        ? `${symbol}${(data.revenue / 1000).toFixed(1)}k`
                        : formatMoney(data.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-accent" />
              Top Performing Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : topRoutes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No route data for {year} yet.
              </p>
            ) : (
              <div className="space-y-4">
                {topRoutes.map((route, index) => (
                  <div
                    key={route.route}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          index === 0
                            ? "bg-yellow-100 text-yellow-700"
                            : index === 1
                              ? "bg-gray-200 text-gray-700"
                              : index === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{route.route}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCount(route.bookings)} bookings
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-accent">
                      {formatMoney(route.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            Monthly Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayMonths.every((d) => d.bookings === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No monthly activity for {year} yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {displayMonths.map((data) => (
                <div key={data.month} className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    {data.month} {year}
                  </p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm">Bookings</span>
                      <span className="font-medium">
                        {formatCount(data.bookings)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Revenue</span>
                      <span className="font-medium">
                        {formatMoney(data.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Avg. Ticket</span>
                      <span className="font-medium">
                        {data.bookings > 0
                          ? formatMoney(
                              Math.round(data.revenue / data.bookings),
                            )
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
