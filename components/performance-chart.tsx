"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface Trade {
  id: number
  date: string
  ticker: string
  wl: string
  position: string
  setup: string
  target: string
  rr: number
  pl: number
  notes: string
}

interface PerformanceChartProps {
  trades: Trade[]
}

export function PerformanceChart({ trades }: PerformanceChartProps) {
  // Calculate cumulative P&L over time
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let cumulativeProfit = 0
  const chartData = sortedTrades.map((trade) => {
    cumulativeProfit += trade.pl
    return {
      date: trade.date,
      profit: cumulativeProfit,
      trade: trade.ticker,
    }
  })

  // Calculate average win and average loss
  const wins = sortedTrades.filter((trade) => trade.wl === "Win")
  const losses = sortedTrades.filter((trade) => trade.wl === "Loss")

  const avgWin = wins.length > 0 ? wins.reduce((sum, trade) => sum + trade.pl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((sum, trade) => sum + trade.pl, 0) / losses.length : 0

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-xs fill-muted-foreground"
            tickFormatter={(value) => new Date(value).toLocaleDateString()}
          />
          <YAxis className="text-xs fill-muted-foreground" tickFormatter={(value) => `$${value}`} />
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Cumulative P&L"]}
            labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 flex justify-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-md text-sm bg-slate-800/50 w-[140px] justify-center">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          Avg Win: ${avgWin.toFixed(2)}
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-md text-sm bg-slate-800/50 w-[140px] justify-center">
          <span className="w-2 h-2 rounded-full bg-red-400"></span>
          Avg Loss: ${avgLoss.toFixed(2)}
        </div>
      </div>
    </div>
  )
}
