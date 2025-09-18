// @ts-nocheck
"use client";

import toast, { Toaster } from "react-hot-toast";

import { useState, useRef, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Calendar, CalendarDays, Plus, Minus, TrendingUp, DollarSign, Target, BarChart3 } from "lucide-react"
import { FuturesChart } from "./futures-chart"
import { Logo } from "./logo"

interface Trade {
  id: string
  user_id: string
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

export function TradingDashboard({ user, setEquityCurve }: { user: any, setEquityCurve?: (curve: number[]) => void }) {
  const [accountSize, setAccountSize] = useState("100k")
  const [drawdown, setDrawdown] = useState("1%")
  const [isPremium, setIsPremium] = useState(false)
  const [filter, setFilter] = useState("")
  const [timeFilter, setTimeFilter] = useState("")
  const [showChart, setShowChart] = useState(true)
  const [currentField, setCurrentField] = useState<string>("")
  const [newTrade, setNewTrade] = useState<Partial<Trade>>({
    setup: [],
  })
  const [trades, setTrades] = useState<Trade[]>([])
  // View mode for chart section (removed segmented control)



  const fieldRefs = {
    ticker: useRef<HTMLInputElement>(null),
    wl: useRef<HTMLInputElement>(null),
    position: useRef<HTMLInputElement>(null),
    setup: useRef<HTMLInputElement>(null),
    target: useRef<HTMLInputElement>(null),
    rr: useRef<HTMLInputElement>(null),
    pl: useRef<HTMLInputElement>(null),
    notes: useRef<HTMLInputElement>(null),
  }

  const tickers = ["ES", "NQ", "YM", "RTY"]
  const tickerColors = {
    ES: "bg-red-500 hover:bg-red-600 text-white",
    NQ: "bg-blue-500 hover:bg-blue-600 text-white",
    YM: "bg-yellow-500 hover:bg-yellow-600 text-black",
    RTY: "bg-purple-500 hover:bg-purple-600 text-white",
  }

  const confluences = [
    { name: "LQS", color: "bg-gray-500 text-white" },
    { name: "BOS", color: "bg-blue-500 text-white" },
    { name: "CHOCH", color: "bg-orange-500 text-white" },
    { name: "FVG", color: "bg-cyan-500 text-black" },
    { name: "IFVG", color: "bg-pink-500 text-white" },
    { name: "OB", color: "bg-green-500 text-white" },
    { name: "BB", color: "bg-gray-500 text-white" },
    { name: "MB", color: "bg-yellow-500 text-black" },
    { name: "RB", color: "bg-purple-500 text-white" },
    { name: "SMT", color: "bg-orange-500 text-white" },
    { name: "MSS", color: "bg-red-500 text-white" },
    { name: "CISD", color: "bg-teal-500 text-white" },
  ]

  const targets = [
    ["1HIRL", "NYSH", "ASH", "LSH", "PDH"],
    ["4HIRL", "NYSL", "ASL", "LSL", "PDL"],
  ]

  const targetColors = {
    "1HIRL": "bg-green-400 text-black",
    NYSH: "bg-blue-500 text-white",
    ASH: "bg-yellow-500 text-black",
    LSH: "bg-pink-500 text-white",
    PDH: "bg-orange-400 text-black",
    "4HIRL": "bg-green-500 text-white",
    NYSL: "bg-blue-600 text-white",
    ASL: "bg-yellow-600 text-black",
    LSL: "bg-pink-600 text-white",
    PDL: "bg-orange-500 text-white",
  }

  // Save account size and drawdown to Supabase settings table
  const updateSetting = async (field: "account_size" | "drawdown", value: string) => {
    if (!user) return;

    try {
      // Fetch current DB row
      const { data: currentData, error: fetchError } = await supabase
        .from("settings")
        .select("account_size, drawdown")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Failed to fetch current settings:", fetchError);
        return;
      }

      const payload = {
        user_id: user.id,
        account_size: field === "account_size" ? value : currentData?.account_size || "100k",
        drawdown: field === "drawdown" ? value : currentData?.drawdown || "1%",
      };

      // Upsert the updated values
      const { data, error: upsertError, status, statusText } = await supabase
        .from("settings")
        .upsert(payload, { onConflict: "user_id" });

      console.log("Upsert response:", { data, upsertError, status, statusText });

      if (upsertError) {
        console.error("Failed to save settings:", upsertError);
        return;
      }

      // Update state immediately
      setAccountSize(payload.account_size);
      setDrawdown(payload.drawdown);

      // Re-fetch trades with the updated account size
      await fetchTradesFromDB(payload.account_size);
    } catch (err) {
      console.error("Unexpected error updating settings:", err);
    }
  };

  const handleButtonClick = (value: string, field: string) => {
    setNewTrade((prev) => {
      const updatedTrade = { ...prev }

      if (field === "setup") {
        const currentSetup = prev.setup || []
        if (currentSetup.includes(value)) {
          updatedTrade.setup = currentSetup.filter((s) => s !== value)
        } else if (currentSetup.length < 3) {
          updatedTrade.setup = [...currentSetup, value]
        }
      } else {
        updatedTrade[field as keyof Trade] = value as any
      }

      return updatedTrade
    })

    // Automatically move to next field (optional)
    const fieldOrder = ["ticker", "wl", "position", "setup", "target", "rr", "pl", "notes"]
    const currentIndex = fieldOrder.indexOf(field)
    if (currentIndex >= 0 && currentIndex < fieldOrder.length - 1) {
      setCurrentField(fieldOrder[currentIndex + 1])
    }
  }


  // Helper function to fetch trades and update state/equity curve
  const fetchTradesFromDB = async (currentAccountSize?: string) => {
    if (!user) {
      setTrades([]);
      if (setEquityCurve) setEquityCurve([]);
      return;
    }

    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch trades:", error);
      setTrades([]);
      if (setEquityCurve) setEquityCurve([]);
      return;
    }

    if (data) {
      setTrades(data);

      if (setEquityCurve) {
        const balanceStr = currentAccountSize || accountSize;
        const startingBalance = getAccountSizeNumber(balanceStr);
        let runningBalance = startingBalance;
        const equityArray = data.map((t: any) => {
          runningBalance += Number(t.pl ?? 0);
          return runningBalance;
        });
        setEquityCurve(equityArray);
      }
    }
  };

  const addRow = async () => {
    console.log("Adding trade:", newTrade);
    console.log("Current accountSize:", accountSize);
    console.log("User:", user);

    if (!user) {
      console.error("Cannot add trade: user not logged in.");
      toast.error("Cannot add trade: user not logged in.");
      return;
    }
    if (!newTrade.ticker || !newTrade.wl || !newTrade.position) {
      console.error("Cannot add trade: missing required fields.");
      toast.error("Cannot add trade: missing required fields.");
      return;
    }
    // Free plan: limit to 15 trades
    if (!isPremium && trades.length >= 15) {
      toast.error("Free plan allows up to 15 trades. Upgrade to Premium to add more.");
      return;
    }

    const tradeToInsert = {
      user_id: user.id,
      date: new Date().toISOString().split("T")[0],
      ticker: newTrade.ticker,
      wl: newTrade.wl,
      position: newTrade.position,
      setup: newTrade.setup || [],
      target: newTrade.target || "",
      rr: newTrade.rr || "",
      pl: newTrade.pl || 0,
      notes: newTrade.notes || "",
    };

    try {
      const { error } = await supabase.from("trades").insert([tradeToInsert]);
      if (error) {
        console.error("Failed to add trade to Supabase:", error);
        toast.error("Failed to add trade.");
        return;
      }

      setNewTrade({ setup: [] });
      setCurrentField("");
      toast.success("Trade added successfully!");

      await fetchTradesFromDB(accountSize);
    } catch (err) {
      console.error("Unexpected error when adding trade:", err);
      toast.error("Unexpected error when adding trade.");
    }
  };

  const removeRow = async (id: string) => {
    if (!user) {
      toast.error("User not logged in.");
      return;
    }

    console.log("Attempting to remove trade with id:", id, "User ID:", user.id);

    try {
      const { error } = await supabase
        .from("trades")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id); // ensures only the user's own trade can be deleted

      if (error) {
        console.error("Failed to remove trade:", error);
        toast.error("Failed to remove trade.");
        return;
      }

      console.log("Trade deleted successfully:", id);
      toast.success("Trade removed successfully!");
      await fetchTradesFromDB(accountSize);
    } catch (err) {
      console.error("Unexpected error when removing trade:", err);
      toast.error("Unexpected error when removing trade.");
    }
  };

  const clearRow = () => {
    setNewTrade({ setup: [] })
    setCurrentField("")
  }

  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number)
    const d = new Date(year, month - 1, day) // construct as local date
    d.setHours(0, 0, 0, 0)
    return d
  }

  const filteredTrades = trades.filter((trade) => {
    // Parse trade date into Date object
    const tradeDate = parseLocalDate(trade.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate start of this week (Monday)
    const dayOfWeek = today.getDay() // Sunday=0, Monday=1, ...
    const mondayOffset = (dayOfWeek + 6) % 7 // number of days since Monday
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - mondayOffset)
    weekStart.setHours(0, 0, 0, 0)

    // Calculate start of this month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    // Apply time filter
    if (timeFilter === "week" && tradeDate < weekStart) return false
    if (timeFilter === "month" && tradeDate < monthStart) return false

    // Apply outcome / confluence filters
    if (filter === "win" && trade.wl !== "Win") return false
    if (filter === "loss" && trade.wl !== "Loss") return false
    if (confluences.some((c) => c.name === filter) && !(trade.setup ?? []).includes(filter)) return false

    return true
  })

  const winRate =
    filteredTrades.length > 0 ? ((filteredTrades.filter((t) => t.wl === "Win").length / filteredTrades.length) * 100).toFixed(1) : "0"
  const totalPnL = filteredTrades.reduce((sum, trade) => sum + trade.pl, 0)

  const getAccountSizeNumber = (sizeStr: string): number => {
    const numStr = sizeStr.replace("k", "")
    return Number.parseInt(numStr) * 1000
  }

  const getDrawdownPercent = (drawdownStr: string): number => {
    const numStr = drawdownStr.replace("%", "")
    return Number.parseFloat(numStr) / 100
  }

  // Fetch settings, profile, and trades from Supabase when user changes
  useEffect(() => {
    if (!user) return;

    const fetchSettingsTradesAndProfile = async () => {
      const defaultAccountSize = "100k";
      const defaultDrawdown = "1%";

      // --- SETTINGS ---
      let { data: settingsData, error: settingsError } = await supabase
        .from("settings")
        .select("account_size, drawdown")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) {
        console.error("Failed to fetch settings:", settingsError);
      }

      if (!settingsData) {
        const { data: inserted, error: insertError } = await supabase
          .from("settings")
          .insert([{ user_id: user.id, account_size: defaultAccountSize, drawdown: defaultDrawdown }])
          .select()
          .single();

        if (insertError) console.error("Failed to insert default settings:", insertError);

        settingsData = inserted;
      }

      setAccountSize(settingsData?.account_size || defaultAccountSize);
      setDrawdown(settingsData?.drawdown || defaultDrawdown);

      // --- PROFILES ---
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) console.error("Failed to fetch profile:", profileError);

      if (!profileData) {
        const { data: insertedProfile, error: insertProfileError } = await supabase
          .from("profiles")
          .insert([{ user_id: user.id, role: "free" }])
          .select()
          .single();

        if (insertProfileError) console.error("Failed to insert default profile:", insertProfileError);

        profileData = insertedProfile;
      }

      console.log("Fetched profile role:", profileData?.role);
      setIsPremium(profileData?.role?.toLowerCase() === "premium");

      // --- TRADES ---
      await fetchTradesFromDB(settingsData?.account_size || defaultAccountSize);
    };

    fetchSettingsTradesAndProfile();
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-foreground">
      <Card className="border-slate-700/50 shadow-2xl bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Logo size="md" variant="full" />
              </div>
              <div className="h-6 w-px bg-gradient-to-b from-transparent via-slate-400 to-transparent"></div>
              <div className="flex items-center gap-4">
                {/* Increased gap from 3 to 4 for better spacing */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-slate-800/80 to-slate-700/80 border border-slate-600 shadow-lg backdrop-blur-sm">
                  <DollarSign className="w-4 h-4 text-emerald-400 drop-shadow-lg" />
                  <span className="text-xs font-medium text-white drop-shadow-sm">Account Size:</span>
                  {isPremium ? (
                    <Select value={accountSize} onValueChange={(val) => updateSetting("account_size", val)}>
                      <SelectTrigger className="w-20 h-8 bg-slate-800 border-slate-600 text-white shadow-inner text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="25k">25k</SelectItem>
                        <SelectItem value="50k">50k</SelectItem>
                        <SelectItem value="100k">100k</SelectItem>
                        <SelectItem value="150k">150k</SelectItem>
                        <SelectItem value="200k">200k</SelectItem>
                        <SelectItem value="250k">250k</SelectItem>
                        <SelectItem value="300k">300k</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Upgrade to Premium to unlock</span>
                  )}
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-slate-800/80 to-slate-700/80 border border-slate-600 shadow-lg backdrop-blur-sm">
                  <Target className="w-4 h-4 text-red-400 drop-shadow-lg" />
                  <span className="text-xs font-medium text-white drop-shadow-sm">Drawdown:</span>
                  {isPremium ? (
                    <Select value={drawdown} onValueChange={(val) => updateSetting("drawdown", val)}>
                      <SelectTrigger className="w-16 h-8 bg-slate-800 border-slate-600 text-white shadow-inner text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="1%">1%</SelectItem>
                        <SelectItem value="2%">2%</SelectItem>
                        <SelectItem value="3%">3%</SelectItem>
                        <SelectItem value="4%">4%</SelectItem>
                        <SelectItem value="5%">5%</SelectItem>
                        <SelectItem value="6%">6%</SelectItem>
                        <SelectItem value="7%">7%</SelectItem>
                        <SelectItem value="8%">8%</SelectItem>
                        <SelectItem value="9%">9%</SelectItem>
                        <SelectItem value="10%">10%</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Upgrade to Premium to unlock</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {" "}
              {/* Increased gap from 4 to 6 for better spacing */}
              <div className="flex items-center gap-3 text-base font-semibold">
                {" "}
                {/* Increased gap from 3 to 4 */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-900/80 to-emerald-800/80 border border-emerald-700 shadow-lg backdrop-blur-sm transform translate-x-1">
                  <TrendingUp className="w-4 h-4 text-emerald-300 drop-shadow-lg" />
                  <span className="text-white font-bold text-lg drop-shadow-sm">Win Rate: {winRate}%</span>
                </div>
                <div className="h-5 w-px bg-gradient-to-b from-transparent via-slate-400 to-transparent"></div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-slate-800/80 to-slate-700/80 border border-slate-600 shadow-lg backdrop-blur-sm transform -translate-x-1">
                  <BarChart3 className="w-4 h-4 text-slate-300 drop-shadow-lg" />
                  <span className="text-white font-medium text-sm drop-shadow-sm">Total P&L:</span>
                  <span
                    className={`font-bold text-lg drop-shadow-sm ${totalPnL === 0 ? "text-white" : totalPnL > 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {totalPnL > 0 ? "+" : ""}${totalPnL.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Increased gap from 2 to 3 for better spacing */}
              {isPremium ? (
                <>
                  <Button
                    size="sm"
                    variant={timeFilter === "week" ? "default" : "outline"}
                    className={`h-8 px-3 text-xs transition-all duration-200 hover:scale-105 ${
                      timeFilter === "week" 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" 
                        : "bg-slate-600 text-white border-slate-500 hover:bg-slate-500"
                    }`}
                    onClick={() => setTimeFilter(timeFilter === "week" ? "" : "week")}
                  >
                    <CalendarDays className="w-3 h-3 mr-1" />
                    Week
                  </Button>
                  <Button
                    size="sm"
                    variant={timeFilter === "month" ? "default" : "outline"}
                    className={`h-8 px-3 text-xs transition-all duration-200 hover:scale-105 ${
                      timeFilter === "month" 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" 
                        : "bg-slate-600 text-white border-slate-500 hover:bg-slate-500"
                    }`}
                    onClick={() => setTimeFilter(timeFilter === "month" ? "" : "month")}
                  >
                    <Calendar className="w-3 h-3 mr-1" />
                    Month
                  </Button>
                  <Select value={filter || "All"} onValueChange={setFilter}>
                    <SelectTrigger className="w-20 h-8 bg-slate-600 border-slate-500 text-white shadow-inner text-xs">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="win">Win</SelectItem>
                      <SelectItem value="loss">Loss</SelectItem>
                      {confluences.map((confluence) => (
                        <SelectItem key={confluence.name} value={confluence.name}>
                          {confluence.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <span className="text-slate-400 text-xs italic">Upgrade to Premium to use filters</span>
              )}
              <Button
                size="sm"
                onClick={addRow}
                className="h-8 px-3 text-xs bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/25 transition-all duration-200 hover:scale-105 hover:shadow-green-600/40"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Trade
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex gap-6 mt-6">
        {/* Left Column - Charts and Trading Journal */}
        <div className="flex-1 space-y-4">
          {/* Chart Section - only Graphs view */}
          <Card className="border-slate-700/50 shadow-2xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <FuturesChart
                trades={filteredTrades}
                accountSize={getAccountSizeNumber(accountSize)}
                drawdownPercent={getDrawdownPercent(drawdown)}
                isPremium={isPremium}
              />
            </CardContent>
          </Card>

          <Card className="border-slate-700/50 shadow-2xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Logo size="sm" variant="icon" />
                </div>
                <h3 className="font-semibold text-slate-200 text-lg drop-shadow-sm">Trading Journal</h3>
                <Badge
                  variant="secondary"
                  className="ml-auto bg-slate-700/50 text-slate-300 border border-slate-600/30 shadow-sm"
                >
                  {filteredTrades.length} trades
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden rounded-lg border border-slate-700/50 shadow-inner">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-b border-slate-600/50">
                      <th className="p-4 text-left font-semibold text-slate-200 border-r border-slate-600/30 drop-shadow-sm">
                        Date
                      </th>
                      <th className="p-4 text-left font-semibold text-slate-200 border-r border-slate-600/30 drop-shadow-sm">
                        Ticker
                      </th>
                      <th className="p-4 text-left font-semibold text-slate-200 border-r border-slate-600/30 drop-shadow-sm">
                        W/L
                      </th>
                      <th className="p-4 text-left font-semibold text-slate-200 border-r border-slate-600/30 drop-shadow-sm">
                        Position
                      </th>
                      <th className="p-4 text-left font-semibold text-slate-200 border-r border-slate-600/30 drop-shadow-sm">
                        Setup
                      </th>
                      <th className="p-4 text-left font-semibold text-slate-200 border-r border-slate-600/30 drop-shadow-sm">
                        Target
                      </th>
                      <th className="p-4 text-left font-semibold text-slate-200 border-r border-slate-600/30 drop-shadow-sm">
                        RR
                      </th>
                      <th className="p-4 text-left font-semibold text-slate-200 border-r border-slate-600/30 drop-shadow-sm">
                        P&L
                      </th>
                      <th className="p-4 text-left font-semibold text-slate-200 border-r border-slate-600/30 drop-shadow-sm">Notes</th>
                      <th className="p-4 text-left font-semibold text-slate-200 drop-shadow-sm">
                        Remove
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* New Trade Row */}
                    <tr className="border-b border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/30 transition-all duration-200">
                      <td className="p-4 border-r border-slate-700/30">
                        <Input
                          className="bg-transparent border-none p-0 h-auto text-foreground font-medium"
                          placeholder="Date"
                          value={new Date().toLocaleDateString("en-US", {
                            month: "numeric",
                            day: "numeric",
                            year: "2-digit",
                          })}
                          readOnly
                        />
                      </td>
                      <td className="p-4 border-r border-slate-700/30">
                        <Input
                          className="bg-transparent border-none p-0 h-auto text-foreground font-medium"
                          placeholder="Ticker"
                          value={newTrade.ticker || ""}
                          readOnly
                        />
                      </td>
                      <td className="p-4 border-r border-slate-700/30">
                        <Input
                          className="bg-transparent border-none p-0 h-auto text-foreground font-medium"
                          placeholder="W/L"
                          value={newTrade.wl || ""}
                          readOnly
                        />
                      </td>
                      <td className="p-4 border-r border-slate-700/30">
                        <Input
                          className="bg-transparent border-none p-0 h-auto text-foreground font-medium"
                          placeholder="Position"
                          value={newTrade.position || ""}
                          readOnly
                        />
                      </td>
                      <td className="p-4 border-r border-slate-700/30">
                        <div className="flex gap-1 flex-wrap">
                          {(newTrade.setup || []).map((setup) => (
                            <Badge key={setup} variant="secondary" className="text-xs bg-slate-600/50 text-slate-200">
                              {setup}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 border-r border-slate-700/30">
                        <Input
                          className="bg-transparent border-none p-0 h-auto text-foreground font-medium"
                          placeholder="Target"
                          value={newTrade.target || ""}
                          readOnly
                        />
                      </td>
                      <td className="p-4 border-r border-slate-700/30">
                        <Input
                          className="bg-transparent border-none p-0 h-auto text-foreground font-medium"
                          placeholder="RR"
                          value={newTrade.rr || ""}
                          readOnly
                        />
                      </td>
                      <td className="p-4 border-r border-slate-700/30">
                        <Input
                          className="bg-transparent border-none p-0 h-auto text-foreground font-medium"
                          placeholder="P&L"
                          value={newTrade.pl || ""}
                          readOnly
                        />
                      </td>
                      <td className="p-4 border-r border-slate-700/30">
                        <Input
                          className="bg-transparent border-none p-0 h-auto text-foreground font-medium"
                          placeholder="Notes"
                          value={newTrade.notes || ""}
                          readOnly
                        />
                      </td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearRow}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>

                    {/* Existing Trades */}
                    {filteredTrades.map((trade) => (
                      <tr
                        key={trade.id}
                        className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-all duration-200"
                      >
                        <td className="p-4 border-r border-slate-700/30 text-slate-300 font-medium">
                          {new Date(trade.date).toLocaleDateString("en-US", {
                            month: "numeric",
                            day: "numeric",
                            year: "2-digit",
                          })}
                        </td>
                        <td className="p-4 border-r border-slate-700/30">
                          <Badge
                            className={`font-semibold ${
                              tickerColors[trade.ticker as keyof typeof tickerColors] || "bg-gray-500 text-white"
                            }`}
                          >
                            {trade.ticker}
                          </Badge>
                        </td>
                        <td className="p-4 border-r border-slate-700/30">
                          <Badge
                            variant={trade.wl === "Win" ? "default" : "destructive"}
                            className={`font-semibold ${
                              trade.wl === "Win"
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
                                : "bg-red-600 text-white shadow-lg shadow-red-600/25"
                            }`}
                          >
                            {trade.wl}
                          </Badge>
                        </td>
                        <td className="p-4 border-r border-slate-700/30">
                          <Badge
                            variant="outline"
                            className={`font-semibold ${
                              trade.position === "Long"
                                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                                : "border-red-500 text-red-400 bg-red-500/10"
                            }`}
                          >
                            {trade.position}
                          </Badge>
                        </td>
                        <td className="p-4 border-r border-slate-700/30">
                          <div className="flex gap-1 flex-wrap">
                            {(trade.setup || []).map((setup) => {
                              const confluence = confluences.find((c) => c.name === setup)
                              return (
                                <Badge
                                  key={setup}
                                  className={`text-xs font-semibold ${confluence?.color || "bg-gray-500 text-white"}`}
                                >
                                  {setup}
                                </Badge>
                              )
                            })}
                          </div>
                        </td>
                        <td className="p-4 border-r border-slate-700/30">
                          {trade.target && (
                            <Badge
                              className={`text-xs font-semibold ${
                                targetColors[trade.target as keyof typeof targetColors] || "bg-gray-500 text-white"
                              }`}
                            >
                              {trade.target}
                            </Badge>
                          )}
                        </td>
                        <td className="p-4 border-r border-slate-700/30 text-slate-300 font-medium">{trade.rr}</td>
                        <td className="p-4 border-r border-slate-700/30">
                          <span
                            className={`font-bold ${
                              trade.pl === 0 ? "text-white" : trade.pl > 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {trade.pl > 0 ? "+" : ""}${trade.pl.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 border-r border-slate-700/30 text-slate-300 font-medium max-w-32 truncate">
                          {trade.notes}
                        </td>
                        <td className="p-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeRow(trade.id)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Entry Form */}
        <div className="w-80 space-y-4">
          <Card className="border-slate-700/50 shadow-2xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Logo size="sm" variant="icon" />
                </div>
                <h3 className="font-semibold text-slate-200 text-lg drop-shadow-sm">Quick Entry</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ticker Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Ticker</label>
                <div className="grid grid-cols-2 gap-2">
                  {tickers.map((ticker) => (
                    <Button
                      key={ticker}
                      size="sm"
                      variant={newTrade.ticker === ticker ? "default" : "outline"}
                      className={`${
                        newTrade.ticker === ticker
                          ? tickerColors[ticker as keyof typeof tickerColors]
                          : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                      }`}
                      onClick={() => handleButtonClick(ticker, "ticker")}
                    >
                      {ticker}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Win/Loss Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Outcome</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={newTrade.wl === "Win" ? "default" : "outline"}
                    className={`${
                      newTrade.wl === "Win"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/25"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                    }`}
                    onClick={() => handleButtonClick("Win", "wl")}
                  >
                    Win
                  </Button>
                  <Button
                    size="sm"
                    variant={newTrade.wl === "Loss" ? "default" : "outline"}
                    className={`${
                      newTrade.wl === "Loss"
                        ? "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/25"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                    }`}
                    onClick={() => handleButtonClick("Loss", "wl")}
                  >
                    Loss
                  </Button>
                </div>
              </div>

              {/* Position Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Position</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={newTrade.position === "Long" ? "default" : "outline"}
                    className={`${
                      newTrade.position === "Long"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-500"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                    }`}
                    onClick={() => handleButtonClick("Long", "position")}
                  >
                    Long
                  </Button>
                  <Button
                    size="sm"
                    variant={newTrade.position === "Short" ? "default" : "outline"}
                    className={`${
                      newTrade.position === "Short"
                        ? "bg-red-600 text-white hover:bg-red-700 border-red-500"
                        : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                    }`}
                    onClick={() => handleButtonClick("Short", "position")}
                  >
                    Short
                  </Button>
                </div>
              </div>

              {/* Setup/Confluences */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Setup (max 3)</label>
                <div className="grid grid-cols-3 gap-1">
                  {confluences.map((confluence) => (
                    <Button
                      key={confluence.name}
                      size="sm"
                      variant={(newTrade.setup || []).includes(confluence.name) ? "default" : "outline"}
                      className={`text-xs ${
                        (newTrade.setup || []).includes(confluence.name)
                          ? confluence.color
                          : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                      }`}
                      onClick={() => handleButtonClick(confluence.name, "setup")}
                      disabled={
                        !(newTrade.setup || []).includes(confluence.name) && (newTrade.setup || []).length >= 3
                      }
                    >
                      {confluence.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Targets */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Target</label>
                <div className="space-y-2">
                  {targets.map((targetRow, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-5 gap-1">
                      {targetRow.map((target) => (
                        <Button
                          key={target}
                          size="sm"
                          variant={newTrade.target === target ? "default" : "outline"}
                          className={`text-xs ${
                            newTrade.target === target
                              ? targetColors[target as keyof typeof targetColors]
                              : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                          }`}
                          onClick={() => handleButtonClick(target, "target")}
                        >
                          {target}
                        </Button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk/Reward */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Risk/Reward</label>
                <Input
                  placeholder="e.g., 1:2"
                  value={newTrade.rr || ""}
                  onChange={(e) => setNewTrade((prev) => ({ ...prev, rr: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
                />
              </div>

              {/* P&L */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">P&L ($)</label>
                <Input
                  type="number"
                  placeholder="e.g., 500"
                  value={newTrade.pl || ""}
                  onChange={(e) => setNewTrade((prev) => ({ ...prev, pl: Number(e.target.value) || 0 }))}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Notes</label>
                <Input
                  placeholder="Trade notes..."
                  value={newTrade.notes || ""}
                  onChange={(e) => setNewTrade((prev) => ({ ...prev, notes: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={clearRow}
                  variant="outline"
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 border-red-500 text-white hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-600/25 transition-all duration-200 hover:scale-105"
                >
                  Clear
                </Button>
                <Button
                  onClick={addRow}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  disabled={!newTrade.ticker || !newTrade.wl || !newTrade.position}
                >
                  Add Trade
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Toaster position="top-right" />
    </div>
  )
}
