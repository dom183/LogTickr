"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useState } from "react"

interface Trade {
  id: number
  date: string
  ticker: string
  wl: "Win" | "Loss"
  position: "Long" | "Short"
  setup: string[]
  target: string
  rr: string
  pl: number
  notes: string
}

interface FuturesChartProps {
  trades: Trade[]
  accountSize: number // Added accountSize prop to get the selected account size
  drawdownPercent: number // Added drawdownPercent prop for trailing drawdown calculation
  isPremium: boolean
}

export function FuturesChart({ trades, accountSize, drawdownPercent, isPremium }: FuturesChartProps) {
  const reversedTrades = [...trades].reverse()

  let cumulativePnL = 0
  const chartData = reversedTrades.map((trade, index) => {
    cumulativePnL += trade.pl
    return {
      index: index + 1,
      cumulativePnL,
      tradePnL: trade.pl,
      isWin: trade.wl === "Win",
      rr: trade.rr,
    }
  })

  const runningAvgWin: number[] = []
  const runningAvgLoss: number[] = []

  let winSum = 0
  let lossSum = 0
  let winCount = 0
  let lossCount = 0

  reversedTrades.forEach((trade, index) => {
    if (trade.wl === "Win") {
      winSum += trade.pl
      winCount++
    } else {
      lossSum += Math.abs(trade.pl)
      lossCount++
    }

    runningAvgWin.push(winCount > 0 ? winSum / winCount : 0)
    runningAvgLoss.push(lossCount > 0 ? lossSum / lossCount : 0)
  })

  const drawdownAmount = accountSize * drawdownPercent // Simple calculation: if 100k and 3% = 3k
  let peak = accountSize

  const equityData = chartData.map((data, index) => {
    const currentEquity = accountSize + data.cumulativePnL

    let riskPercent = 0
    if (data.rr && data.rr.includes(":")) {
      const rrParts = data.rr.split(":").map((num) => Number.parseFloat(num.trim()))
      if (rrParts.length === 2 && !isNaN(rrParts[0]) && !isNaN(rrParts[1]) && rrParts[1] > 0) {
        const [riskPart, rewardPart] = rrParts
        const r = rewardPart
        const a = index === 0 ? accountSize : accountSize + chartData[index - 1].cumulativePnL
        const p = data.tradePnL

        if (a > 0 && r > 0 && !isNaN(a)) {
          if (p > 0) {
            riskPercent = (p / r / a) * 100
          } else if (p < 0) {
            riskPercent = Math.abs((p / a) * 100)
          }

          if (isNaN(riskPercent) || !isFinite(riskPercent)) {
            riskPercent = 0
          }
        }
      }
    }

    if (currentEquity > peak) {
      peak = currentEquity
    }

    const trailingDrawdownValue = peak - drawdownAmount

    return {
      index: data.index,
      equity: currentEquity,
      riskPercent,
      drawdown: peak - currentEquity, // Current drawdown from peak
      trailingDrawdown: trailingDrawdownValue,
    }
  })

  const chartWidth = 400
  const chartHeight = 405 // Reduced chart height by 10% from 450px to 405px
  const padding = 50

  const maxRunningAvgWin = Math.max(...runningAvgWin, 0)
  const maxRunningAvgLoss = Math.max(...runningAvgLoss, 0)

  const maxPnL = Math.max(...chartData.map((d) => Math.max(d.cumulativePnL, d.tradePnL)), maxRunningAvgWin, 0)
  const minPnL = Math.min(...chartData.map((d) => Math.min(d.cumulativePnL, d.tradePnL)), -maxRunningAvgLoss, 0)

  const roundedMax = Math.ceil(maxPnL / 100) * 100
  const roundedMin = Math.floor(minPnL / 100) * 100
  const finalMax = Math.max(roundedMax, 0)
  const finalMin = Math.min(roundedMin, 0)
  const pnlRange = finalMax - finalMin || 1000

  const validEquityData = equityData.filter((d) => !isNaN(d.equity) && isFinite(d.equity))
  const maxEquity = validEquityData.length > 0 ? Math.max(...validEquityData.map((d) => d.equity)) : accountSize + 1000
  const minEquity =
    validEquityData.length > 0
      ? Math.min(...validEquityData.map((d) => Math.min(d.equity, d.trailingDrawdown)))
      : accountSize - 1000
  const validRiskData = equityData.filter((d) => !isNaN(d.riskPercent) && isFinite(d.riskPercent))
  const maxRisk = validRiskData.length > 0 ? Math.max(...validRiskData.map((d) => d.riskPercent), 0) : 10

  // Adjusted padding to make equity background reach bottom like cumulative P&L chart
  const dataSpread = maxEquity - minEquity
  const paddingFactor = 0.05 // 5% top/bottom padding
  const paddingAmount = dataSpread * paddingFactor
  const compressedMaxEquity = maxEquity + paddingAmount
  const compressedMinEquity = minEquity - paddingAmount
  const equityRange = compressedMaxEquity - compressedMinEquity || 1000

  const getY = (value: number, min: number, range: number) => {
    return chartHeight - padding - ((value - min) / range) * (chartHeight - 2 * padding)
  }

  // Map equity values so min sits exactly at bottom and max at top
  const getEquityY = (value: number) => {
    return chartHeight - ((value - compressedMinEquity) / equityRange) * chartHeight
  }

  const getX = (index: number, maxIndex: number) => {
    if (maxIndex === 0) return padding + 30
    const availableWidth = chartWidth - 2 * padding - 60 // Leave more margin
    return padding + 30 + ((index - 1) / Math.max(maxIndex - 1, 1)) * availableWidth
  }

  const yAxisLabels = []
  const step = 100
  let currentValue = Math.floor(finalMin / step) * step
  while (currentValue <= finalMax) {
    yAxisLabels.push({
      value: currentValue,
      y: getY(currentValue, finalMin, pnlRange),
    })
    currentValue += step
  }

  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; visible: boolean }>({
    x: 0,
    y: 0,
    value: 0,
    visible: false,
  })

  const [equityTooltip, setEquityTooltip] = useState<{ x: number; y: number; value: number; visible: boolean }>({
    x: 0,
    y: 0,
    value: 0,
    visible: false,
  })

  const [drawdownTooltip, setDrawdownTooltip] = useState<{ x: number; y: number; value: number; visible: boolean }>({
    x: 0,
    y: 0,
    value: 0,
    visible: false,
  })

  const [avgWinTooltip, setAvgWinTooltip] = useState<{ x: number; y: number; value: number; visible: boolean }>({
    x: 0,
    y: 0,
    value: 0,
    visible: false,
  })

  const [avgLossTooltip, setAvgLossTooltip] = useState<{ x: number; y: number; value: number; visible: boolean }>({
    x: 0,
    y: 0,
    value: 0,
    visible: false,
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Cumulative P&L Chart */}
      <div className="flex justify-center">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-600 shadow-xl w-full max-w-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 text-xs text-slate-200 font-medium drop-shadow-lg">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-600/40 shadow-md backdrop-blur-sm">
                <div className="w-5 h-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-sm shadow-lg shadow-amber-400/25"></div>
                <span className="drop-shadow-sm">Cumulative P&amp;L</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-600/40 shadow-md backdrop-blur-sm">
                <div className="w-5 h-2.5 flex rounded-sm overflow-hidden shadow-lg">
                  <div className="w-2.5 h-2.5 bg-emerald-500 shadow-emerald-500/25"></div>
                  <div className="w-2.5 h-2.5 bg-red-500 shadow-red-500/25"></div>
                </div>
                <span className="drop-shadow-sm">Trade P&amp;L</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-600/40 shadow-md backdrop-blur-sm">
                <div className="w-5 h-1 border-t-2 border-dashed border-emerald-400 shadow-lg shadow-emerald-400/25"></div>
                <span className="drop-shadow-sm">Avg Win</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-600/40 shadow-md backdrop-blur-sm">
                <div className="w-5 h-1 border-t-2 border-dashed border-red-400 shadow-lg shadow-red-400/25"></div>
                <span className="drop-shadow-sm">Avg Loss</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 relative h-[400px]">
            <svg width={chartWidth} height={400} className="w-full drop-shadow-lg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#475569" strokeWidth="0.5" opacity="0.3" />
                </pattern>
                <linearGradient id="chartBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#334155" />
                </linearGradient>
                <linearGradient id="winGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="lossGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
                <linearGradient id="cumulativeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              {/* <rect width="100%" height="100%" fill="url(#chartBg)" /> */}
              <rect width="100%" height="100%" fill="url(#grid)" />

              <line
                x1={padding}
                y1={getY(0, finalMin, pnlRange)}
                x2={chartWidth - padding}
                y2={getY(0, finalMin, pnlRange)}
                stroke="#64748b"
                strokeWidth="2"
                opacity="0.8"
                filter="drop-shadow(0 0 2px rgba(100, 116, 139, 0.5))"
              />

              {chartData.map((data, index) => {
                const x = getX(data.index, chartData.length)
                const zeroY = getY(0, finalMin, pnlRange)
                const tradeY = getY(data.tradePnL, finalMin, pnlRange)
                const barHeight = Math.abs(zeroY - tradeY)
                const barWidth =
                  chartData.length > 1 ? Math.max(40, (chartWidth - 2 * padding - 60) / chartData.length - 2) : 40

                return (
                  <rect
                    key={index}
                    x={x - barWidth / 2}
                    y={data.tradePnL >= 0 ? tradeY : zeroY}
                    width={barWidth}
                    height={barHeight}
                    fill={data.isWin ? "url(#winGradient)" : "url(#lossGradient)"}
                    opacity="0.9"
                    rx="2"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                  />
                )
              })}

              {runningAvgWin.length > 1 && (
                <polyline
                  points={runningAvgWin
                    .map((avgWin, index) => {
                      if (avgWin > 0) {
                        return `${getX(index + 1, chartData.length)},${getY(avgWin, finalMin, pnlRange)}`
                      }
                      return null
                    })
                    .filter((point) => point !== null)
                    .join(" ")}
                  fill="none"
                  stroke="#10b981"
                  strokeDasharray="6,4"
                  strokeWidth="3"
                  filter="drop-shadow(0 0 4px rgba(16, 185, 129, 0.6))"
                />
              )}

              {runningAvgLoss.length > 1 && (
                <polyline
                  points={runningAvgLoss
                    .map((avgLoss, index) => {
                      if (avgLoss > 0) {
                        return `${getX(index + 1, chartData.length)},${getY(-avgLoss, finalMin, pnlRange)}`
                      }
                      return null
                    })
                    .filter((point) => point !== null)
                    .join(" ")}
                  fill="none"
                  stroke="#ef4444"
                  strokeDasharray="6,4"
                  strokeWidth="3"
                  filter="drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))"
                />
              )}

              {chartData.length > 1 && (
                <polyline
                  points={chartData
                    .map(
                      (data, index) =>
                        `${getX(data.index, chartData.length)},${getY(data.cumulativePnL, finalMin, pnlRange)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="url(#cumulativeGradient)"
                  strokeWidth="4"
                  filter="drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))"
                />
              )}

              {runningAvgWin.map((avgWin, index) => {
                if (avgWin > 0) {
                  return (
                    <circle
                      key={`avg-win-${index}`}
                      cx={getX(index + 1, chartData.length)}
                      cy={getY(avgWin, finalMin, pnlRange)}
                      r="5"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: "pointer" }}
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                      onMouseEnter={(e) => {
                        const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                        const circleRect = e.currentTarget.getBoundingClientRect()
                        if (svgRect) {
                          setAvgWinTooltip({
                            x: circleRect.left - svgRect.left + circleRect.width / 2,
                            y: circleRect.top - svgRect.top,
                            value: avgWin,
                            visible: true,
                          })
                        }
                      }}
                      onMouseLeave={() => {
                        setAvgWinTooltip((prev) => ({ ...prev, visible: false }))
                      }}
                    />
                  )
                }
                return null
              })}

              {runningAvgLoss.map((avgLoss, index) => {
                if (avgLoss > 0) {
                  return (
                    <circle
                      key={`avg-loss-${index}`}
                      cx={getX(index + 1, chartData.length)}
                      cy={getY(-avgLoss, finalMin, pnlRange)}
                      r="5"
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: "pointer" }}
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                      onMouseEnter={(e) => {
                        const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                        const circleRect = e.currentTarget.getBoundingClientRect()
                        if (svgRect) {
                          setAvgLossTooltip({
                            x: circleRect.left - svgRect.left + circleRect.width / 2,
                            y: circleRect.top - svgRect.top,
                            value: avgLoss,
                            visible: true,
                          })
                        }
                      }}
                      onMouseLeave={() => {
                        setAvgLossTooltip((prev) => ({ ...prev, visible: false }))
                      }}
                    />
                  )
                }
                return null
              })}

              {chartData.map((data, index) => (
                <circle
                  key={index}
                  cx={getX(data.index, chartData.length)}
                  cy={getY(data.cumulativePnL, finalMin, pnlRange)}
                  r="7"
                  fill="url(#cumulativeGradient)"
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{ cursor: "pointer" }}
                  filter="drop-shadow(0 2px 6px rgba(0,0,0,0.4))"
                  onMouseEnter={(e) => {
                    const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                    const circleRect = e.currentTarget.getBoundingClientRect()
                    if (svgRect) {
                      setTooltip({
                        x: circleRect.left - svgRect.left + circleRect.width / 2,
                        y: circleRect.top - svgRect.top,
                        value: data.cumulativePnL,
                        visible: true,
                      })
                    }
                  }}
                  onMouseLeave={() => {
                    setTooltip((prev) => ({ ...prev, visible: false }))
                  }}
                />
              ))}

            </svg>

            {tooltip.visible && (
              <div
                className="absolute bg-slate-900 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 pointer-events-none z-10 shadow-xl"
                style={{
                  left: tooltip.x,
                  top: tooltip.y - 45,
                  transform: "translateX(-50%)",
                }}
              >
                Cumulative P&L: ${tooltip.value.toLocaleString()}
              </div>
            )}

            {avgWinTooltip.visible && (
              <div
                className="absolute bg-slate-900 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 pointer-events-none z-10 shadow-xl"
                style={{
                  left: avgWinTooltip.x,
                  top: avgWinTooltip.y - 45,
                  transform: "translateX(-50%)",
                }}
              >
                Avg Win: ${avgWinTooltip.value.toFixed(0)}
              </div>
            )}

            {avgLossTooltip.visible && (
              <div
                className="absolute bg-slate-900 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 pointer-events-none z-10 shadow-xl"
                style={{
                  left: avgLossTooltip.x,
                  top: avgLossTooltip.y - 45,
                  transform: "translateX(-50%)",
                }}
              >
                Avg Loss: ${avgLossTooltip.value.toFixed(0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve Chart */}
      {isPremium === true ? (
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-600 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 text-xs text-slate-200 font-medium drop-shadow-lg">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-600/40 shadow-md backdrop-blur-sm">
                <div className="w-5 h-2.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-sm shadow-lg shadow-blue-500/25"></div>
                <span className="drop-shadow-sm">Equity Curve</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-600/40 shadow-md backdrop-blur-sm">
                <div className="w-5 h-1 border-t-2 border-dashed border-orange-400 shadow-lg shadow-orange-400/25"></div>
                <span className="drop-shadow-sm">Risk %</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-600/40 shadow-md backdrop-blur-sm">
                <div className="w-5 h-1 border-t-2 border-dashed border-purple-400 shadow-lg shadow-purple-400/25"></div>
                <span className="drop-shadow-sm">Trailing Drawdown</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 relative h-[400px]">
            <svg width={chartWidth} height={400} className="w-full drop-shadow-lg">
              <defs>
                <linearGradient id="equityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              {/* <rect width="100%" height="100%" fill="url(#chartBg)" /> */}
              <rect width="100%" height="100%" fill="url(#grid)" />

              {equityData.length > 1 && (
                <polyline
                  points={equityData
                    .map((data, index) => {
                      const x = getX(data.index, equityData.length)
                      const y = getEquityY(data.equity)
                      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
                        return null
                      }
                      return `${x},${y}`
                    })
                    .filter((point) => point !== null)
                    .join(" ")}
                  fill="none"
                  stroke="url(#equityGradient)"
                  strokeWidth="4"
                  filter="drop-shadow(0 0 8px rgba(59, 130, 246, 0.9))"
                />
              )}

              {/* Risk % line */}
              {equityData.length > 1 && maxRisk > 0 && (
                <polyline
                  points={equityData
                    .map((data, index) => {
                      if (isNaN(data.riskPercent) || !isFinite(data.riskPercent) || data.riskPercent <= 0) {
                        return null
                      }
                      const scaledRisk = compressedMinEquity + (data.riskPercent / maxRisk) * (equityRange * 0.3)
                      const x = getX(data.index, equityData.length)
                      const y = getEquityY(scaledRisk)

                      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
                        return null
                      }

                      return `${x},${y}`
                    })
                    .filter((point) => point !== null)
                    .join(" ")}
                  fill="none"
                  stroke="#f97316"
                  strokeDasharray="6,4"
                  strokeWidth="3"
                  filter="drop-shadow(0 0 4px rgba(249, 115, 22, 0.6))"
                />
              )}

              {/* Trailing Drawdown line */}
              {equityData.length > 1 && (
                <polyline
                  points={equityData
                    .map((data, index) => {
                      const x = getX(data.index, equityData.length)
                      const y = getEquityY(data.trailingDrawdown)

                      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
                        return null
                      }

                      return `${x},${y}`
                    })
                    .filter((point) => point !== null)
                    .join(" ")}
                  fill="none"
                  stroke="#a855f7"
                  strokeDasharray="6,4"
                  strokeWidth="3"
                  filter="drop-shadow(0 0 4px rgba(168, 85, 247, 0.6))"
                />
              )}

              {equityData.map((data, index) => {
                const x = getX(data.index, equityData.length)
                const y = getEquityY(data.equity)

                if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
                  return null
                }

                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="8"
                    fill="url(#equityGradient)"
                    stroke="#ffffff"
                    strokeWidth="3"
                    style={{ cursor: "pointer" }}
                    filter="drop-shadow(0 3px 8px rgba(0,0,0,0.5))"
                    onMouseEnter={(e) => {
                      const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                      const circleRect = e.currentTarget.getBoundingClientRect()
                      if (svgRect) {
                        setEquityTooltip({
                          x: circleRect.left - svgRect.left + circleRect.width / 2,
                          y: circleRect.top - svgRect.top,
                          value: data.equity,
                          visible: true,
                        })
                      }
                    }}
                    onMouseLeave={() => {
                      setEquityTooltip((prev) => ({ ...prev, visible: false }))
                    }}
                  />
                )
              })}

              {/* Risk labels */}
              {equityData.map((data, index) => {
                if (data.riskPercent > 0 && maxRisk > 0 && !isNaN(data.riskPercent) && isFinite(data.riskPercent)) {
                  const scaledRisk = compressedMinEquity + (data.riskPercent / maxRisk) * (equityRange * 0.3)
                  const x = getX(data.index, equityData.length)
                  const y = getEquityY(scaledRisk) - 12

                  if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
                    return null
                  }

                  return (
                    <text
                      key={`risk-${index}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      fill="#f97316"
                      fontSize="11"
                      fontWeight="bold"
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
                    >
                      {data.riskPercent.toFixed(1)}%
                    </text>
                  )
                }
                return null
              })}

              {/* Drawdown dots */}
              {equityData.map((data, index) => {
                const x = getX(data.index, equityData.length)
                const y = getEquityY(data.trailingDrawdown)

                if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
                  return null
                }

                return (
                  <circle
                    key={`drawdown-${index}`}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="#a855f7"
                    stroke="#ffffff"
                    strokeWidth="2"
                    style={{ cursor: "pointer" }}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                    onMouseEnter={(e) => {
                      const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                      const circleRect = e.currentTarget.getBoundingClientRect()
                      if (svgRect) {
                        setDrawdownTooltip({
                          x: circleRect.left - svgRect.left + circleRect.width / 2,
                          y: circleRect.top - svgRect.top,
                          value: data.trailingDrawdown,
                          visible: true,
                        })
                      }
                    }}
                    onMouseLeave={() => {
                      setDrawdownTooltip((prev) => ({ ...prev, visible: false }))
                    }}
                  />
                )
              })}

            </svg>

            {equityTooltip.visible && (
              <div
                className="absolute bg-slate-900 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 pointer-events-none z-10 shadow-xl"
                style={{
                  left: equityTooltip.x,
                  top: equityTooltip.y - 45,
                  transform: "translateX(-50%)",
                }}
              >
                Equity: ${equityTooltip.value.toLocaleString()}
              </div>
            )}

            {drawdownTooltip.visible && (
              <div
                className="absolute bg-slate-900 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 pointer-events-none z-10 shadow-xl"
                style={{
                  left: drawdownTooltip.x,
                  top: drawdownTooltip.y - 45,
                  transform: "translateX(-50%)",
                }}
              >
                Drawdown: ${drawdownTooltip.value.toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-center items-center h-[400px] border border-dashed border-slate-600 rounded-lg text-slate-400 text-sm italic">
          Upgrade to Premium to unlock the Equity Curve chart
        </div>
      )}
    </div>
  )
}
