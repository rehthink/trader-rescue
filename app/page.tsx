'use client';

import { useState, useEffect, useRef } from "react";
import {
  TrendingDown, TrendingUp, Search, RefreshCw, Clock,
  Shield, Target, DollarSign, BarChart2, AlertTriangle,
  ArrowRight, Zap, ChevronDown, X, Info, Layers
} from "lucide-react";

const C = {
  bg: "#06091a",
  surface: "#0b1025",
  surface2: "#0f1630",
  surface3: "#131d3a",
  surface4: "#172140",
  border: "#1a2848",
  border2: "#203059",
  text: "#d6e4f7",
  textMuted: "#5a7a9e",
  textDim: "#2a3d5a",
  emerald: "#10d98a",
  emeraldDim: "#042d1c",
  emeraldMid: "#065535",
  rose: "#ff3d68",
  roseDim: "#3d0018",
  roseMid: "#5c0025",
  amber: "#ffb830",
  amberDim: "#3d2200",
  sky: "#38c6f8",
  skyDim: "#032840",
  skyMid: "#054a74",
  purple: "#a78bfa",
  purpleDim: "#1e0d45",
};

const STOCKS = {
  AAPL: { name: "Apple Inc.", price: 189.43, chg: -0.85 },
  MSFT: { name: "Microsoft Corp.", price: 421.72, chg: 1.12 },
  TSLA: { name: "Tesla Inc.", price: 178.21, chg: -3.42 },
  NVDA: { name: "NVIDIA Corp.", price: 875.35, chg: 2.67 },
  GOOGL: { name: "Alphabet Inc.", price: 172.86, chg: 0.44 },
  AMZN: { name: "Amazon.com", price: 185.60, chg: -0.22 },
  META: { name: "Meta Platforms", price: 538.92, chg: 1.85 },
  NFLX: { name: "Netflix Inc.", price: 668.44, chg: 3.11 },
  RELIANCE: { name: "Reliance Industries", price: 2847.50, chg: -0.65 },
  TCS: { name: "Tata Consultancy", price: 3421.80, chg: 0.92 },
  INFY: { name: "Infosys Ltd.", price: 1562.40, chg: -1.23 },
  HDFCBANK: { name: "HDFC Bank", price: 1687.25, chg: 0.38 },
  WIPRO: { name: "Wipro Ltd.", price: 478.60, chg: -0.74 },
  BAJFINANCE: { name: "Bajaj Finance", price: 6823.40, chg: 1.56 },
  TATAMOTORS: { name: "Tata Motors", price: 972.35, chg: -2.18 },
  ICICIBANK: { name: "ICICI Bank", price: 1234.60, chg: 0.82 },
  ADANIPORTS: { name: "Adani Ports", price: 1387.40, chg: -1.04 },
  SUNPHARMA: { name: "Sun Pharma", price: 1847.20, chg: 0.63 },
};

/*const fmt = (n: number | string | null, dec: number = 2) => {
  if (n == null || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n);
};*/

const fmt = (n: any, dec: number = 2): string => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (num == null || isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "decimal",
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(num);
};

const fmtCur = (n) => {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(2)}K`;
  return `${sign}₹${abs.toFixed(2)}`;
};

// ─── Finance Engine ───────────────────────────────────────────────────────────
const calcStatus = (avg, qty, cmp) => ({
  totalInvested: avg * qty,
  currentValue: cmp * qty,
  pnl: (cmp - avg) * qty,
  pnlPct: ((cmp - avg) / avg) * 100,
  gapPct: ((cmp - avg) / avg) * 100,
});

const calcTargetMode = (avg, qty, cmp, target) => {
  if (target >= avg || target <= cmp || target <= 0) return null;
  const addQty = Math.ceil((qty * (avg - target)) / (target - cmp));
  const capital = addQty * cmp;
  const newAvg = (avg * qty + capital) / (qty + addQty);
  return { addQty, capital, newAvg, totalQty: qty + addQty };
};

const calcCapitalMode = (avg, qty, cmp, capital) => {
  if (capital <= 0) return null;
  const addQty = capital / cmp;
  const newAvg = (avg * qty + capital) / (qty + addQty);
  const distBreakeven = ((newAvg - cmp) / cmp) * 100;
  return { addQty, capital, newAvg, totalQty: qty + addQty, distBreakeven };
};

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimNum({ value, prefix = "", suffix = "", dec = 2, color }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (isNaN(end) || isNaN(start)) { setDisplay(end); return; }
    const duration = 400;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = end;
    };
    requestAnimationFrame(tick);
  }, [value]);
  const n = typeof display === "number" ? display : value;
  const str = isNaN(n) ? "—" : `${prefix}${fmt(n, dec)}${suffix}`;
  return <span style={{ color }}>{str}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TradeRescue() {
  const [tickerInput, setTickerInput] = useState("");
  const [ticker, setTicker] = useState("");
  const [stockInfo, setStockInfo] = useState(null);
  const [cmp, setCmp] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [qty, setQty] = useState("");
  const [fetching, setFetching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [mode, setMode] = useState("target");
  const [targetAvg, setTargetAvg] = useState("");
  const [capitalAmt, setCapitalAmt] = useState("");
  const [showMath, setShowMath] = useState(false);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);
  const sugRef = useRef(null);

  useEffect(() => {
    const r = localStorage.getItem("tr-history-v2");
    if (r) setHistory(JSON.parse(r));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (sugRef.current && !sugRef.current.contains(e.target)) setShowSug(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // const fetchPrice = async (sym) => {
  //   if (!sym) return;
  //   setFetching(true);
  //   setShowSug(false);
  //   await new Promise((r) => setTimeout(r, 700));
  //   const s = STOCKS[sym.toUpperCase()];
  //   if (s) {
  //     setCmp(s.price.toString());
  //     setStockInfo(s);
  //     setTicker(sym.toUpperCase());
  //   } else {
  //     const p = (Math.random() * 600 + 100).toFixed(2);
  //     setStockInfo({ name: sym.toUpperCase(), price: +p, chg: (Math.random() * 6 - 3).toFixed(2) });
  //     setCmp(p);
  //     setTicker(sym.toUpperCase());
  //   }
  //   setFetching(false);
  // };

    const fetchPrice = async (sym) => {
      if (!sym) return;
      setFetching(true);
      setShowSug(false);

      try {
        // Calling our local API route
        const response = await fetch(`/api/stock?symbol=${sym.toUpperCase()}`);
        const data = await response.json();

        if (data.error) {
          showToast("Stock not found. Try adding .NS for NSE", "warn");
        } else {
          setCmp(data.price.toString());
          setStockInfo({
            name: data.name,
            price: data.price,
            chg: data.chg
          });
          setTicker(data.symbol);
          showToast(`Loaded ${data.symbol} live price`);
        }
      } catch (err) {
        showToast("Failed to fetch market data", "warn");
      } finally {
        setFetching(false);
      }
    };

  const onTickerChange = (val : String) => {
    setTickerInput(val);
    if (val.length >= 1) {
      const f = Object.entries(STOCKS).filter(
        ([k, v]) =>
          k.startsWith(val.toUpperCase()) ||
          v.name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6);
      setSuggestions(f);
      setShowSug(f.length > 0);
    } else {
      setSuggestions([]);
      setShowSug(false);
    }
  };

  const n = parseFloat;
  const nAvg = n(avgPrice), nQty = n(qty), nCmp = n(cmp);
  const nTarget = n(targetAvg), nCapital = n(capitalAmt);

  const valid =
    !isNaN(nAvg) && !isNaN(nQty) && !isNaN(nCmp) &&
    nAvg > 0 && nQty > 0 && nCmp > 0;
  const status = valid ? calcStatus(nAvg, nQty, nCmp) : null;
  const isLoss = status && status.pnlPct < 0;
  const canAvgDown = isLoss;

  const targetRes =
    valid && mode === "target" && !isNaN(nTarget) && nTarget > 0
      ? calcTargetMode(nAvg, nQty, nCmp, nTarget)
      : null;
  const capitalRes =
    valid && mode === "capital" && !isNaN(nCapital) && nCapital > 0
      ? calcCapitalMode(nAvg, nQty, nCmp, nCapital)
      : null;
  const result = mode === "target" ? targetRes : capitalRes;

  const recovPct = result && valid
    ? Math.max(0, Math.min(100, ((nAvg - result.newAvg) / Math.max(nAvg - nCmp, 0.001)) * 100))
    : 0;

  const whatIfBounces = [3, 5, 10];
  const whatIfData = whatIfBounces.map((pct) => {
    if (!result) return { pct, pnlPct: 0, pnl: 0 };
    const newP = nCmp * (1 + pct / 100);
    const totalInv = result.newAvg * result.totalQty;
    const curVal = newP * result.totalQty;
    return { pct, pnl: curVal - totalInv, pnlPct: ((newP - result.newAvg) / result.newAvg) * 100 };
  });

  const saveHistory = async () => {
    if (!valid || !ticker) return showToast("Enter position details first", "warn");
    const entry = {
      ticker, name: stockInfo?.name || ticker,
      avgPrice: nAvg, qty: nQty, cmp: nCmp,
      newAvg: result?.newAvg?.toFixed(2) || null,
      pnlPct: status.pnlPct.toFixed(2),
      ts: Date.now(),
    };
    const updated = [entry, ...history.filter((h) => h.ticker !== ticker)].slice(0, 5);
    setHistory(updated);
    try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
    showToast("Saved to recent calculations");
  };

  const loadItem = (item) => {
    setTicker(item.ticker);
    setTickerInput(item.ticker);
    setStockInfo(STOCKS[item.ticker] || { name: item.name, price: item.cmp, chg: 0 });
    setCmp(item.cmp.toString());
    setAvgPrice(item.avgPrice.toString());
    setQty(item.qty.toString());
  };

  const delHistory = async (e, idx) => {
    e.stopPropagation();
    const updated = history.filter((_, i) => i !== idx);
    setHistory(updated);
    try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const card = (extra = {}) => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: "1.25rem",
    ...extra,
  });

  const inputStyle = {
    width: "100%",
    background: C.surface3,
    border: `1px solid ${C.border2}`,
    borderRadius: 8,
    padding: "9px 12px",
    color: C.text,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const labelStyle = {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    color: C.textMuted,
    marginBottom: 5,
  };

  const chip = (active, color) => ({
    flex: 1, padding: "9px 4px", borderRadius: 8, cursor: "pointer",
    border: `1px solid ${active ? color : C.border2}`,
    background: active ? `${color}18` : C.surface3,
    color: active ? color : C.textMuted,
    fontSize: 12, fontWeight: 600,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    transition: "all 0.15s",
  });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Mono', 'IBM Plex Mono', 'Courier New', monospace", color: C.text }}>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: toast.type === "success" ? C.emeraldMid : C.amberDim,
          border: `1px solid ${toast.type === "success" ? C.emerald : C.amber}`,
          borderRadius: 10, padding: "10px 16px",
          color: toast.type === "success" ? C.emerald : C.amber,
          fontSize: 12, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
          animation: "slideIn 0.2s ease",
        }}>
          {toast.type === "success" ? <TrendingUp size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "0 24px", height: 56,
        background: `${C.surface}cc`,
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `linear-gradient(135deg, ${C.emerald}cc, ${C.sky}cc)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TrendingUp size={16} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em", color: C.text }}>
              Trade<span style={{ color: C.emerald }}>Rescue</span>
            </div>
            <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Recovery Calculator
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            padding: "5px 12px", borderRadius: 20,
            border: `1px solid ${C.border2}`,
            background: C.surface2,
            fontSize: 10, color: C.textMuted, letterSpacing: "0.06em",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <Shield size={10} color={C.emerald} />
            NO DATA STORED EXTERNALLY
          </div>
        </div>
      </div>

      {/* ── Main Layout ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 40px" }}>
        <div className="tr-grid">

          {/* ═══ LEFT PANEL ════════════════════════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Ticker Search */}
            <div style={card()}>
              <div style={{ ...labelStyle, marginBottom: 10, fontSize: 11, letterSpacing: "0.04em" }}>
                <Search size={10} style={{ marginRight: 4 }} />FETCH LIVE PRICE
              </div>
              <div style={{ position: "relative" }} ref={sugRef}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={13} style={{
                      position: "absolute", left: 10, top: "50%",
                      transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none",
                    }} />
                    <input
                      value={tickerInput}
                      onChange={(e) => onTickerChange(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchPrice(tickerInput)}
                      onFocus={() => tickerInput && setShowSug(suggestions.length > 0)}
                      placeholder="RELIANCE.NS, INFOSYS.NS, TATAMOTORS.NS..."
                      style={{ ...inputStyle, paddingLeft: 32 }}
                    />
                  </div>
                  <button onClick={() => fetchPrice(tickerInput)} disabled={!tickerInput || fetching}
                    style={{
                      padding: "0 16px", borderRadius: 8,
                      background: !tickerInput || fetching ? C.surface3 : C.sky,
                      color: !tickerInput || fetching ? C.textMuted : "#000",
                      border: `1px solid ${!tickerInput || fetching ? C.border2 : C.sky}`,
                      cursor: !tickerInput || fetching ? "not-allowed" : "pointer",
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                      display: "flex", alignItems: "center", gap: 6,
                      fontFamily: "inherit",
                    }}>
                    {fetching
                      ? <RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                      : <>FETCH</>}
                  </button>
                </div>

                {showSug && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
                    background: C.surface3, border: `1px solid ${C.border2}`,
                    borderRadius: 10, overflow: "hidden",
                    boxShadow: `0 8px 32px ${C.bg}cc`,
                  }}>
                    {suggestions.map(([sym, info]) => (
                      <div key={sym} onClick={() => { setTickerInput(sym); fetchPrice(sym); }}
                        style={{
                          padding: "10px 12px", cursor: "pointer",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          borderBottom: `1px solid ${C.border}`,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = C.surface4}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>{sym}</div>
                          <div style={{ fontSize: 10, color: C.textMuted }}>{info.name}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>₹{info.price.toFixed(2)}</div>
                          <div style={{ fontSize: 10, color: info.chg >= 0 ? C.emerald : C.rose }}>
                            {info.chg >= 0 ? "▲" : "▼"} {Math.abs(info.chg)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {stockInfo && ticker && (
                <div style={{
                  marginTop: 12, padding: "12px 14px", borderRadius: 10,
                  background: C.surface2, border: `1px solid ${C.skyDim}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.sky }}>{ticker}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{stockInfo.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.03em" }}>
                      ₹{parseFloat(cmp).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: stockInfo.chg >= 0 ? C.emerald : C.rose }}>
                      {stockInfo.chg >= 0 ? "▲" : "▼"} {Math.abs(stockInfo.chg).toFixed(2)}% today
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Position Inputs */}
            <div style={card()}>
              <div style={{ ...labelStyle, marginBottom: 12 }}>
                <BarChart2 size={10} style={{ marginRight: 4 }} />YOUR POSITION
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>Avg Buy Price</label>
                  <input value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)}
                    placeholder="₹ 250.00" style={inputStyle} type="number" min="0" step="0.01" />
                </div>
                <div>
                  <label style={labelStyle}>Quantity</label>
                  <input value={qty} onChange={(e) => setQty(e.target.value)}
                    placeholder="100 shares" style={inputStyle} type="number" min="0" step="1" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>CMP (override)</label>
                <input value={cmp} onChange={(e) => setCmp(e.target.value)}
                  placeholder="Current market price" style={inputStyle} type="number" min="0" step="0.01" />
              </div>

              {valid && status && (
                <div style={{
                  marginTop: 12, padding: "10px 12px", borderRadius: 8,
                  background: isLoss ? `${C.roseDim}88` : `${C.emeraldDim}88`,
                  border: `1px solid ${isLoss ? C.roseMid : C.emeraldMid}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isLoss
                      ? <TrendingDown size={13} color={C.rose} />
                      : <TrendingUp size={13} color={C.emerald} />}
                    <span style={{ fontSize: 11, color: isLoss ? C.rose : C.emerald, fontWeight: 700 }}>
                      {isLoss ? "LOSING POSITION" : "GAINING POSITION"}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isLoss ? C.rose : C.emerald }}>
                    {status.pnlPct >= 0 ? "+" : ""}{status.pnlPct.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            {/* Recovery Mode */}
            <div style={card()}>
              <div style={{ ...labelStyle, marginBottom: 12 }}>
                <Zap size={10} style={{ marginRight: 4 }} />RECOVERY MODE
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={() => setMode("target")} style={chip(mode === "target", C.emerald)}>
                  <Target size={12} /> TARGET AVG
                </button>
                <button onClick={() => setMode("capital")} style={chip(mode === "capital", C.sky)}>
                  <DollarSign size={12} /> CAPITAL DEPLOY
                </button>
              </div>

              {mode === "target" ? (
                <div>
                  <label style={labelStyle}>Desired Average Price (₹)</label>
                  <input value={targetAvg} onChange={(e) => setTargetAvg(e.target.value)}
                    placeholder={valid ? `Between ₹${fmt(nCmp)} and ₹${fmt(nAvg)}` : "Enter target avg"}
                    style={inputStyle} type="number" min="0" step="0.01" />
                  {valid && !isNaN(nTarget) && nTarget > 0 && (nTarget >= nAvg || nTarget <= nCmp) && (
                    <div style={{ marginTop: 7, fontSize: 10, color: C.amber, display: "flex", gap: 5, alignItems: "flex-start" }}>
                      <AlertTriangle size={10} style={{ marginTop: 1, flexShrink: 0 }} />
                      {nTarget >= nAvg
                        ? "Target must be below your current avg price"
                        : "Target must be above CMP to average down"}
                    </div>
                  )}
                  {valid && !isLoss && (
                    <div style={{ marginTop: 7, fontSize: 10, color: C.amber, display: "flex", gap: 5, alignItems: "flex-start" }}>
                      <Info size={10} style={{ marginTop: 1 }} />
                      Position is in profit — averaging down isn't needed
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Additional Capital to Deploy (₹)</label>
                  <input value={capitalAmt} onChange={(e) => setCapitalAmt(e.target.value)}
                    placeholder="e.g. ₹50,000" style={inputStyle} type="number" min="0" step="1" />
                  {valid && !isNaN(nCapital) && nCapital > 0 && (
                    <div style={{ marginTop: 7, fontSize: 10, color: C.textMuted }}>
                      Buys ≈ {(nCapital / nCmp).toFixed(2)} shares at CMP of ₹{fmt(nCmp)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent History */}
            {history.length > 0 && (
              <div style={card()}>
                <div style={{ ...labelStyle, marginBottom: 10 }}>
                  <Clock size={10} style={{ marginRight: 4 }} />RECENT CALCULATIONS
                </div>
                {history.map((item, i) => (
                  <div key={i} onClick={() => loadItem(item)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                      marginBottom: i < history.length - 1 ? 6 : 0,
                      background: C.surface2, border: `1px solid ${C.border}`,
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = C.border2}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                        background: parseFloat(item.pnlPct) < 0 ? C.roseDim : C.emeraldDim,
                        border: `1px solid ${parseFloat(item.pnlPct) < 0 ? C.roseMid : C.emeraldMid}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, fontWeight: 700,
                        color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald,
                      }}>
                        {item.ticker.slice(0, 4)}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{item.ticker}</div>
                        <div style={{ fontSize: 9, color: C.textMuted, marginTop: 1 }}>
                          ₹{item.avgPrice} → {item.newAvg ? `₹${item.newAvg}` : "—"}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald,
                      }}>
                        {parseFloat(item.pnlPct) > 0 ? "+" : ""}{item.pnlPct}%
                      </div>
                      <div onClick={(e) => delHistory(e, i)}
                        style={{ color: C.textDim, cursor: "pointer", padding: 2 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = C.rose}
                        onMouseLeave={(e) => e.currentTarget.style.color = C.textDim}>
                        <X size={11} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ═══ RIGHT PANEL ═══════════════════════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Status Cards */}
            {status ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  { label: "TOTAL INVESTED", val: status.totalInvested, display: fmtCur(status.totalInvested), color: C.text, border: C.border },
                  { label: "CURRENT VALUE", val: status.currentValue, display: fmtCur(status.currentValue), color: C.text, border: C.border },
                  { label: "UNREALIZED P&L", val: status.pnl, display: fmtCur(status.pnl), color: status.pnl >= 0 ? C.emerald : C.rose, border: status.pnl >= 0 ? C.emeraldMid : C.roseMid },
                  { label: "P&L %", val: status.pnlPct, display: `${status.pnlPct >= 0 ? "+" : ""}${status.pnlPct.toFixed(2)}%`, color: status.pnlPct >= 0 ? C.emerald : C.rose, border: status.pnlPct >= 0 ? C.emeraldMid : C.roseMid },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: C.surface, borderRadius: 12,
                    border: `1px solid ${item.border}`,
                    padding: "14px",
                  }}>
                    <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>{item.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: item.color, letterSpacing: "-0.02em" }}>
                      <AnimNum value={item.val} prefix={i < 2 ? "₹" : (i === 2 ? (item.val >= 0 ? "₹" : "-₹") : "")} suffix={i === 3 ? "%" : ""} dec={i === 3 ? 2 : 0} color={item.color} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                ...card(), minHeight: 100,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 6,
              }}>
                <Layers size={24} color={C.textDim} />
                <div style={{ fontSize: 13, color: C.textMuted }}>Enter your position details to see analysis</div>
                <div style={{ fontSize: 10, color: C.textDim }}>Ticker · Avg Price · Quantity · CMP</div>
              </div>
            )}

            {/* Recovery Results — Glassmorphism */}
            {result ? (
              <div style={{
                background: `linear-gradient(135deg, ${C.surface2}f0, ${C.surface3}d0)`,
                border: `1px solid ${C.emeraldMid}`,
                borderRadius: 16, padding: "1.5rem",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: -60, right: -60, width: 180, height: 180,
                  borderRadius: "50%", background: `${C.emerald}09`, pointerEvents: "none",
                }} />
                <div style={{
                  position: "absolute", bottom: -40, left: -40, width: 120, height: 120,
                  borderRadius: "50%", background: `${C.sky}07`, pointerEvents: "none",
                }} />

                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {mode === "target" ? "Target Average Recovery" : "Capital Deployment Plan"}
                      {ticker ? ` — ${ticker}` : ""}
                    </div>
                    <div style={{ fontSize: 13, color: C.emerald, marginTop: 4, fontWeight: 600 }}>
                      {mode === "target"
                        ? `Buy ${result.addQty} shares at ₹${fmt(nCmp)} to reach avg of ₹${fmt(nTarget)}`
                        : `Deploy ${fmtCur(nCapital)} at CMP to reduce avg to ₹${fmt(result.newAvg)}`}
                    </div>
                  </div>
                  <div style={{
                    padding: "5px 12px", borderRadius: 20, flexShrink: 0, marginLeft: 12,
                    background: `${C.emeraldMid}88`,
                    border: `1px solid ${C.emeraldMid}`,
                    fontSize: 10, fontWeight: 700, color: C.emerald, letterSpacing: "0.06em",
                  }}>
                    {recovPct.toFixed(0)}% CLOSED
                  </div>
                </div>

                {/* Result grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "SHARES TO BUY", val: mode === "target" ? `${result.addQty} shares` : `${result.addQty.toFixed(2)} shares` },
                    { label: "CAPITAL NEEDED", val: fmtCur(result.capital) },
                    { label: "NEW AVERAGE", val: `₹${fmt(result.newAvg)}`, highlight: true },
                    { label: "TOTAL SHARES", val: `${result.totalQty.toFixed(mode === "target" ? 0 : 2)} shares` },
                    { label: "OLD AVERAGE", val: `₹${fmt(nAvg)}` },
                    { label: "REDUCTION", val: `↓ ₹${fmt(nAvg - result.newAvg)} (${fmt(((nAvg - result.newAvg) / nAvg) * 100)}%)` },
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: `${C.bg}80`, borderRadius: 10, padding: "12px",
                      border: `1px solid ${item.highlight ? C.emeraldMid : C.border}`,
                    }}>
                      <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 6 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: item.highlight ? C.emerald : C.text, letterSpacing: "-0.01em" }}>{item.val}</div>
                    </div>
                  ))}
                </div>

                {mode === "capital" && result.distBreakeven != null && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 9, marginBottom: 14,
                    background: `${C.amberDim}66`, border: `1px solid ${C.amberDim}`,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <Target size={14} color={C.amber} />
                    <span style={{ fontSize: 11, color: C.amber }}>
                      Stock needs to rise <strong>{result.distBreakeven.toFixed(2)}%</strong> from CMP (to ₹{fmt(nCmp * (1 + result.distBreakeven / 100))}) to break even
                    </span>
                  </div>
                )}

                {/* Recovery Progress Bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      RECOVERY PROGRESS
                    </span>
                    <span style={{ fontSize: 9, color: C.emerald, fontWeight: 700 }}>
                      Gap reduced by {recovPct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 10, background: C.surface3, borderRadius: 5, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${recovPct}%`,
                      background: `linear-gradient(90deg, ${C.rose} 0%, ${C.amber} 50%, ${C.emerald} 100%)`,
                      borderRadius: 5, transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 9, color: C.textMuted }}>CMP</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.rose }}>₹{fmt(nCmp)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.textMuted }}>NEW AVG</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.amber }}>₹{fmt(result.newAvg)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, color: C.textMuted }}>OLD AVG</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.text }}>₹{fmt(nAvg)}</div>
                    </div>
                  </div>
                </div>

                <button onClick={saveHistory} style={{
                  marginTop: 16, width: "100%", padding: "10px",
                  borderRadius: 9, background: `${C.emeraldMid}55`,
                  border: `1px solid ${C.emeraldMid}`, color: C.emerald,
                  cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: "inherit", transition: "background 0.15s",
                }}>
                  SAVE TO RECENT <ArrowRight size={13} />
                </button>
              </div>
            ) : valid && status && (
              <div style={{
                ...card({ borderStyle: "dashed", borderColor: C.border2 }),
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", minHeight: 120, gap: 6, textAlign: "center",
              }}>
                {mode === "target" ? (
                  <>
                    <Target size={22} color={C.textDim} />
                    <div style={{ fontSize: 12, color: C.textMuted }}>Enter a target average price below your current avg</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>Must be: ₹{fmt(nCmp)} &lt; target &lt; ₹{fmt(nAvg)}</div>
                  </>
                ) : (
                  <>
                    <DollarSign size={22} color={C.textDim} />
                    <div style={{ fontSize: 12, color: C.textMuted }}>Enter the capital amount you want to deploy</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>Will buy at current CMP of ₹{fmt(nCmp)}</div>
                  </>
                )}
              </div>
            )}

            {/* What-If Scenarios */}
            {result && (
              <div style={card()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
                    <Zap size={10} color={C.amber} /> WHAT-IF SCENARIOS
                  </div>
                  <div style={{ fontSize: 9, color: C.textDim }}>If CMP bounces after averaging down</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                  {whatIfData.map(({ pct, pnl, pnlPct }) => (
                    <div key={pct} style={{
                      borderRadius: 10, padding: "14px 10px", textAlign: "center",
                      background: pnl >= 0 ? `${C.emeraldDim}88` : `${C.roseDim}88`,
                      border: `1px solid ${pnl >= 0 ? C.emeraldMid : C.roseMid}`,
                    }}>
                      <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8 }}>
                        +{pct}% BOUNCE
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", color: pnl >= 0 ? C.emerald : C.rose }}>
                        {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: 10, color: pnl >= 0 ? `${C.emerald}99` : `${C.rose}99`, marginTop: 4 }}>
                        {pnl >= 0 ? "+" : ""}{fmtCur(pnl)}
                      </div>
                      <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                        @ ₹{fmt(nCmp * (1 + pct / 100))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Bar visualization */}
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 50 }}>
                  {whatIfData.map(({ pct, pnlPct }, i) => {
                    const maxPct = Math.max(...whatIfData.map(d => Math.abs(d.pnlPct)), 1);
                    const h = Math.max(4, (Math.abs(pnlPct) / maxPct) * 44);
                    return (
                      <div key={pct} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 50 }}>
                        <div style={{
                          width: "100%", height: h, borderRadius: "4px 4px 0 0",
                          background: pnlPct >= 0 ? `${C.emerald}44` : `${C.rose}44`,
                          border: `1px solid ${pnlPct >= 0 ? C.emeraldMid : C.roseMid}`,
                          transition: "height 0.4s ease",
                        }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom row: Opportunity Cost + Safety Check */}
            {status && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

                {/* Opportunity Cost */}
                <div style={card()}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
                    <AlertTriangle size={10} color={C.amber} /> OPPORTUNITY COST
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
                    Position weight (10× portfolio assumption):
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>CURRENT</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.amber }}>10.0%</div>
                    </div>
                    {result && (
                      <>
                        <ArrowRight size={14} color={C.textDim} />
                        <div>
                          <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>AFTER</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: C.rose }}>
                            {Math.min(100, ((status.totalInvested + result.capital) / (status.totalInvested * 10)) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {result && (
                    <div style={{ height: 4, background: C.surface3, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        width: `${Math.min(100, ((status.totalInvested + result.capital) / (status.totalInvested * 10)) * 100)}%`,
                        background: C.amber, transition: "width 0.5s ease",
                      }} />
                    </div>
                  )}
                </div>

                {/* Safety Check */}
                <div onClick={() => setShowMath(!showMath)} style={{
                  ...card({ cursor: "pointer" }),
                  borderColor: showMath ? `${C.skyMid}` : C.border,
                  transition: "border-color 0.2s",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", color: showMath ? C.sky : C.textMuted }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Shield size={10} color={showMath ? C.sky : C.textMuted} /> SAFETY CHECK
                    </div>
                    <ChevronDown size={12} style={{ transform: showMath ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </div>
                  {!showMath ? (
                    <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.7 }}>
                      Click to verify the underlying math of your recovery plan. Full transparency.
                    </div>
                  ) : result ? (
                    <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.85, fontFamily: "monospace" }}>
                      <div>OLD: {fmt(nQty, 0)} × ₹{fmt(nAvg)}</div>
                      <div style={{ borderLeft: `2px solid ${C.border2}`, paddingLeft: 8, marginLeft: 4, margin: "4px 0 4px 4px" }}>
                        = ₹{fmt(nQty * nAvg)}
                      </div>
                      <div>NEW: {mode === "target" ? fmt(result.addQty, 0) : fmt(result.addQty, 2)} × ₹{fmt(nCmp)}</div>
                      <div style={{ borderLeft: `2px solid ${C.border2}`, paddingLeft: 8, marginLeft: 4, margin: "4px 0 4px 4px" }}>
                        = {fmtCur(result.capital)}
                      </div>
                      <div style={{ color: C.emerald, marginTop: 4, fontWeight: 700 }}>
                        ∑ AVG = ₹{fmt(result.newAvg)} ✓
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: C.textMuted }}>Set recovery mode inputs to see breakdown.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
{/* 
      <footer style={{ 
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "12px 0", 
        textAlign: "center", 
        borderTop: `1px solid ${C.border}`,
        background: `${C.surface}ee`, // Slightly more opaque to hide scroll behind it
        backdropFilter: "blur(10px)",
        zIndex: 1000
      }}>
        <div style={{ 
          fontSize: 11, 
          color: C.textMuted, 
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontWeight: 600
        }}>
          MADE WITH <span className="heart-pulse" style={{ color: C.rose, fontSize: 14 }}>❤️</span> 
        </div>
        <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>
          © 2026 TRADERESCUE • LIVE NSE/BSE FEED
        </div>
      </footer> */}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input::placeholder { color: ${C.textDim}; font-family: inherit; }
        input:focus { border-color: ${C.sky} !important; box-shadow: 0 0 0 2px ${C.skyDim} !important; }
        .tr-grid {
          display: grid;
          grid-template-columns: 330px 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 700px) {
          .tr-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
