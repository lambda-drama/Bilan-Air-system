"use client"

import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  Users,
  Plane,
  DollarSign,
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

const monthlyData = [
  { month: "Jan", bookings: 145, revenue: 46500 },
  { month: "Feb", bookings: 132, revenue: 42200 },
  { month: "Mar", bookings: 178, revenue: 57000 },
  { month: "Apr", bookings: 165, revenue: 52800 },
  { month: "May", bookings: 192, revenue: 61400 },
  { month: "Jun", bookings: 210, revenue: 67200 },
  { month: "Jul", bookings: 245, revenue: 78400 },
  { month: "Aug", bookings: 268, revenue: 85760 },
  { month: "Sep", bookings: 234, revenue: 74880 },
  { month: "Oct", bookings: 198, revenue: 63360 },
  { month: "Nov", bookings: 223, revenue: 71360 },
  { month: "Dec", bookings: 289, revenue: 92480 },
]

const topRoutes = [
  { route: "MGQ → JIB", bookings: 856, revenue: 274560 },
  { route: "MGQ → NBO", bookings: 642, revenue: 243960 },
  { route: "HGA → ADD", bookings: 534, revenue: 240300 },
  { route: "JIB → DXB", bookings: 423, revenue: 219960 },
  { route: "MGQ → HGA", bookings: 398, revenue: 71640 },
]

export default function PortalReports() {
  const { formatMoney, symbol } = useCurrency()
  const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue))
  const totalRevenue = monthlyData.reduce((sum, d) => sum + d.revenue, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground">
            View business performance and insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="2024">
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2022">2022</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatMoney(totalRevenue)}</p>
                <p className="text-xs text-green-500">+24.5% YoY</p>
              </div>
              <DollarSign className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold">2,479</p>
                <p className="text-xs text-green-500">+18.2% YoY</p>
              </div>
              <BarChart3 className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Passengers</p>
                <p className="text-2xl font-bold">3,124</p>
                <p className="text-xs text-green-500">+15.8% YoY</p>
              </div>
              <Users className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Flights Operated</p>
                <p className="text-2xl font-bold">1,856</p>
                <p className="text-xs text-green-500">+12.4% YoY</p>
              </div>
              <Plane className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                    {symbol}{(data.revenue / 1000).toFixed(1)}k
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Routes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-accent" />
              Top Performing Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                        {route.bookings} bookings
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-accent">{formatMoney(route.revenue)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            Monthly Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {monthlyData.slice(-4).map((data) => (
              <div key={data.month} className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{data.month} 2024</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm">Bookings</span>
                    <span className="font-medium">{data.bookings}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Revenue</span>
                    <span className="font-medium">{formatMoney(data.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg. Ticket</span>
                    <span className="font-medium">
                      {formatMoney(Math.round(data.revenue / data.bookings))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
