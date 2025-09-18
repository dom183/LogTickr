"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { TradingDashboard } from "@/components/trading-dashboard";
import { loadStripe } from "@stripe/stripe-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Chart from "chart.js/auto";

export default function Home() {
  const [user, setUser] = useState<any | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showSupportEmail, setShowSupportEmail] = useState(false);
  const initialFetchDone = useRef(false);

  const [showExportPopup, setShowExportPopup] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // State for all trades
  const [allTrades, setAllTrades] = useState<any[]>([]);
  // State for equity curve
  const [equityCurve, setEquityCurve] = useState<number[]>([]);

  useEffect(() => {
    console.log("useEffect started: fetching session and profile");

    // Helper for reuse in Electron IPC
    const fetchSessionAndProfile = async () => {
      try {
        console.log("Fetching session data from Supabase...");
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Session fetch error:", sessionError);
          setUser(null);
          return;
        }
        const currentUser = sessionData?.session?.user ?? null;

        if (!currentUser) {
          console.log("No current user found in session.");
          setUser(null);
          return;
        }

        console.log("Fetching user profile for user id:", currentUser.id);
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (profileError) {
          console.error("Profile fetch error:", profileError);
        }

        console.log("Setting user state with profile role:", profile?.role ?? "free");
        setUser({ ...currentUser, role: profile?.role ?? "free" });

        // Fetch trades for user here and setAllTrades
        const { data: tradesData, error: tradesError } = await supabase
          .from("trades")
          .select("*")
          .eq("user_id", currentUser.id);
        if (tradesError) {
          console.error("Trades fetch error:", tradesError);
          setAllTrades([]);
        } else {
          setAllTrades(tradesData || []);
        }
      } catch (err) {
        console.error("Error fetching session/profile:", err);
        setUser(null);
      } finally {
        setCheckingSession(false);
        initialFetchDone.current = true;
        console.log("Finished fetching session and profile, checkingSession set to false");
      }
    };

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("checkoutSuccess")) {
        console.log("Detected checkoutSuccess in URL, refetching session/profile to update user role");

        // Refetch profile and trades
        const fetchUpdatedProfile = async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const currentUser = sessionData?.session?.user ?? null;
            if (!currentUser) return;

            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", currentUser.id)
              .maybeSingle();

            setUser({ ...currentUser, role: profile?.role ?? "free" });

            const { data: tradesData } = await supabase
              .from("trades")
              .select("*")
              .eq("user_id", currentUser.id);

            setAllTrades(tradesData || []);
          } catch (err) {
            console.error("Error refetching profile after checkout:", err);
          } finally {
            const newUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          }
        };

        fetchUpdatedProfile();
      } else {
        fetchSessionAndProfile();
      }

      // Electron IPC listener setup
      if ((window as any).require) {
        try {
          const { ipcRenderer } = (window as any).require("electron");
          ipcRenderer.on("checkout-success", () => {
            console.log("Received checkout-success from Electron protocol");
            fetchSessionAndProfile();
          });
          ipcRenderer.on("checkout-cancel", () => {
            console.log("Received checkout-cancel from Electron protocol");
            window.history.replaceState({}, document.title, window.location.pathname);
          });
        } catch (e) {
          console.error("Failed to set up ipcRenderer listeners:", e);
        }
      }
    } else {
      setCheckingSession(false);
      initialFetchDone.current = true;
    }

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state change detected");
      if (!initialFetchDone.current) {
        console.log("Initial fetch not done yet, skipping auth state change handling");
        return;
      }
      const currentUser = session?.user ?? null;
      if (!currentUser) {
        console.log("No user found on auth state change, setting user to null");
        setUser(null);
        return;
      }

      try {
        console.log("Upserting profile on auth state change for user id:", currentUser.id);
        await supabase.from("profiles").upsert({ id: currentUser.id, email: currentUser.email });

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (profileError) {
          console.error("Profile fetch error on auth state change:", profileError);
        }

        console.log("Setting user state on auth state change with role:", profile?.role ?? "free");
        setUser({ ...currentUser, role: profile?.role ?? "free" });

        // Fetch trades for user here and update allTrades
        const { data: tradesData, error: tradesError } = await supabase
          .from("trades")
          .select("*")
          .eq("user_id", currentUser.id);
        if (tradesError) {
          console.error("Trades fetch error:", tradesError);
          setAllTrades([]);
        } else {
          setAllTrades(tradesData || []);
        }
      } catch (err) {
        console.error("Auth state change error:", err);
        setUser({ ...currentUser, role: "free" });
      }
    });

    return () => {
      console.log("Cleaning up auth state change listener");
      listener.subscription.unsubscribe();
    };
  }, []);

  // Updated generatePDF function to use settings account_size and fix winrate and balance calculation
  const generatePDF = async (trades: any[], startDate: string, endDate: string, equityCurve?: number[]) => {
  if (!trades.length) { 
    alert("No trades in selected range."); 
    return; 
  }

  // Fetch account size from settings table for this user
  const { data: settingsData } = await supabase
    .from("settings")
    .select("account_size")
    .eq("user_id", user?.id)
    .maybeSingle();
  const startingBalance = Number(settingsData?.account_size ?? 0);

  // Filter trades within the selected date range
  const filteredTrades = trades.filter(t => {
    const tradeDate = new Date(t.date);
    return tradeDate >= new Date(startDate) && tradeDate <= new Date(endDate);
  });

  if (!filteredTrades.length) { 
    alert("No trades in selected range."); 
    return; 
  }

  // Compute trades with account balance using equityCurve if available,
// otherwise calculate running balance from P/L
let runningBalance = startingBalance;
const tradesWithEquity = filteredTrades.map((t, index) => {
  let balance: number;

  if (equityCurve && equityCurve.length === filteredTrades.length) {
    balance = Number(equityCurve[index]);
    if (isNaN(balance)) {
      balance = runningBalance + Number(t.pl ?? 0);
    }
  } else {
    balance = runningBalance + Number(t.pl ?? 0);
  }

  runningBalance = balance;
  return { ...t, accountBalance: balance };
});

  // Compute win/loss stats
  const wins = tradesWithEquity.filter(t => t.wl?.toLowerCase() === "win").length;
  const losses = tradesWithEquity.filter(t => t.wl?.toLowerCase() === "loss").length;
  const winrate = tradesWithEquity.length > 0 ? ((wins / tradesWithEquity.length) * 100).toFixed(1) : "0";

  // Start/End balance based on tradesWithEquity
  const startBalance = tradesWithEquity[0]?.accountBalance ?? startingBalance;
  const endBalance = tradesWithEquity[tradesWithEquity.length - 1]?.accountBalance ?? startingBalance;

  // Total cumulative PnL
  const cumulativePnL = tradesWithEquity.reduce((acc, t) => acc + Number(t.pl ?? 0), 0);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setFontSize(18);
  doc.text("Trade Report", 40, 40);
  doc.setFontSize(12);
  doc.text(`Date Range: ${startDate} - ${endDate}`, 40, 70);
  doc.text(`Total Trades: ${tradesWithEquity.length}`, 40, 90);
  doc.text(`Win Rate: ${winrate}%`, 40, 110);
  doc.text(`Cumulative PnL: $${cumulativePnL.toFixed(2)}`, 40, 130);
  doc.text(`Account Start: $${Number(startBalance).toFixed(2)}`, 40, 150);
  doc.text(`Account End: $${Number(endBalance).toFixed(2)}`, 40, 170);

  // Pie chart
  const canvas = document.createElement("canvas");
  canvas.width = 200; canvas.height = 200;
  const ctx = canvas.getContext("2d")!;
  new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Wins", "Losses"],
      datasets: [{ data: [wins, losses], backgroundColor: ["#22c55e", "#ef4444"] }]
    },
    options: { plugins: { legend: { display: true, position: "bottom" } }, responsive: false }
  });

  const chartDataURL = canvas.toDataURL("image/png");
  doc.addImage(chartDataURL, "PNG", 350, 80, 180, 180);

  // Table with accurate account balances
  autoTable(doc, {
    head: [["Date", "Ticker", "Position", "P/L", "Win/Loss", "Account Balance"]],
    body: tradesWithEquity.map(t => [
      t.date ?? "",
      t.ticker ?? "",
      t.position ?? "",
      (Number(t.pl ?? 0)).toFixed(2),
      t.wl ?? "",
      (Number(t.accountBalance ?? 0)).toFixed(2)
    ]),
    startY: 270,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    alternateRowStyles: { fillColor: [240, 240, 240] }
  });

  doc.save(`TradeReport_${startDate}_to_${endDate}.pdf`);
};

  const handleSignUp = async () => {
    setErrorMessage("");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (!data?.user) {
        setErrorMessage("Signup failed: No user returned.");
        return;
      }

      await supabase
        .from("profiles")
        .upsert({
          user_id: data.user.id,
          email: data.user.email,
          role: "free" // ensure new users start as free
        })
        .then(({ error }) => {
          if (error) console.error("Failed to create profile:", error);
        });

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .maybeSingle();

      setUser({ ...data.user, role: profile?.role ?? "free" });
      if (profileError) console.error("Profile fetch error:", profileError);

      setErrorMessage("✅ Check your email for a confirmation link!");
    } catch (err: any) {
      setErrorMessage(err.message || "Unexpected error during sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setErrorMessage("");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (!data?.user) {
        setErrorMessage("Login failed: No user returned.");
        return;
      }

      // Only upsert user_id and email, do NOT set role: "free" so we don't overwrite role set by Stripe/webhook
      await supabase
        .from("profiles")
        .upsert({
          user_id: data.user.id,
          email: data.user.email
        })
        .then(({ error }) => {
          if (error) console.error("Failed to upsert profile on login:", error);
        });

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .maybeSingle();

      setUser({ ...data.user, role: profile?.role ?? "free" });
      if (profileError) console.error("Profile fetch error:", profileError);
    } catch (err: any) {
      setErrorMessage(err.message || "Unexpected error during login.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleUpgradeToPremium = async () => {
    if (!user) return;
    try {
      const response = await fetch("https://trading-journal-api.vercel.app/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });
      if (!response.ok) throw new Error("Failed to create checkout session.");

      const { sessionId } = await response.json();
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) throw new Error("Stripe failed to initialize.");

      const redirectResult = await stripe.redirectToCheckout({ sessionId });
      if (redirectResult.error) throw new Error(redirectResult.error.message);
    } catch (error: any) {
      setErrorMessage(error.message || "An unexpected error occurred during upgrade.");
    }
  };

  if (checkingSession) {
    return <p className="text-center mt-20">Loading...</p>;
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <h1 className="text-xl font-bold">Login or Sign Up</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-3 py-2 border rounded w-64 bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-3 py-2 border rounded w-64 bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
          disabled={loading}
        />

        {errorMessage && <p className="text-red-500">{errorMessage}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleLogin}
            className="px-4 py-2 rounded bg-blue-600 text-white"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
          <button
            onClick={handleSignUp}
            className="px-4 py-2 rounded bg-green-600 text-white"
            disabled={loading}
          >
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="flex justify-end p-4 gap-2 relative z-60 bg-background">
        <button
          onClick={() => user?.role === "premium" && setShowExportPopup(true)}
          className={`px-3 py-1 rounded transition-all duration-200 ${
            user?.role === "premium"
              ? "bg-gray-200 text-gray-800 hover:bg-gray-300 border border-gray-300"
              : "bg-gray-400 text-gray-600 cursor-not-allowed opacity-60"
          }`}
          title={user?.role === "free" ? "Upgrade to Premium to export data" : ""}
        >
          Export Data
        </button>
        {showSupportEmail ? (
          <span
            onClick={() => setShowSupportEmail(false)}
            className="px-3 py-1 rounded bg-gray-200 text-gray-800 cursor-pointer border border-gray-300"
          >
            logtickrcustomersupport@gmail.com
          </span>
        ) : (
          <button
            onClick={() => setShowSupportEmail(true)}
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 border border-blue-600"
          >
            Customer Support & Feedback
          </button>
        )}
        {user.role === "free" && (
          <button
            onClick={handleUpgradeToPremium}
            className="px-3 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-500 border border-yellow-600"
          >
            Upgrade to Premium
          </button>
        )}
        <button
          onClick={handleLogout}
          className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 border border-red-600"
        >
          Logout
        </button>
      </div>
      {showExportPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-slate-800 p-6 rounded shadow-lg w-80">
            <h3 className="font-semibold mb-4 text-white">Select Date Range</h3>
            <div className="flex flex-col gap-2 mb-4">
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="p-2 rounded border border-slate-600 bg-slate-700 text-white"
              />
              <span className="text-center text-white">to</span>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="p-2 rounded border border-slate-600 bg-slate-700 text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 rounded bg-gray-600 text-white hover:bg-gray-700"
                onClick={() => setShowExportPopup(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={async () => {
                  await generatePDF(allTrades, exportStartDate, exportEndDate, equityCurve);
                  setShowExportPopup(false);
                }}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
      <TradingDashboard user={user} setEquityCurve={setEquityCurve} />
    </main>
  );
}