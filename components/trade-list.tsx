import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"

interface Trade {
  id: number
  symbol: string
  type: string
  quantity: number
  price: number
  date: string
  profit: number
  status: string
}

interface TradeListProps {
  trades: Trade[]
}

export function TradeList({ trades }: TradeListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Trades</CardTitle>
        <CardDescription>Complete history of your trading activity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {trades.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <Badge variant={trade.type === "buy" ? "default" : "secondary"}>{trade.symbol}</Badge>
                <div>
                  <p className="font-medium">
                    {trade.type.toUpperCase()} {trade.quantity} shares
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ${trade.price} per share • {trade.date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Badge variant={trade.status === "open" ? "outline" : "secondary"}>{trade.status}</Badge>
                <div className="text-right">
                  <p
                    className={`font-medium ${
                      trade.profit > 0 ? "text-chart-1" : trade.profit < 0 ? "text-chart-5" : "text-muted-foreground"
                    }`}
                  >
                    {trade.profit > 0 ? "+" : ""}${trade.profit.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total: ${(trade.quantity * trade.price).toLocaleString()}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
