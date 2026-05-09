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

const STOCKS: Record<string, any> = {
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

const fmt = (n: any, dec: number = 2): string => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (num == null || isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "decimal",
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(num);
};

const fmtCur = (n: any): string => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (num == null || isNaN(num)) return "—";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 10000000) return sign + "₹" + (abs / 10000000).toFixed(2) + " Cr";
  if (abs >= 100000) return sign + "₹" + (abs / 100000).toFixed(2) + " L";
  return sign + "₹" + abs.toLocaleString("en-IN");
};

const calcStatus = (avg: number, qty: number, cmp: number) => ({
  totalInvested: avg * qty,
  currentValue: cmp * qty,
  pnl: (cmp - avg) * qty,
  pnlPct: ((cmp - avg) / avg) * 100,
  gapPct: ((cmp - avg) / avg) * 100,
});

const calcTargetMode = (avg: number, qty: number, cmp: number, target: number) => {
  if (target >= avg || target <= cmp || target <= 0) return null;
  const addQty = Math.ceil((qty * (avg - target)) / (target - cmp));
  const capital = addQty * cmp;
  const newAvg = (avg * qty + capital) / (qty + addQty);
  return { addQty, capital, newAvg, totalQty: qty + addQty };
};

const calcCapitalMode = (avg: number, qty: number, cmp: number, capital: number) => {
  if (capital <= 0) return null;
  const addQty = capital / cmp;
  const newAvg = (avg * qty + capital) / (qty + addQty);
  const distBreakeven = ((newAvg - cmp) / cmp) * 100;
  return { addQty, capital, newAvg, totalQty: qty + addQty, distBreakeven };
};

function AnimNum({ value, prefix = "", suffix = "", dec = 2, color }: any) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (isNaN(end) || isNaN(start)) { setDisplay(end); return; }
    const duration = 400;
    const startTime = performance.now();
    const tick = (now: number) => {
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

export default function TradeRescue() {
  const [tickerInput, setTickerInput] = useState("");
  const [ticker, setTicker] = useState("");
  const [stockInfo, setStockInfo] = useState<any>(null);
  const [cmp, setCmp] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [qty, setQty] = useState("");
  const [fetching, setFetching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [mode, setMode] = useState("target");
  const [targetAvg, setTargetAvg] = useState("");
  const [capitalAmt, setCapitalAmt] = useState("");
  const [showMath, setShowMath] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [toast, setToast] = useState<any>(null);
  const sugRef = useRef<any>(null);

  useEffect(() => {
    const r = localStorage.getItem("tr-history-v2");
    if (r) setHistory(JSON.parse(r));
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      if (sugRef.current && !sugRef.current.contains(e.target)) setShowSug(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPrice = async (sym: string) => {
    if (!sym) return;
    setFetching(true);
    setShowSug(false);
    try {
      const response = await fetch(`/api/stock?symbol=${sym.toUpperCase()}`);
      const data = await response.json();
      if (data.error) {
        showToast("Stock not found. Try adding .NS for NSE", "warn");
      } else {
        setCmp(data.price.toString());
        setStockInfo({ name: data.name, price: data.price, chg: data.chg });
        setTicker(data.symbol);
        showToast(`Loaded ${data.symbol} live price`);
      }
    } catch (err) {
      showToast("Failed to fetch market data", "warn");
    } finally {
      setFetching(false);
    }
  };

  const onTickerChange = (val: string) => {
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

  const valid = !isNaN(nAvg) && !isNaN(nQty) && !isNaN(nCmp) && nAvg > 0 && nQty > 0 && nCmp > 0;
  const status = valid ? calcStatus(nAvg, nQty, nCmp) : null;
  const isLoss = status && status.pnlPct < 0;

  const targetRes = valid && mode === "target" && !isNaN(nTarget) && nTarget > 0 ? calcTargetMode(nAvg, nQty, nCmp, nTarget) : null;
  const capitalRes = valid && mode === "capital" && !isNaN(nCapital) && nCapital > 0 ? calcCapitalMode(nAvg, nQty, nCmp, nCapital) : null;
  const result = mode === "target" ? targetRes : capitalRes;

  const recovPct = result && valid ? Math.max(0, Math.min(100, ((nAvg - result.newAvg) / Math.max(nAvg - nCmp, 0.001)) * 100)) : 0;

  const whatIfBounces = [3, 5, 10];
  const whatIfData = whatIfBounces.map((pct) => {
    if (!result) return { pct, pnlPct: 0, pnl: 0 };
    const newP = nCmp * (1 + pct / 100);
    const totalInv = result.newAvg * result.totalQty;
    const curVal = newP * result.totalQty;
    return { pct, pnl: curVal - totalInv, pnlPct: ((newP - result.newAvg) / result.newAvg) * 100 };
  });

  const saveHistory = async () => {
    if (!valid || !ticker || !status) return showToast("Enter position details first", "warn");
    const entry = {
      ticker, name: stockInfo?.name || ticker,
      avgPrice: nAvg, qty: nQty, cmp: nCmp,
      newAvg: result?.newAvg?.toFixed(2) || null,
      pnlPct: status.pnlPct.toFixed(2),
      ts: Date.now(),
    };
    const updated = [entry, ...history.filter((h: any) => h.ticker !== ticker)].slice(0, 5);
    setHistory(updated);
    try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
    showToast("Saved to recent calculations");
  };

  const loadItem = (item: any) => {
    setTicker(item.ticker);
    setTickerInput(item.ticker);
    setStockInfo(STOCKS[item.ticker] || { name: item.name, price: item.cmp, chg: 0 });
    setCmp(item.cmp.toString());
    setAvgPrice(item.avgPrice.toString());
    setQty(item.qty.toString());
  };

  const delHistory = async (e: any, idx: number) => {
    e.stopPropagation();
    const updated = history.filter((_, i) => i !== idx);
    setHistory(updated);
    try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
  };

  const card = (extra = {}) => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: "1.25rem" as any,
    ...extra,
  });

  const inputStyle: any = {
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

  const labelStyle: any = {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    color: C.textMuted,
    marginBottom: 5,
  };

  const chip = (active: boolean, color: string): any => ({
    flex: 1, padding: "9px 4px", borderRadius: 8, cursor: "pointer",
    border: `1px solid ${active ? color : C.border2}`,
    background: active ? `${color}18` : C.surface3,
    color: active ? color : C.textMuted,
    fontSize: 12, fontWeight: 600,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    transition: "all 0.15s",
  });

  return (
  //  <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Mono', 'IBM Plex Mono', 'Courier New', monospace", color: C.text }}>
// Inside your return()
      <div style={{ 
        background: C.bg, 
        minHeight: "100vh", 
        fontFamily: "'DM Mono', monospace", 
        color: C.text,
        overflowX: "hidden", // Prevents horizontal stretching
        position: "relative",
        width: "100%" 
      }}>

      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "success" ? C.emeraldMid : C.amberDim, border: `1px solid ${toast.type === "success" ? C.emerald : C.amber}`, borderRadius: 10, padding: "10px 16px", color: toast.type === "success" ? C.emerald : C.amber, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, animation: "slideIn 0.2s ease" }}>
          {toast.type === "success" ? <TrendingUp size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      <div style={{ padding: "0 24px", height: 56, background: `${C.surface}cc`, backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.emerald}cc, ${C.sky}cc)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={16} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em", color: C.text }}>Trade<span style={{ color: C.emerald }}>Rescue</span></div>
            <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Recovery Calculator</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${C.border2}`, background: C.surface2, fontSize: 10, color: C.textMuted, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
            <Shield size={10} color={C.emerald} /> NO DATA STORED EXTERNALLY
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 40px" }}>
        <div className="tr-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={card()}>
              <div style={{ ...labelStyle, marginBottom: 10, fontSize: 11, letterSpacing: "0.04em" }}><Search size={10} style={{ marginRight: 4 }} />FETCH LIVE PRICE</div>
              <div style={{ position: "relative" }} ref={sugRef}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
                    <input value={tickerInput} onChange={(e) => onTickerChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchPrice(tickerInput)} onFocus={() => tickerInput && setShowSug(suggestions.length > 0)} placeholder="RELIANCE.NS, INFOSYS.NS..." style={{ ...inputStyle, paddingLeft: 32 }} />
                  </div>
                  <button onClick={() => fetchPrice(tickerInput)} disabled={!tickerInput || fetching} style={{ padding: "0 16px", borderRadius: 8, background: !tickerInput || fetching ? C.surface3 : C.sky, color: !tickerInput || fetching ? C.textMuted : "#000", border: `1px solid ${!tickerInput || fetching ? C.border2 : C.sky}`, cursor: !tickerInput || fetching ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                    {fetching ? <RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <>FETCH</>}
                  </button>
                </div>
                {showSug && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200, background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 10, overflow: "hidden", boxShadow: `0 8px 32px ${C.bg}cc` }}>
                    {suggestions.map(([sym, info]: any) => (
                      <div key={sym} onClick={() => { setTickerInput(sym); fetchPrice(sym); }} style={{ padding: "10px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }} onMouseEnter={(e) => e.currentTarget.style.background = C.surface4} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <div><div style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>{sym}</div><div style={{ fontSize: 10, color: C.textMuted }}>{info.name}</div></div>
                        <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 700 }}>₹{info.price.toFixed(2)}</div><div style={{ fontSize: 10, color: info.chg >= 0 ? C.emerald : C.rose }}>{info.chg >= 0 ? "▲" : "▼"} {Math.abs(info.chg)}%</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {stockInfo && ticker && (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.skyDim}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontSize: 13, fontWeight: 700, color: C.sky }}>{ticker}</div><div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{stockInfo.name}</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.03em" }}>₹{parseFloat(cmp).toFixed(2)}</div><div style={{ fontSize: 10, color: stockInfo.chg >= 0 ? C.emerald : C.rose }}>{stockInfo.chg >= 0 ? "▲" : "▼"} {Math.abs(stockInfo.chg).toFixed(2)}% today</div></div>
                </div>
              )}
            </div>

            <div style={card()}>
              <div style={{ ...labelStyle, marginBottom: 12 }}><BarChart2 size={10} style={{ marginRight: 4 }} />YOUR POSITION</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label style={labelStyle}>Avg Buy Price</label><input value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} placeholder="₹ 250.00" style={inputStyle} type="number" /></div>
                <div><label style={labelStyle}>Quantity</label><input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="100 shares" style={inputStyle} type="number" /></div>
              </div>
              <div><label style={labelStyle}>CMP (override)</label><input value={cmp} onChange={(e) => setCmp(e.target.value)} placeholder="Current price" style={inputStyle} type="number" /></div>
              {valid && status && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: isLoss ? `${C.roseDim}88` : `${C.emeraldDim}88`, border: `1px solid ${isLoss ? C.roseMid : C.emeraldMid}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{isLoss ? <TrendingDown size={13} color={C.rose} /> : <TrendingUp size={13} color={C.emerald} />}<span style={{ fontSize: 11, color: isLoss ? C.rose : C.emerald, fontWeight: 700 }}>{isLoss ? "LOSING POSITION" : "GAINING POSITION"}</span></div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isLoss ? C.rose : C.emerald }}>{status.pnlPct >= 0 ? "+" : ""}{status.pnlPct.toFixed(2)}%</span>
                </div>
              )}
            </div>

            <div style={card()}>
              <div style={{ ...labelStyle, marginBottom: 12 }}><Zap size={10} style={{ marginRight: 4 }} />RECOVERY MODE</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={() => setMode("target")} style={chip(mode === "target", C.emerald)}><Target size={12} /> TARGET AVG</button>
                <button onClick={() => setMode("capital")} style={chip(mode === "capital", C.sky)}><DollarSign size={12} /> CAPITAL DEPLOY</button>
              </div>
              {mode === "target" ? (
                <div><label style={labelStyle}>Desired Average Price (₹)</label><input value={targetAvg} onChange={(e) => setTargetAvg(e.target.value)} placeholder="Target avg" style={inputStyle} type="number" /></div>
              ) : (
                <div><label style={labelStyle}>Additional Capital (₹)</label><input value={capitalAmt} onChange={(e) => setCapitalAmt(e.target.value)} placeholder="e.g. ₹50,000" style={inputStyle} type="number" /></div>
              )}
            </div>

            {history.length > 0 && (
              <div style={card()}>
                <div style={{ ...labelStyle, marginBottom: 10 }}><Clock size={10} style={{ marginRight: 4 }} />RECENT CALCULATIONS</div>
                {history.map((item: any, i: number) => (
                  <div key={i} onClick={() => loadItem(item)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: i < history.length - 1 ? 6 : 0, background: C.surface2, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: parseFloat(item.pnlPct) < 0 ? C.roseDim : C.emeraldDim, border: `1px solid ${parseFloat(item.pnlPct) < 0 ? C.roseMid : C.emeraldMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald }}>{item.ticker.slice(0, 4)}</div>
                      <div><div style={{ fontSize: 11, fontWeight: 700 }}>{item.ticker}</div><div style={{ fontSize: 9, color: C.textMuted }}>₹{item.avgPrice} → {item.newAvg ? `₹${item.newAvg}` : "—"}</div></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 10, fontWeight: 700, color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald }}>{parseFloat(item.pnlPct) > 0 ? "+" : ""}{item.pnlPct}%</div><div onClick={(e) => delHistory(e, i)} style={{ color: C.textDim }}><X size={11} /></div></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* {status ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  { label: "TOTAL INVESTED", val: status.totalInvested, color: C.text },
                  { label: "CURRENT VALUE", val: status.currentValue, color: C.text },
                  { label: "UNREALIZED P&L", val: status.pnl, color: status.pnl >= 0 ? C.emerald : C.rose },
                  { label: "P&L %", val: status.pnlPct, color: status.pnlPct >= 0 ? C.emerald : C.rose },
                ].map((item, i) => (
                  <div key={i} style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px" }}>
                    <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, marginBottom: 8 }}>{item.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: item.color }}>
                      <AnimNum value={item.val} prefix={i < 3 ? "₹" : ""} suffix={i === 3 ? "%" : ""} color={item.color} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ ...card(), minHeight: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}><Layers size={24} color={C.textDim} /><div style={{ fontSize: 13, color: C.textMuted }}>Enter position details to analyze</div></div>
            )} */}

            {status ? (
              <div style={{ 
                display: "grid", 
                // This magic line ensures boxes stack on mobile but spread out on desktop
                gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", 
                gap: "10px",
                width: "100%",
                boxSizing: "border-box"
              }}>
                {[
                  { label: "TOTAL INVESTED", val: status.totalInvested, prefix: "₹", color: C.text },
                  { label: "CURRENT VALUE", val: status.currentValue, prefix: "₹", color: C.text },
                  { label: "UNREALIZED P&L", val: status.pnl, prefix: status.pnl >= 0 ? "₹" : "-₹", color: status.pnl >= 0 ? C.emerald : C.rose },
                  { label: "P&L %", val: status.pnlPct, prefix: "", suffix: "%", color: status.pnlPct >= 0 ? C.emerald : C.rose },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: C.surface,
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    minWidth: "0", // Critical: allows the box to shrink if needed
                    overflow: "hidden"
                  }}>
                    <div style={{ 
                      fontSize: 9, 
                      color: C.textMuted, 
                      fontWeight: 700, 
                      letterSpacing: "0.05em", 
                      marginBottom: 4,
                      whiteSpace: "nowrap" // Prevents label from breaking layout
                    }}>
                      {item.label}
                    </div>
                    <div style={{ 
                      fontSize: 16, 
                      fontWeight: 700, 
                      color: item.color,
                      letterSpacing: "-0.02em",
                      overflow: "hidden",
                      textOverflow: "ellipsis" // If number is huge, it adds "..." instead of stretching
                    }}>
                      <AnimNum 
                        value={Math.abs(item.val)} 
                        prefix={item.prefix} 
                        suffix={item.suffix || ""} 
                        color={item.color} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                background: C.surface, 
                border: `1px solid ${C.border}`, 
                borderRadius: 14, 
                padding: "2rem", 
                textAlign: "center" 
              }}>
                <Layers size={24} color={C.textDim} style={{ margin: "0 auto 10px" }} />
                <div style={{ fontSize: 13, color: C.textMuted }}>Enter position details to analyze</div>
              </div>
            )}

            {result ? (
              <div style={{ background: `linear-gradient(135deg, ${C.surface2}f0, ${C.surface3}d0)`, border: `1px solid ${C.emeraldMid}`, borderRadius: 16, padding: "1.5rem", position: "relative", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
                  <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>{mode === "target" ? "TARGET RECOVERY" : "DEPLOYMENT PLAN"}</div><div style={{ fontSize: 13, color: C.emerald, fontWeight: 600 }}>{mode === "target" ? `Buy ${result.addQty} shares at ₹${fmt(nCmp)}` : `Deploy ${fmtCur(nCapital)} at CMP`}</div></div>
                  <div style={{ padding: "5px 12px", borderRadius: 20, background: `${C.emeraldMid}88`, border: `1px solid ${C.emeraldMid}`, fontSize: 10, color: C.emerald }}>{recovPct.toFixed(0)}% CLOSED</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "SHARES TO BUY", val: `${result.addQty.toFixed(0)}` },
                    { label: "CAPITAL NEEDED", val: fmtCur(result.capital) },
                    { label: "NEW AVERAGE", val: `₹${fmt(result.newAvg)}`, highlight: true },
                    { label: "TOTAL SHARES", val: `${result.totalQty.toFixed(0)}` },
                    { label: "OLD AVERAGE", val: `₹${fmt(nAvg)}` },
                    { label: "REDUCTION", val: `↓ ₹${fmt(nAvg - result.newAvg)}` },
                  ].map((item, i) => (
                    <div key={i} style={{ background: `${C.bg}80`, borderRadius: 10, padding: "12px", border: `1px solid ${item.highlight ? C.emeraldMid : C.border}` }}>
                      <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: item.highlight ? C.emerald : C.text }}>{item.val}</div>
                    </div>
                  ))}
                </div>
                <div>
                   <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}><span style={{ fontSize: 9, color: C.textMuted }}>RECOVERY PROGRESS</span><span style={{ fontSize: 9, color: C.emerald }}>{recovPct.toFixed(1)}% Gap Reduced</span></div>
                   <div style={{ height: 10, background: C.surface3, borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${recovPct}%`, background: `linear-gradient(90deg, ${C.rose}, ${C.amber}, ${C.emerald})` }} /></div>
                </div>
                <button onClick={saveHistory} style={{ marginTop: 16, width: "100%", padding: "10px", borderRadius: 9, background: `${C.emeraldMid}55`, border: `1px solid ${C.emeraldMid}`, color: C.emerald, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>SAVE TO RECENT</button>
              </div>
            ) : valid && status && (
              <div style={{ ...card({ borderStyle: "dashed" }), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 6 }}><Target size={22} color={C.textDim} /><div style={{ fontSize: 12, color: C.textMuted }}>Enter recovery inputs</div></div>
            )}

            {result && (
              <div style={card()}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}><Zap size={10} color={C.amber} /> WHAT-IF SCENARIOS</div>
                  <div style={{ fontSize: 9, color: C.textDim }}>If CMP bounces after average</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {whatIfData.map(({ pct, pnl, pnlPct }) => (
                    <div key={pct} style={{ borderRadius: 10, padding: "14px 10px", textAlign: "center", background: pnl >= 0 ? `${C.emeraldDim}88` : `${C.roseDim}88`, border: `1px solid ${pnl >= 0 ? C.emeraldMid : C.roseMid}` }}>
                      <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, marginBottom: 8 }}>+{pct}% BOUNCE</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: pnl >= 0 ? C.emerald : C.rose }}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div>
                      <div style={{ fontSize: 10, color: pnl >= 0 ? `${C.emerald}99` : `${C.rose}99`, marginTop: 4 }}>{fmtCur(pnl)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={card()}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, marginBottom: 12 }}><AlertTriangle size={10} color={C.amber} /> OPPORTUNITY COST</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div><div style={{ fontSize: 9, color: C.textMuted }}>CURRENT</div><div style={{ fontSize: 20, fontWeight: 700, color: C.amber }}>10.0%</div></div>
                    {result && <><ArrowRight size={14} color={C.textDim} /><div><div style={{ fontSize: 9, color: C.textMuted }}>AFTER</div><div style={{ fontSize: 20, fontWeight: 700, color: C.rose }}>{Math.min(100, ((status.totalInvested + result.capital) / (status.totalInvested * 10)) * 100).toFixed(1)}%</div></div></>}
                  </div>
                </div>
                <div onClick={() => setShowMath(!showMath)} style={{ ...card({ cursor: "pointer" }), borderColor: showMath ? C.sky : C.border }}>
                  <div style={{ fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", color: showMath ? C.sky : C.textMuted }}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><Shield size={10} /> MATH CHECK</div><ChevronDown size={12} style={{ transform: showMath ? "rotate(180deg)" : "none" }} /></div>
                  {!showMath ? <div style={{ fontSize: 10, color: C.textMuted, marginTop: 10 }}>Verify the underlying breakdown.</div> : result && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 10, fontFamily: "monospace" }}><div>OLD: {nQty} @ ₹{fmt(nAvg)}</div><div>NEW: {result.addQty} @ ₹{fmt(nCmp)}</div><div style={{ color: C.emerald }}>∑ AVG: ₹{fmt(result.newAvg)} ✓</div></div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .tr-grid { display: grid; grid-template-columns: 330px 1fr; gap: 20px; width: 100%;}
        @media (max-width: 700px) { 
          .tr-grid { 
            grid-template-columns: 1fr !important; 
            width: 100% !important;
            max-width: 100vw !important; /* Forces the box to stay inside the screen */
            overflow: hidden;
          }
          
          input {
            font-size: 16px !important; 
          }
        }
      `}</style>
    </div>
            //@media (max-width: 700px) { .tr-grid { grid-template-columns: 1fr; } }

  );
}
