'use client';

import { useState, useEffect, useRef, useCallback } from "react";
/* Step 1: Import the Analytics component */
import { Analytics } from '@vercel/analytics/react';
import {
  TrendingDown, TrendingUp, Search, RefreshCw, Clock,
  Shield, Target, DollarSign, BarChart2, AlertTriangle,
  ArrowRight, Zap, ChevronDown, X, Info, Layers,
  MessageCircle, Send, ThumbsUp,
} from "lucide-react";

/* ─── Colour Palette ─────────────────────────────────────────────────────── */
const C = {
  bg:         "#06091a",
  surface:    "#0b1025",
  surface2:   "#0f1630",
  surface3:   "#131d3a",
  surface4:   "#172140",
  border:     "#1a2848",
  border2:    "#203059",
  text:       "#d6e4f7",
  textMuted:  "#5a7a9e",
  textDim:    "#2a3d5a",
  emerald:    "#10d98a",
  emeraldDim: "#042d1c",
  emeraldMid: "#065535",
  rose:       "#ff3d68",
  roseDim:    "#3d0018",
  roseMid:    "#5c0025",
  amber:      "#ffb830",
  amberDim:   "#3d2200",
  sky:        "#38c6f8",
  skyDim:     "#032840",
  skyMid:     "#054a74",
  purple:     "#a78bfa",
  purpleDim:  "#1e0d45",
};

/* ─── Mock Data ──────────────────────────────────────────────────────────── */
const STOCKS: Record<string, any> = {
};

/* ─── Formatters ─────────────────────────────────────────────────────────── */
const fmt = (n: any, dec = 2): string => {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (num == null || isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "decimal",
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(num);
};

const fmtCur = (n: any): string => {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (num == null || isNaN(num)) return "—";
  const abs = Math.abs(num), sign = num < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
};

/* ─── Analytics Helper ───────────────────────────────────────────────────── */
const track = (event: string, data?: Record<string, any>) => {
  try {
    const u = (window as any).umami;
    if (u && typeof u.track === "function") u.track(event, data ?? {});
  } catch {}
};

/* ─── Finance Engine ─────────────────────────────────────────────────────── */
const calcStatus = (avg: number, qty: number, cmp: number) => ({
  totalInvested: avg * qty,
  currentValue:  cmp * qty,
  pnl:           (cmp - avg) * qty,
  pnlPct:        ((cmp - avg) / avg) * 100,
  gapPct:        ((cmp - avg) / avg) * 100,
});

const calcTargetMode = (avg: number, qty: number, cmp: number, target: number) => {
  if (target >= avg || target <= cmp || target <= 0) return null;
  const addQty  = Math.ceil((qty * (avg - target)) / (target - cmp));
  const capital = addQty * cmp;
  return { addQty, capital, newAvg: (avg * qty + capital) / (qty + addQty), totalQty: qty + addQty };
};

const calcCapitalMode = (avg: number, qty: number, cmp: number, capital: number) => {
  if (capital <= 0) return null;
  const addQty      = capital / cmp;
  const newAvg      = (avg * qty + capital) / (qty + addQty);
  const distBreakeven = ((newAvg - cmp) / cmp) * 100;
  return { addQty, capital, newAvg, totalQty: qty + addQty, distBreakeven };
};

/* ─── Animated Counter ───────────────────────────────────────────────────── */
function AnimNum({ value, prefix = "", suffix = "", dec = 2, color }: any) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const s = prev.current, e = value;
    if (isNaN(e) || isNaN(s)) { setDisplay(e); return; }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / 420, 1);
      setDisplay(s + (e - s) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick); else prev.current = e;
    };
    requestAnimationFrame(tick);
  }, [value]);
  const n = typeof display === "number" ? display : value;
  return <span style={{ color }}>{prefix}{isNaN(n) ? "—" : fmt(n, dec)}{suffix}</span>;
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function TradeRescue() {

  /* ── Existing state ── */
  const [tickerInput, setTickerInput] = useState("");
  const [ticker,      setTicker]      = useState("");
  const [stockInfo,   setStockInfo]   = useState<any>(null);
  const [cmp,         setCmp]         = useState("");
  const [avgPrice,    setAvgPrice]    = useState("");
  const [qty,         setQty]         = useState("");
  const [fetching,    setFetching]    = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSug,     setShowSug]     = useState(false);
  const [mode,        setMode]        = useState("target");
  const [targetAvg,   setTargetAvg]   = useState("");
  const [capitalAmt,  setCapitalAmt]  = useState("");
  const [showMath,    setShowMath]    = useState(false);
  const [history,     setHistory]     = useState<any[]>([]);
  const [toast,       setToast]       = useState<any>(null);

  /* ── Task 2: Rate-this-Result state ── */
  const [ratingDone,       setRatingDone]       = useState(false);
  const [showRatingModal,  setShowRatingModal]  = useState(false);
  const [ratingFeedback,   setRatingFeedback]   = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const sugRef = useRef<any>(null);

  /* ── History from localStorage ── */
  useEffect(() => {
    const r = localStorage.getItem("tr-history-v2");
    if (r) setHistory(JSON.parse(r));
  }, []);

  /* ── Suggestions close on outside click ── */
  useEffect(() => {
    const handler = (e: any) => {
      if (sugRef.current && !sugRef.current.contains(e.target)) setShowSug(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Task 1: Session Heartbeat ────────────────────────────────────────
     Tracks active vs idle time in 5-second ticks.
     "Idle" is defined as no user activity for > 30 seconds.           */
  useEffect(() => {
    let activeSeconds = 0;
    let lastActivity  = Date.now();

    const onActivity = () => { lastActivity = Date.now(); };
    const EVENTS = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;
    EVENTS.forEach(ev => document.addEventListener(ev, onActivity, { passive: true }));

    const heartbeat = setInterval(() => {
      const idleSec = (Date.now() - lastActivity) / 1000;
      const isIdle  = idleSec > 30;
      if (!isIdle) activeSeconds += 5;
      track("heartbeat", { activeSeconds, isIdle, idleSec: Math.round(idleSec) });
    }, 5000);

    return () => {
      clearInterval(heartbeat);
      EVENTS.forEach(ev => document.removeEventListener(ev, onActivity));
    };
  }, []);

  /* ── Task 3: Lock body scroll when rating modal is open ── */
  useEffect(() => {
    document.body.style.overflow = showRatingModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showRatingModal]);

  /* ── Helpers ── */
  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Fetch live price ── */
  const fetchPrice = async (sym: string) => {
    if (!sym) return;
    setFetching(true);
    setShowSug(false);
    try {
      const response = await fetch(`/api/stock?symbol=${sym.toUpperCase()}`);
      const data     = await response.json();
      if (data.error) {
        showToast("Stock not found. Try adding .NS for NSE", "warn");
      } else {
        setCmp(data.price.toString());
        setStockInfo({ name: data.name, price: data.price, chg: data.chg });
        setTicker(data.symbol);
        showToast(`Loaded ${data.symbol} live price`);
        /* Task 1: dispatch stock_search analytics event */
        track("stock_search", { symbol: data.symbol, price: data.price });
      }
    } catch {
      showToast("Failed to fetch market data", "warn");
    } finally {
      setFetching(false);
    }
  };

  const onTickerChange = (val: string) => {
    setTickerInput(val);
    if (val.length >= 1) {
      const f = Object.entries(STOCKS)
        .filter(([k, v]) => k.startsWith(val.toUpperCase()) || v.name.toLowerCase().includes(val.toLowerCase()))
        .slice(0, 6);
      setSuggestions(f); setShowSug(f.length > 0);
    } else { setSuggestions([]); setShowSug(false); }
  };

  /* ── Task 2: Rating submission ── */
  const submitRatingFeedback = async () => {
    if (!ratingFeedback.trim()) return;
    setRatingSubmitting(true);
    track("rating_feedback_submit", { feedback: ratingFeedback });
    // Simulate async submission (wire to your endpoint here)
    await new Promise(r => setTimeout(r, 900));
    setRatingSubmitting(false);
    setShowRatingModal(false);
    setRatingDone(true);
    setRatingFeedback("");
  };

  /* ── Core calculations ── */
  const nAvg     = parseFloat(avgPrice);
  const nQty     = parseFloat(qty);
  const nCmp     = parseFloat(cmp);
  const nTarget  = parseFloat(targetAvg);
  const nCapital = parseFloat(capitalAmt);

  const valid  = !isNaN(nAvg) && !isNaN(nQty) && !isNaN(nCmp) && nAvg > 0 && nQty > 0 && nCmp > 0;
  const status = valid ? calcStatus(nAvg, nQty, nCmp) : null;
  const isLoss = status && status.pnlPct < 0;

  const targetRes  = valid && mode === "target"  && !isNaN(nTarget)  && nTarget  > 0 ? calcTargetMode(nAvg, nQty, nCmp, nTarget)  : null;
  const capitalRes = valid && mode === "capital" && !isNaN(nCapital) && nCapital > 0 ? calcCapitalMode(nAvg, nQty, nCmp, nCapital) : null;
  const result     = mode === "target" ? targetRes : capitalRes;

  const recovPct = result && valid
    ? Math.max(0, Math.min(100, ((nAvg - result.newAvg) / Math.max(nAvg - nCmp, 0.001)) * 100))
    : 0;

  const whatIfData = [3, 5, 10].map(pct => {
    if (!result) return { pct, pnlPct: 0, pnl: 0 };
    const newP   = nCmp * (1 + pct / 100);
    const curVal = newP * result.totalQty;
    return { pct, pnl: curVal - result.newAvg * result.totalQty, pnlPct: ((newP - result.newAvg) / result.newAvg) * 100 };
  });

  const saveHistory = () => {
    if (!valid || !ticker || !status) return showToast("Enter position details first", "warn");
    const entry   = { ticker, name: stockInfo?.name || ticker, avgPrice: nAvg, qty: nQty, cmp: nCmp, newAvg: result?.newAvg?.toFixed(2) || null, pnlPct: status.pnlPct.toFixed(2), ts: Date.now() };
    const updated = [entry, ...history.filter((h: any) => h.ticker !== ticker)].slice(0, 5);
    setHistory(updated);
    try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
    showToast("Saved to recent calculations");
    track("save_calculation", { ticker, mode });
  };

  const loadItem = (item: any) => {
    setTicker(item.ticker); setTickerInput(item.ticker);
    setStockInfo(STOCKS[item.ticker] || { name: item.name, price: item.cmp, chg: 0 });
    setCmp(item.cmp.toString()); setAvgPrice(item.avgPrice.toString()); setQty(item.qty.toString());
  };

  const delHistory = (e: any, idx: number) => {
    e.stopPropagation();
    const updated = history.filter((_, i) => i !== idx);
    setHistory(updated);
    try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
  };

  /* ── Style helpers ── */
  const card = (extra: any = {}): any => ({
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.25rem", ...extra,
  });
  const inp: any = {
    width: "100%", background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 8,
    padding: "9px 12px", color: C.text, fontSize: 13, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit", minHeight: 44,   // Task 3: 44px touch target
    transition: "border-color 0.2s",
  };
  const lbl: any = {
    display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
    textTransform: "uppercase", color: C.textMuted, marginBottom: 5,
  };
  const chip = (active: boolean, color: string): any => ({
    flex: 1, padding: "9px 4px", borderRadius: 8, cursor: "pointer", minHeight: 44, // Task 3
    border: `1px solid ${active ? color : C.border2}`,
    background: active ? `${color}18` : C.surface3,
    color: active ? color : C.textMuted,
    fontSize: 12, fontWeight: 600,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    transition: "all 0.18s", fontFamily: "inherit",
  });

  /* ══════════════════════════════════════════════════════════════════════
     JSX
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Mono', monospace", color: C.text, overflowX: "hidden", position: "relative", width: "100%" }}>

      {/* ambient glow orbs */}
      <div style={{ position: "fixed", top: "8%", left: "12%", width: 440, height: 440, borderRadius: "50%", background: `radial-gradient(circle, ${C.emerald}07 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "8%", right: "8%", width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${C.sky}05 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "success" ? C.emeraldMid : C.amberDim, border: `1px solid ${toast.type === "success" ? C.emerald : C.amber}`, borderRadius: 10, padding: "10px 16px", color: toast.type === "success" ? C.emerald : C.amber, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, animation: "slideIn 0.2s ease" }}>
          {toast.type === "success" ? <TrendingUp size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Task 2 & 3: "Rate this Result" Modal
          — fixed, high z-index, body scroll locked when open
      ══════════════════════════════════════════════════════════════════ */}
      {showRatingModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowRatingModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(4,6,14,0.90)", backdropFilter: "blur(14px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "overlayIn 0.2s ease" }}
        >
          <div style={{ width: "100%", maxWidth: 460, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", animation: "modalIn 0.35s cubic-bezier(0.34,1.4,0.64,1)", boxShadow: `0 0 60px ${C.rose}12, 0 24px 64px rgba(0,0,0,0.65)` }}>

            {/* gradient accent */}
            <div style={{ height: 3, background: `linear-gradient(90deg, ${C.rose}, ${C.amber}, ${C.purple})` }} />

            <div style={{ padding: "24px 26px 26px" }}>
              {/* header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    What's missing from<br />this calculation?
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>Your input helps us build a better tool.</div>
                </div>
                <button
                  onClick={() => setShowRatingModal(false)}
                  style={{ background: "none", border: `1px solid ${C.border2}`, borderRadius: 8, cursor: "pointer", color: C.textMuted, padding: "5px 6px", display: "flex", lineHeight: 1, fontFamily: "inherit", flexShrink: 0, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                  onMouseEnter={e => { Object.assign((e.currentTarget as any).style, { borderColor: C.rose, color: C.rose }); }}
                  onMouseLeave={e => { Object.assign((e.currentTarget as any).style, { borderColor: C.border2, color: C.textMuted }); }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* textarea — fontSize 16px prevents mobile zoom (Task 3) */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Your feedback</label>
                <textarea
                  value={ratingFeedback}
                  onChange={e => setRatingFeedback(e.target.value)}
                  placeholder="e.g. I need to account for brokerage, or I want to set a stop-loss target…"
                  rows={5}
                  autoFocus
                  style={{
                    ...inp,
                    fontSize: 16,          // Task 3: prevents iOS zoom on focus
                    resize: "none",
                    lineHeight: 1.65,
                    paddingTop: 12,
                    minHeight: 120,
                    color: C.text,
                    background: C.surface3,
                  }}
                />
              </div>

              {/* actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowRatingModal(false)}
                  style={{ flex: 1, padding: "12px", borderRadius: 9, background: "transparent", border: `1px solid ${C.border2}`, color: C.textMuted, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.06em", minHeight: 44, transition: "all 0.15s" }}
                  onMouseEnter={e => Object.assign((e.currentTarget as any).style, { borderColor: C.border, color: C.text })}
                  onMouseLeave={e => Object.assign((e.currentTarget as any).style, { borderColor: C.border2, color: C.textMuted })}
                >
                  CANCEL
                </button>
                <button
                  onClick={submitRatingFeedback}
                  disabled={!ratingFeedback.trim() || ratingSubmitting}
                  style={{
                    flex: 2, padding: "12px", borderRadius: 9, minHeight: 44,
                    background: !ratingFeedback.trim() ? C.surface3 : `${C.roseMid}66`,
                    border: `1px solid ${!ratingFeedback.trim() ? C.border2 : C.roseMid}`,
                    color: !ratingFeedback.trim() ? C.textMuted : C.rose,
                    cursor: !ratingFeedback.trim() ? "not-allowed" : "pointer",
                    fontSize: 11, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.06em",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    transition: "all 0.2s",
                  }}
                >
                  {ratingSubmitting
                    ? <RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                    : <Send size={13} />}
                  {ratingSubmitting ? "SENDING…" : "SUBMIT FEEDBACK"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
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

      {/* ── Main Grid ── */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 0", position: "relative", zIndex: 1 }}>
        <div className="tr-grid">

          {/* ══ LEFT PANEL ══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Ticker search */}
            <div style={card({ animation: "fadeInUp 0.35s ease both" })}>
              <div style={{ ...lbl, marginBottom: 10, fontSize: 11, letterSpacing: "0.04em" }}>
                <Search size={10} style={{ marginRight: 4 }} />FETCH LIVE PRICE
              </div>
              <div style={{ position: "relative" }} ref={sugRef}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
                    <input
                      value={tickerInput}
                      onChange={e => onTickerChange(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && fetchPrice(tickerInput)}
                      onFocus={() => tickerInput && setShowSug(suggestions.length > 0)}
                      placeholder="RELIANCE.NS, INFOSYS.NS…"
                      style={{ ...inp, paddingLeft: 32 }}
                    />
                  </div>
                  <button
                    onClick={() => fetchPrice(tickerInput)}
                    disabled={!tickerInput || fetching}
                    style={{ padding: "0 16px", borderRadius: 8, minHeight: 44, background: !tickerInput || fetching ? C.surface3 : C.sky, color: !tickerInput || fetching ? C.textMuted : "#000", border: `1px solid ${!tickerInput || fetching ? C.border2 : C.sky}`, cursor: !tickerInput || fetching ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", transition: "all 0.2s" }}>
                    {fetching ? <RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : "FETCH"}
                  </button>
                </div>

                {showSug && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 500, background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 10, overflow: "hidden", boxShadow: `0 12px 40px rgba(0,0,0,0.8)`, animation: "fadeInUp 0.18s ease" }}>
                    {suggestions.map(([sym, info]: any) => (
                      <div key={sym} onClick={() => { setTickerInput(sym); fetchPrice(sym); }}
                        style={{ padding: "10px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, transition: "background 0.12s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.surface4)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>{sym}</div>
                          <div style={{ fontSize: 10, color: C.textMuted }}>{info.name}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>₹{info.price.toFixed(2)}</div>
                          <div style={{ fontSize: 10, color: info.chg >= 0 ? C.emerald : C.rose }}>{info.chg >= 0 ? "▲" : "▼"} {Math.abs(info.chg)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {stockInfo && ticker && (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.skyDim}`, display: "flex", justifyContent: "space-between", alignItems: "center", animation: "fadeInUp 0.3s ease" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.sky }}>{ticker}</div>
                      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: C.emerald, animation: "livePulse 2s ease-in-out infinite" }} />
                      <span style={{ fontSize: 9, color: C.emerald, fontWeight: 700, letterSpacing: "0.06em" }}>LIVE</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{stockInfo.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.03em" }}>₹{parseFloat(cmp).toFixed(2)}</div>
                    <div style={{ fontSize: 10, color: stockInfo.chg >= 0 ? C.emerald : C.rose }}>{stockInfo.chg >= 0 ? "▲" : "▼"} {Math.abs(stockInfo.chg).toFixed(2)}% today</div>
                  </div>
                </div>
              )}
            </div>

            {/* Position inputs */}
            <div style={card({ animation: "fadeInUp 0.38s ease both" })}>
              <div style={{ ...lbl, marginBottom: 12 }}><BarChart2 size={10} style={{ marginRight: 4 }} />YOUR POSITION</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label style={lbl}>Avg Buy Price</label><input value={avgPrice} onChange={e => setAvgPrice(e.target.value)} placeholder="₹ 250.00" style={inp} type="number" /></div>
                <div><label style={lbl}>Quantity</label><input value={qty} onChange={e => setQty(e.target.value)} placeholder="100 shares" style={inp} type="number" /></div>
              </div>
              <div><label style={lbl}>CMP (override)</label><input value={cmp} onChange={e => setCmp(e.target.value)} placeholder="Current price" style={inp} type="number" /></div>
              {valid && status && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: isLoss ? `${C.roseDim}88` : `${C.emeraldDim}88`, border: `1px solid ${isLoss ? C.roseMid : C.emeraldMid}`, display: "flex", alignItems: "center", justifyContent: "space-between", animation: "fadeInUp 0.25s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isLoss ? <TrendingDown size={13} color={C.rose} /> : <TrendingUp size={13} color={C.emerald} />}
                    <span style={{ fontSize: 11, color: isLoss ? C.rose : C.emerald, fontWeight: 700 }}>{isLoss ? "LOSING POSITION" : "GAINING POSITION"}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isLoss ? C.rose : C.emerald }}>{status.pnlPct >= 0 ? "+" : ""}{status.pnlPct.toFixed(2)}%</span>
                </div>
              )}
            </div>

            {/* Recovery mode */}
            <div style={card({ animation: "fadeInUp 0.41s ease both" })}>
              <div style={{ ...lbl, marginBottom: 12 }}><Zap size={10} style={{ marginRight: 4 }} />RECOVERY MODE</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={() => setMode("target")}  style={chip(mode === "target",  C.emerald)}><Target    size={12} /> TARGET AVG</button>
                <button onClick={() => setMode("capital")} style={chip(mode === "capital", C.sky)}>   <DollarSign size={12} /> CAPITAL DEPLOY</button>
              </div>
              {mode === "target" ? (
                <div>
                  <label style={lbl}>Desired Average Price (₹)</label>
                  <input value={targetAvg} onChange={e => setTargetAvg(e.target.value)} placeholder={valid ? `Between ₹${fmt(nCmp)} – ₹${fmt(nAvg)}` : "Target avg"} style={inp} type="number" />
                  {valid && !isNaN(nTarget) && nTarget > 0 && (nTarget >= nAvg || nTarget <= nCmp) && (
                    <div style={{ marginTop: 6, fontSize: 10, color: C.amber, display: "flex", gap: 5, alignItems: "flex-start" }}>
                      <AlertTriangle size={10} style={{ marginTop: 1, flexShrink: 0 }} />
                      {nTarget >= nAvg ? "Target must be below your avg buy price" : "Target must be above CMP"}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label style={lbl}>Additional Capital (₹)</label>
                  <input value={capitalAmt} onChange={e => setCapitalAmt(e.target.value)} placeholder="e.g. ₹50,000" style={inp} type="number" />
                  {valid && !isNaN(nCapital) && nCapital > 0 && (
                    <div style={{ marginTop: 6, fontSize: 10, color: C.textMuted }}>≈ {(nCapital / nCmp).toFixed(2)} shares at ₹{fmt(nCmp)} CMP</div>
                  )}
                </div>
              )}
            </div>

            {/* Recent history */}
            {history.length > 0 && (
              <div style={card({ animation: "fadeInUp 0.44s ease both" })}>
                <div style={{ ...lbl, marginBottom: 10 }}><Clock size={10} style={{ marginRight: 4 }} />RECENT CALCULATIONS</div>
                {history.map((item: any, i: number) => (
                  <div key={i} onClick={() => loadItem(item)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: i < history.length - 1 ? 6 : 0, background: C.surface2, border: `1px solid ${C.border}`, transition: "border-color 0.15s, transform 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as any).style.borderColor = C.border2; (e.currentTarget as any).style.transform = "translateX(2px)"; }}
                    onMouseLeave={e => { (e.currentTarget as any).style.borderColor = C.border;  (e.currentTarget as any).style.transform = "translateX(0)"; }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: parseFloat(item.pnlPct) < 0 ? C.roseDim : C.emeraldDim, border: `1px solid ${parseFloat(item.pnlPct) < 0 ? C.roseMid : C.emeraldMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald }}>{item.ticker.slice(0, 4)}</div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{item.ticker}</div>
                        <div style={{ fontSize: 9, color: C.textMuted }}>₹{item.avgPrice} → {item.newAvg ? `₹${item.newAvg}` : "—"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald }}>{parseFloat(item.pnlPct) > 0 ? "+" : ""}{item.pnlPct}%</div>
                      <div onClick={e => delHistory(e, i)} style={{ color: C.textDim, cursor: "pointer", padding: 2, transition: "color 0.15s" }} onMouseEnter={e => ((e.currentTarget as any).style.color = C.rose)} onMouseLeave={e => ((e.currentTarget as any).style.color = C.textDim)}><X size={11} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══ RIGHT PANEL ══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Status strip */}
            {status ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10, width: "100%", boxSizing: "border-box" }}>
                {[
                  { label: "TOTAL INVESTED",  val: status.totalInvested, prefix: "₹",                       color: C.text,                                border: C.border,    bg: C.surface },
                  { label: "CURRENT VALUE",   val: status.currentValue,  prefix: "₹",                       color: C.text,                                border: C.border,    bg: C.surface },
                  { label: "UNREALIZED P&L",  val: Math.abs(status.pnl), prefix: status.pnl >= 0 ? "₹" : "-₹", color: status.pnl >= 0 ? C.emerald : C.rose,  border: status.pnl >= 0 ? C.emeraldMid : C.roseMid, bg: status.pnl >= 0 ? `${C.emeraldDim}88` : `${C.roseDim}88` },
                  { label: "P&L %",           val: status.pnlPct,        prefix: "",   suffix: "%",         color: status.pnlPct >= 0 ? C.emerald : C.rose, border: status.pnlPct >= 0 ? C.emeraldMid : C.roseMid, bg: status.pnlPct >= 0 ? `${C.emeraldDim}88` : `${C.roseDim}88` },
                ].map((item, i) => (
                  <div key={i}
                    style={{ background: item.bg, borderRadius: 12, border: `1px solid ${item.border}`, padding: "12px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, overflow: "hidden", animation: `fadeInUp ${0.3 + i * 0.06}s ease both`, transition: "transform 0.18s, box-shadow 0.18s" }}
                    onMouseEnter={e => { (e.currentTarget as any).style.transform = "translateY(-2px)"; (e.currentTarget as any).style.boxShadow = `0 4px 20px ${C.bg}88`; }}
                    onMouseLeave={e => { (e.currentTarget as any).style.transform = "none"; (e.currentTarget as any).style.boxShadow = "none"; }}>
                    <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4, whiteSpace: "nowrap" }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: item.color, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <AnimNum value={item.val} prefix={item.prefix} suffix={(item as any).suffix || ""} color={item.color} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "2rem", textAlign: "center" }}>
                <Layers size={24} color={C.textDim} style={{ margin: "0 auto 10px" }} />
                <div style={{ fontSize: 13, color: C.textMuted }}>Enter position details to analyze</div>
              </div>
            )}

            {/* Recovery Result Panel */}
            {result ? (
              <div style={{ background: `linear-gradient(135deg, ${C.surface2}f0, ${C.surface3}d0)`, border: `1px solid ${C.emeraldMid}`, borderRadius: 18, padding: "1.6rem", position: "relative", overflow: "hidden", animation: "panelIn 0.45s cubic-bezier(0.34,1.4,0.64,1)" }}>
                <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `${C.emerald}08`, pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: `${C.sky}05`, pointerEvents: "none" }} />

                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>{mode === "target" ? "TARGET RECOVERY" : "DEPLOYMENT PLAN"}</div>
                    <div style={{ fontSize: 13, color: C.emerald, fontWeight: 600, marginTop: 4 }}>
                      {mode === "target" ? `Buy ${result.addQty} shares at ₹${fmt(nCmp)} → ₹${fmt(nTarget)} avg` : `Deploy ${fmtCur(nCapital)} at CMP to rescue avg`}
                    </div>
                  </div>
                  <div style={{ padding: "6px 14px", borderRadius: 20, background: `${C.emeraldMid}aa`, border: `1px solid ${C.emeraldMid}`, fontSize: 11, color: C.emerald, fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0, marginLeft: 12, animation: "pulseGlow 3s ease-in-out infinite" }}>
                    {recovPct.toFixed(0)}% CLOSED
                  </div>
                </div>

                {/* Before → After hero */}
                <div style={{ display: "flex", alignItems: "stretch", background: `${C.bg}70`, borderRadius: 12, border: `1px solid ${C.border2}`, marginBottom: 18, overflow: "hidden" }}>
                  <div style={{ flex: 1, padding: "16px 18px", borderRight: `1px solid ${C.border2}` }}>
                    <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.09em", marginBottom: 6 }}>YOUR CURRENT AVG</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: C.rose, letterSpacing: "-0.04em", lineHeight: 1 }}>₹<AnimNum value={nAvg} color={C.rose} dec={2} /></div>
                    <div style={{ fontSize: 10, color: `${C.rose}77`, marginTop: 6 }}>{fmt(nQty, 0)} shares · {fmtCur(nAvg * nQty)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 16px", background: `${C.emeraldMid}22`, borderRight: `1px solid ${C.border2}`, minWidth: 80 }}>
                    <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>REDUCED</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.emerald, letterSpacing: "-0.03em" }}>
                      <AnimNum value={((nAvg - result.newAvg) / nAvg) * 100} color={C.emerald} prefix="↓ " suffix="%" dec={1} />
                    </div>
                    <ArrowRight size={14} color={`${C.emerald}55`} style={{ marginTop: 5 }} />
                  </div>
                  <div style={{ flex: 1, padding: "16px 18px", background: `${C.emeraldDim}44` }}>
                    <div style={{ fontSize: 9, color: C.emerald, fontWeight: 700, letterSpacing: "0.09em", marginBottom: 6 }}>NEW RESCUE AVG</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: C.emerald, letterSpacing: "-0.04em", lineHeight: 1 }}>₹<AnimNum value={result.newAvg} color={C.emerald} dec={2} /></div>
                    <div style={{ fontSize: 10, color: `${C.emerald}77`, marginTop: 6 }}>{fmt(result.totalQty, mode === "target" ? 0 : 2)} shares · {fmtCur(result.newAvg * result.totalQty)}</div>
                  </div>
                </div>

                {/* Metrics grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "SHARES TO BUY",  val: `${result.addQty.toFixed(0)}`,                                                                hl: false },
                    { label: "CAPITAL NEEDED", val: fmtCur(result.capital),                                                                         hl: false },
                    { label: "NEW AVERAGE",    val: `₹${fmt(result.newAvg)}`,                                                                      hl: true  },
                    { label: "TOTAL SHARES",   val: `${result.totalQty.toFixed(0)}`,                                                                hl: false },
                    { label: "OLD AVERAGE",    val: `₹${fmt(nAvg)}`,                                                                               hl: false },
                    { label: "AVG REDUCTION",  val: `↓ ₹${fmt(nAvg - result.newAvg)} (${fmt(((nAvg - result.newAvg) / nAvg) * 100, 1)}%)`,        hl: false },
                  ].map((item, i) => (
                    <div key={i}
                      style={{ background: `${C.bg}80`, borderRadius: 10, padding: "12px", border: `1px solid ${item.hl ? C.emeraldMid : C.border}`, transition: "transform 0.18s, border-color 0.18s" }}
                      onMouseEnter={e => { (e.currentTarget as any).style.transform = "translateY(-1px)"; (e.currentTarget as any).style.borderColor = item.hl ? C.emerald : C.border2; }}
                      onMouseLeave={e => { (e.currentTarget as any).style.transform = "none"; (e.currentTarget as any).style.borderColor = item.hl ? C.emeraldMid : C.border; }}>
                      <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6, letterSpacing: "0.07em", fontWeight: 700 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: item.hl ? C.emerald : C.text }}>{item.val}</div>
                    </div>
                  ))}
                </div>

                {/* Capital mode: break-even */}
                {mode === "capital" && (result as any).distBreakeven != null && (
                  <div style={{ padding: "10px 14px", borderRadius: 9, marginBottom: 16, background: `${C.amberDim}cc`, border: `1px solid ${C.amber}33`, display: "flex", alignItems: "center", gap: 8 }}>
                    <Target size={14} color={C.amber} />
                    <span style={{ fontSize: 11, color: C.amber }}>Needs <strong>{(result as any).distBreakeven.toFixed(2)}% rally</strong> from CMP (to ₹{fmt(nCmp * (1 + (result as any).distBreakeven / 100))}) for break-even</span>
                  </div>
                )}

                {/* Recovery progress bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.08em" }}>RECOVERY PROGRESS</span>
                    <span style={{ fontSize: 9, color: C.emerald, fontWeight: 700 }}>{recovPct.toFixed(1)}% gap eliminated</span>
                  </div>
                  <div style={{ height: 12, background: C.surface3, borderRadius: 6, border: `1px solid ${C.border}`, overflow: "hidden", position: "relative" }}>
                    <div style={{ height: "100%", width: `${recovPct}%`, background: `linear-gradient(90deg, ${C.rose}, ${C.amber}, ${C.emerald})`, borderRadius: 6, transition: "width 0.7s cubic-bezier(0.34,1.4,0.64,1)", boxShadow: `0 0 14px ${C.emerald}44`, position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.12) 50%,transparent 100%)", backgroundSize: "200% 100%", animation: "shimmer 2s linear infinite", borderRadius: 6 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    {[{ l: "CMP", v: nCmp, c: C.rose }, { l: "NEW AVG", v: result.newAvg, c: C.amber }, { l: "OLD AVG", v: nAvg, c: C.textMuted }].map(p => (
                      <div key={p.l} style={{ textAlign: p.l === "NEW AVG" ? "center" as any : "inherit" as any }}>
                        <div style={{ fontSize: 8, color: p.c, fontWeight: 700, letterSpacing: "0.06em" }}>{p.l}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: p.c }}>₹{fmt(p.v)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={saveHistory}
                  style={{ width: "100%", padding: "11px", borderRadius: 9, minHeight: 44, background: `${C.emeraldMid}66`, border: `1px solid ${C.emeraldMid}`, color: C.emerald, cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", transition: "background 0.2s, box-shadow 0.2s" }}
                  onMouseEnter={e => { (e.currentTarget as any).style.background = `${C.emeraldMid}aa`; (e.currentTarget as any).style.boxShadow = `0 0 16px ${C.emerald}22`; }}
                  onMouseLeave={e => { (e.currentTarget as any).style.background = `${C.emeraldMid}66`; (e.currentTarget as any).style.boxShadow = "none"; }}>
                  SAVE TO RECENT CALCULATIONS <ArrowRight size={13} />
                </button>
              </div>
            ) : valid && status && (
              <div style={{ ...card({ borderStyle: "dashed", borderColor: C.border2 }), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 130, gap: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: C.surface3, border: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {mode === "target" ? <Target size={20} color={C.textDim} /> : <DollarSign size={20} color={C.textDim} />}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center" }}>
                  {mode === "target" ? "Enter a target avg between CMP and your buy avg" : "Enter the capital amount you want to deploy"}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                Task 2: "Rate this Result" strip
                Shows TrendingUp / TrendingDown; negative opens modal
            ══════════════════════════════════════════════════════════════ */}
            {result && (
              <div style={{ ...card(), padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, animation: "fadeInUp 0.38s ease both" }}>
                {ratingDone ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center", animation: "fadeInUp 0.4s ease" }}>
                    <ThumbsUp size={16} color={C.emerald} />
                    <span style={{ fontSize: 12, color: C.emerald, fontWeight: 700, letterSpacing: "0.04em" }}>Thank you, Trader</span>
                    <span style={{ fontSize: 14, color: C.emerald }}>✦</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: C.textMuted }}>Was this rescue plan helpful?</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {/* Thumbs up — positive rating */}
                      <button
                        onClick={() => { track("result_rated", { rating: "positive" }); setRatingDone(true); }}
                        title="This helped!"
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, background: `${C.emeraldDim}`, border: `1px solid ${C.emeraldMid}`, color: C.emerald, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", minHeight: 44, transition: "all 0.18s" }}
                        onMouseEnter={e => (e.currentTarget as any).style.background = `${C.emeraldMid}`}
                        onMouseLeave={e => (e.currentTarget as any).style.background = `${C.emeraldDim}`}
                      >
                        <TrendingUp size={15} /> YES
                      </button>
                      {/* Thumbs down — opens improvement modal */}
                      <button
                        onClick={() => { track("result_rated", { rating: "negative" }); setShowRatingModal(true); }}
                        title="Something's missing"
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, background: `${C.roseDim}`, border: `1px solid ${C.roseMid}`, color: C.rose, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", minHeight: 44, transition: "all 0.18s" }}
                        onMouseEnter={e => (e.currentTarget as any).style.background = `${C.roseMid}`}
                        onMouseLeave={e => (e.currentTarget as any).style.background = `${C.roseDim}`}
                      >
                        <TrendingDown size={15} /> NEEDS WORK
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* What-If Scenarios */}
            {result && (
              <div style={{ ...card(), animation: "fadeInUp 0.4s ease both" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.08em" }}><Zap size={10} color={C.amber} /> WHAT-IF SCENARIOS</div>
                  <div style={{ fontSize: 9, color: C.textDim }}>P&amp;L if CMP bounces after averaging down</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {whatIfData.map(({ pct, pnl, pnlPct }: any) => (
                    <div key={pct}
                      style={{ borderRadius: 12, padding: "16px 12px", textAlign: "center" as any, background: pnl >= 0 ? `linear-gradient(145deg,${C.emeraldDim}cc,${C.surface3}bb)` : `linear-gradient(145deg,${C.roseDim}cc,${C.surface3}bb)`, border: `1px solid ${pnl >= 0 ? C.emeraldMid : C.roseMid}`, transition: "transform 0.18s, box-shadow 0.18s" }}
                      onMouseEnter={e => { (e.currentTarget as any).style.transform = "translateY(-3px)"; (e.currentTarget as any).style.boxShadow = `0 6px 24px ${pnl >= 0 ? C.emerald : C.rose}18`; }}
                      onMouseLeave={e => { (e.currentTarget as any).style.transform = "none"; (e.currentTarget as any).style.boxShadow = "none"; }}>
                      <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 10 }}>+{pct}% BOUNCE</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: pnl >= 0 ? C.emerald : C.rose, letterSpacing: "-0.04em", lineHeight: 1 }}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div>
                      <div style={{ fontSize: 11, color: pnl >= 0 ? `${C.emerald}99` : `${C.rose}99`, marginTop: 6, fontWeight: 600 }}>{pnl >= 0 ? "+" : ""}{fmtCur(pnl)}</div>
                      <div style={{ marginTop: 10, padding: "4px 6px", borderRadius: 6, background: `${C.bg}66`, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 9, color: C.textMuted }}>@ ₹{fmt(nCmp * (1 + pct / 100))}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opportunity Cost + Math Check */}
            {status && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, animation: "fadeInUp 0.45s ease both" }}>
                <div style={card()}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 5, letterSpacing: "0.08em" }}><AlertTriangle size={10} color={C.amber} /> OPPORTUNITY COST</div>
                  <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.6, marginBottom: 10 }}>Position weight (10× portfolio):</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
                    <div><div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>CURRENT</div><div style={{ fontSize: 22, fontWeight: 800, color: C.amber }}>10.0%</div></div>
                    {result && (
                      <>
                        <ArrowRight size={14} color={C.textDim} />
                        <div><div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>AFTER</div><div style={{ fontSize: 22, fontWeight: 800, color: C.rose }}>{Math.min(100, ((status.totalInvested + result.capital) / (status.totalInvested * 10)) * 100).toFixed(1)}%</div></div>
                      </>
                    )}
                  </div>
                  {result && <div style={{ height: 4, background: C.surface3, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 2, width: `${Math.min(100, ((status.totalInvested + result.capital) / (status.totalInvested * 10)) * 100)}%`, background: C.amber, transition: "width 0.6s ease" }} /></div>}
                </div>

                <div onClick={() => setShowMath(!showMath)} style={{ ...card({ cursor: "pointer" }), borderColor: showMath ? C.skyMid : C.border, transition: "border-color 0.2s" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", color: showMath ? C.sky : C.textMuted, marginBottom: 10, letterSpacing: "0.08em" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Shield size={10} color={showMath ? C.sky : C.textMuted} /> MATH CHECK</div>
                    <ChevronDown size={12} style={{ transform: showMath ? "rotate(180deg)" : "none", transition: "transform 0.25s" }} />
                  </div>
                  {!showMath
                    ? <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.7 }}>Click to verify the underlying arithmetic of your rescue plan.</div>
                    : result
                      ? <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace", lineHeight: 1.9, animation: "fadeInUp 0.2s ease" }}>
                          <div>OLD: {nQty} × ₹{fmt(nAvg)}</div>
                          <div style={{ borderLeft: `2px solid ${C.border2}`, paddingLeft: 8, margin: "2px 0 2px 4px" }}>= ₹{fmt(nQty * nAvg)}</div>
                          <div>NEW: {result.addQty.toFixed(0)} × ₹{fmt(nCmp)}</div>
                          <div style={{ borderLeft: `2px solid ${C.border2}`, paddingLeft: 8, margin: "2px 0 2px 4px" }}>= {fmtCur(result.capital)}</div>
                          <div style={{ color: C.emerald, fontWeight: 700, marginTop: 4 }}>∑ AVG = ₹{fmt(result.newAvg)} ✓</div>
                        </div>
                      : <div style={{ fontSize: 10, color: C.textMuted }}>Set recovery inputs to see breakdown.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Task 4: TradeRescue Roadmap Footer
          — dimmed secondary action; MessageCircle icon
          — links to external feedback portal (Tally/Canny)
      ══════════════════════════════════════════════════════════════════ */}
      <footer style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 32px", position: "relative", zIndex: 1 }}>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border2}, transparent)`, marginBottom: 24 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as any, gap: 14 }}>
          {/* Branding blurb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${C.emerald}66, ${C.sky}66)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={11} color="#000" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>Trade<span style={{ color: `${C.emerald}66` }}>Rescue</span></span>
            <span style={{ fontSize: 10, color: C.textDim }}>· Pure client-side · No tracking · Open math</span>
          </div>

          {/* Roadmap CTA — dimmed, secondary */}
          <a
            href="https://forms.gle/pa6qQVPL7NDBTbrQ9"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("roadmap_click", { source: "footer" })}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, fontWeight: 600, textDecoration: "none", letterSpacing: "0.04em", transition: "all 0.2s", minHeight: 44 }}
            onMouseEnter={e => { Object.assign((e.currentTarget as any).style, { borderColor: C.purple, color: C.purple, background: `${C.purpleDim}` }); }}
            onMouseLeave={e => { Object.assign((e.currentTarget as any).style, { borderColor: C.border, color: C.textMuted, background: "transparent" }); }}
          >
            <MessageCircle size={13} />
            TRADERESCUE ROADMAP
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: `${C.purple}22`, border: `1px solid ${C.purple}44`, color: C.purple }}>SUGGEST A FEATURE</span>
          </a>
        </div>
      </footer>

      {/* ── Global Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');

        @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes slideIn   { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeInUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes overlayIn { from{opacity:0} to{opacity:1} }
        @keyframes modalIn   { from{opacity:0;transform:scale(0.93) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes panelIn   { from{opacity:0;transform:scale(0.97) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 0 0 rgba(16,217,138,0.28)} 50%{box-shadow:0 0 0 8px rgba(16,217,138,0)} }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.75)} }
        @keyframes shimmer   { from{background-position:-200% center} to{background-position:200% center} }

        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input::placeholder, textarea::placeholder { color: ${C.textDim}; font-family: inherit; }
        input:focus, textarea:focus { border-color: ${C.sky} !important; box-shadow: 0 0 0 2px ${C.skyDim} !important; outline: none; }
        textarea { font-family: inherit; color: ${C.text}; background: ${C.surface3}; }
        button { font-family: inherit; }

        .tr-grid {
          display: grid;
          grid-template-columns: 330px 1fr;
          gap: 20px;
          width: 100%;
        }
        @media (max-width: 700px) {
          .tr-grid {
            grid-template-columns: 1fr !important;
            width: 100% !important;
            max-width: 100vw !important;
            overflow: hidden;
          }
          input { font-size: 16px !important; }
        }
      `}</style>
      {/* Vercel Analytics tracking */}
      <Analytics />
    </div>
  );
}

// 'use client';

// import { useState, useEffect, useRef, useCallback } from "react";
// import {
//   TrendingDown, TrendingUp, Search, RefreshCw, Clock,
//   Shield, Target, DollarSign, BarChart2, AlertTriangle,
//   ArrowRight, Zap, ChevronDown, X, Info, Layers,
//   MessageCircle, Send, ThumbsUp,
// } from "lucide-react";

// /* ─── Colour Palette ─────────────────────────────────────────────────────── */
// const C = {
//   bg:         "#06091a",
//   surface:    "#0b1025",
//   surface2:   "#0f1630",
//   surface3:   "#131d3a",
//   surface4:   "#172140",
//   border:     "#1a2848",
//   border2:    "#203059",
//   text:       "#d6e4f7",
//   textMuted:  "#5a7a9e",
//   textDim:    "#2a3d5a",
//   emerald:    "#10d98a",
//   emeraldDim: "#042d1c",
//   emeraldMid: "#065535",
//   rose:       "#ff3d68",
//   roseDim:    "#3d0018",
//   roseMid:    "#5c0025",
//   amber:      "#ffb830",
//   amberDim:   "#3d2200",
//   sky:        "#38c6f8",
//   skyDim:     "#032840",
//   skyMid:     "#054a74",
//   purple:     "#a78bfa",
//   purpleDim:  "#1e0d45",
// };

// /* ─── Mock Data ──────────────────────────────────────────────────────────── */
// const STOCKS: Record<string, any> = {
//   // AAPL:       { name: "Apple Inc.",           price: 189.43,  chg: -0.85 },
//   // MSFT:       { name: "Microsoft Corp.",      price: 421.72,  chg:  1.12 },
//   // TSLA:       { name: "Tesla Inc.",           price: 178.21,  chg: -3.42 },
//   // NVDA:       { name: "NVIDIA Corp.",         price: 875.35,  chg:  2.67 },
//   // GOOGL:      { name: "Alphabet Inc.",        price: 172.86,  chg:  0.44 },
//   // AMZN:       { name: "Amazon.com",           price: 185.60,  chg: -0.22 },
//   // META:       { name: "Meta Platforms",       price: 538.92,  chg:  1.85 },
//   // NFLX:       { name: "Netflix Inc.",         price: 668.44,  chg:  3.11 },
//   // RELIANCE:   { name: "Reliance Industries",  price: 2847.50, chg: -0.65 },
//   // TCS:        { name: "Tata Consultancy",     price: 3421.80, chg:  0.92 },
//   // INFY:       { name: "Infosys Ltd.",         price: 1562.40, chg: -1.23 },
//   // HDFCBANK:   { name: "HDFC Bank",            price: 1687.25, chg:  0.38 },
//   // WIPRO:      { name: "Wipro Ltd.",           price:  478.60, chg: -0.74 },
//   // BAJFINANCE: { name: "Bajaj Finance",        price: 6823.40, chg:  1.56 },
//   // TATAMOTORS: { name: "Tata Motors",          price:  972.35, chg: -2.18 },
//   // ICICIBANK:  { name: "ICICI Bank",           price: 1234.60, chg:  0.82 },
//   // ADANIPORTS: { name: "Adani Ports",          price: 1387.40, chg: -1.04 },
//   // SUNPHARMA:  { name: "Sun Pharma",           price: 1847.20, chg:  0.63 },
// };

// /* ─── Formatters ─────────────────────────────────────────────────────────── */
// const fmt = (n: any, dec = 2): string => {
//   const num = typeof n === "string" ? parseFloat(n) : n;
//   if (num == null || isNaN(num)) return "—";
//   return new Intl.NumberFormat("en-IN", {
//     style: "decimal",
//     minimumFractionDigits: dec,
//     maximumFractionDigits: dec,
//   }).format(num);
// };

// const fmtCur = (n: any): string => {
//   const num = typeof n === "string" ? parseFloat(n) : n;
//   if (num == null || isNaN(num)) return "—";
//   const abs = Math.abs(num), sign = num < 0 ? "-" : "";
//   if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)} Cr`;
//   if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(2)} L`;
//   return `${sign}₹${abs.toLocaleString("en-IN")}`;
// };

// /* ─── Analytics Helper ───────────────────────────────────────────────────── */
// // Task 1: safe wrapper around window.umami so it never throws when absent
// const track = (event: string, data?: Record<string, any>) => {
//   try {
//     const u = (window as any).umami;
//     if (u && typeof u.track === "function") u.track(event, data ?? {});
//   } catch {}
// };

// /* ─── Finance Engine ─────────────────────────────────────────────────────── */
// const calcStatus = (avg: number, qty: number, cmp: number) => ({
//   totalInvested: avg * qty,
//   currentValue:  cmp * qty,
//   pnl:           (cmp - avg) * qty,
//   pnlPct:        ((cmp - avg) / avg) * 100,
//   gapPct:        ((cmp - avg) / avg) * 100,
// });

// const calcTargetMode = (avg: number, qty: number, cmp: number, target: number) => {
//   if (target >= avg || target <= cmp || target <= 0) return null;
//   const addQty  = Math.ceil((qty * (avg - target)) / (target - cmp));
//   const capital = addQty * cmp;
//   return { addQty, capital, newAvg: (avg * qty + capital) / (qty + addQty), totalQty: qty + addQty };
// };

// const calcCapitalMode = (avg: number, qty: number, cmp: number, capital: number) => {
//   if (capital <= 0) return null;
//   const addQty      = capital / cmp;
//   const newAvg      = (avg * qty + capital) / (qty + addQty);
//   const distBreakeven = ((newAvg - cmp) / cmp) * 100;
//   return { addQty, capital, newAvg, totalQty: qty + addQty, distBreakeven };
// };

// /* ─── Animated Counter ───────────────────────────────────────────────────── */
// function AnimNum({ value, prefix = "", suffix = "", dec = 2, color }: any) {
//   const [display, setDisplay] = useState(value);
//   const prev = useRef(value);
//   useEffect(() => {
//     const s = prev.current, e = value;
//     if (isNaN(e) || isNaN(s)) { setDisplay(e); return; }
//     const t0 = performance.now();
//     const tick = (t: number) => {
//       const p = Math.min((t - t0) / 420, 1);
//       setDisplay(s + (e - s) * (1 - Math.pow(1 - p, 3)));
//       if (p < 1) requestAnimationFrame(tick); else prev.current = e;
//     };
//     requestAnimationFrame(tick);
//   }, [value]);
//   const n = typeof display === "number" ? display : value;
//   return <span style={{ color }}>{prefix}{isNaN(n) ? "—" : fmt(n, dec)}{suffix}</span>;
// }

// /* ══════════════════════════════════════════════════════════════════════════
//    MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════ */
// export default function TradeRescue() {

//   /* ── Existing state ── */
//   const [tickerInput, setTickerInput] = useState("");
//   const [ticker,      setTicker]      = useState("");
//   const [stockInfo,   setStockInfo]   = useState<any>(null);
//   const [cmp,         setCmp]         = useState("");
//   const [avgPrice,    setAvgPrice]    = useState("");
//   const [qty,         setQty]         = useState("");
//   const [fetching,    setFetching]    = useState(false);
//   const [suggestions, setSuggestions] = useState<any[]>([]);
//   const [showSug,     setShowSug]     = useState(false);
//   const [mode,        setMode]        = useState("target");
//   const [targetAvg,   setTargetAvg]   = useState("");
//   const [capitalAmt,  setCapitalAmt]  = useState("");
//   const [showMath,    setShowMath]    = useState(false);
//   const [history,     setHistory]     = useState<any[]>([]);
//   const [toast,       setToast]       = useState<any>(null);

//   /* ── Task 2: Rate-this-Result state ── */
//   const [ratingDone,       setRatingDone]       = useState(false);
//   const [showRatingModal,  setShowRatingModal]  = useState(false);
//   const [ratingFeedback,   setRatingFeedback]   = useState("");
//   const [ratingSubmitting, setRatingSubmitting] = useState(false);

//   const sugRef = useRef<any>(null);

//   /* ── History from localStorage ── */
//   useEffect(() => {
//     const r = localStorage.getItem("tr-history-v2");
//     if (r) setHistory(JSON.parse(r));
//   }, []);

//   /* ── Suggestions close on outside click ── */
//   useEffect(() => {
//     const handler = (e: any) => {
//       if (sugRef.current && !sugRef.current.contains(e.target)) setShowSug(false);
//     };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   /* ── Task 1: Session Heartbeat ────────────────────────────────────────
//      Tracks active vs idle time in 5-second ticks.
//      "Idle" is defined as no user activity for > 30 seconds.           */
//   useEffect(() => {
//     let activeSeconds = 0;
//     let lastActivity  = Date.now();

//     const onActivity = () => { lastActivity = Date.now(); };
//     const EVENTS = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;
//     EVENTS.forEach(ev => document.addEventListener(ev, onActivity, { passive: true }));

//     const heartbeat = setInterval(() => {
//       const idleSec = (Date.now() - lastActivity) / 1000;
//       const isIdle  = idleSec > 30;
//       if (!isIdle) activeSeconds += 5;
//       track("heartbeat", { activeSeconds, isIdle, idleSec: Math.round(idleSec) });
//     }, 5000);

//     return () => {
//       clearInterval(heartbeat);
//       EVENTS.forEach(ev => document.removeEventListener(ev, onActivity));
//     };
//   }, []);

//   /* ── Task 3: Lock body scroll when rating modal is open ── */
//   useEffect(() => {
//     document.body.style.overflow = showRatingModal ? "hidden" : "";
//     return () => { document.body.style.overflow = ""; };
//   }, [showRatingModal]);

//   /* ── Helpers ── */
//   const showToast = (msg: string, type = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3000);
//   };

//   /* ── Fetch live price ── */
//   const fetchPrice = async (sym: string) => {
//     if (!sym) return;
//     setFetching(true);
//     setShowSug(false);
//     try {
//       const response = await fetch(`/api/stock?symbol=${sym.toUpperCase()}`);
//       const data     = await response.json();
//       if (data.error) {
//         showToast("Stock not found. Try adding .NS for NSE", "warn");
//       } else {
//         setCmp(data.price.toString());
//         setStockInfo({ name: data.name, price: data.price, chg: data.chg });
//         setTicker(data.symbol);
//         showToast(`Loaded ${data.symbol} live price`);
//         /* Task 1: dispatch stock_search analytics event */
//         track("stock_search", { symbol: data.symbol, price: data.price });
//       }
//     } catch {
//       showToast("Failed to fetch market data", "warn");
//     } finally {
//       setFetching(false);
//     }
//   };

//   const onTickerChange = (val: string) => {
//     setTickerInput(val);
//     if (val.length >= 1) {
//       const f = Object.entries(STOCKS)
//         .filter(([k, v]) => k.startsWith(val.toUpperCase()) || v.name.toLowerCase().includes(val.toLowerCase()))
//         .slice(0, 6);
//       setSuggestions(f); setShowSug(f.length > 0);
//     } else { setSuggestions([]); setShowSug(false); }
//   };

//   /* ── Task 2: Rating submission ── */
//   const submitRatingFeedback = async () => {
//     if (!ratingFeedback.trim()) return;
//     setRatingSubmitting(true);
//     track("rating_feedback_submit", { feedback: ratingFeedback });
//     // Simulate async submission (wire to your endpoint here)
//     await new Promise(r => setTimeout(r, 900));
//     setRatingSubmitting(false);
//     setShowRatingModal(false);
//     setRatingDone(true);
//     setRatingFeedback("");
//   };

//   /* ── Core calculations ── */
//   const nAvg     = parseFloat(avgPrice);
//   const nQty     = parseFloat(qty);
//   const nCmp     = parseFloat(cmp);
//   const nTarget  = parseFloat(targetAvg);
//   const nCapital = parseFloat(capitalAmt);

//   const valid  = !isNaN(nAvg) && !isNaN(nQty) && !isNaN(nCmp) && nAvg > 0 && nQty > 0 && nCmp > 0;
//   const status = valid ? calcStatus(nAvg, nQty, nCmp) : null;
//   const isLoss = status && status.pnlPct < 0;

//   const targetRes  = valid && mode === "target"  && !isNaN(nTarget)  && nTarget  > 0 ? calcTargetMode(nAvg, nQty, nCmp, nTarget)  : null;
//   const capitalRes = valid && mode === "capital" && !isNaN(nCapital) && nCapital > 0 ? calcCapitalMode(nAvg, nQty, nCmp, nCapital) : null;
//   const result     = mode === "target" ? targetRes : capitalRes;

//   const recovPct = result && valid
//     ? Math.max(0, Math.min(100, ((nAvg - result.newAvg) / Math.max(nAvg - nCmp, 0.001)) * 100))
//     : 0;

//   const whatIfData = [3, 5, 10].map(pct => {
//     if (!result) return { pct, pnlPct: 0, pnl: 0 };
//     const newP   = nCmp * (1 + pct / 100);
//     const curVal = newP * result.totalQty;
//     return { pct, pnl: curVal - result.newAvg * result.totalQty, pnlPct: ((newP - result.newAvg) / result.newAvg) * 100 };
//   });

//   const saveHistory = () => {
//     if (!valid || !ticker || !status) return showToast("Enter position details first", "warn");
//     const entry   = { ticker, name: stockInfo?.name || ticker, avgPrice: nAvg, qty: nQty, cmp: nCmp, newAvg: result?.newAvg?.toFixed(2) || null, pnlPct: status.pnlPct.toFixed(2), ts: Date.now() };
//     const updated = [entry, ...history.filter((h: any) => h.ticker !== ticker)].slice(0, 5);
//     setHistory(updated);
//     try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
//     showToast("Saved to recent calculations");
//     track("save_calculation", { ticker, mode });
//   };

//   const loadItem = (item: any) => {
//     setTicker(item.ticker); setTickerInput(item.ticker);
//     setStockInfo(STOCKS[item.ticker] || { name: item.name, price: item.cmp, chg: 0 });
//     setCmp(item.cmp.toString()); setAvgPrice(item.avgPrice.toString()); setQty(item.qty.toString());
//   };

//   const delHistory = (e: any, idx: number) => {
//     e.stopPropagation();
//     const updated = history.filter((_, i) => i !== idx);
//     setHistory(updated);
//     try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
//   };

//   /* ── Style helpers ── */
//   const card = (extra: any = {}): any => ({
//     background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.25rem", ...extra,
//   });
//   const inp: any = {
//     width: "100%", background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 8,
//     padding: "9px 12px", color: C.text, fontSize: 13, outline: "none",
//     boxSizing: "border-box", fontFamily: "inherit", minHeight: 44,   // Task 3: 44px touch target
//     transition: "border-color 0.2s",
//   };
//   const lbl: any = {
//     display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
//     textTransform: "uppercase", color: C.textMuted, marginBottom: 5,
//   };
//   const chip = (active: boolean, color: string): any => ({
//     flex: 1, padding: "9px 4px", borderRadius: 8, cursor: "pointer", minHeight: 44, // Task 3
//     border: `1px solid ${active ? color : C.border2}`,
//     background: active ? `${color}18` : C.surface3,
//     color: active ? color : C.textMuted,
//     fontSize: 12, fontWeight: 600,
//     display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
//     transition: "all 0.18s", fontFamily: "inherit",
//   });

//   /* ══════════════════════════════════════════════════════════════════════
//      JSX
//   ══════════════════════════════════════════════════════════════════════ */
//   return (
//     <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Mono', monospace", color: C.text, overflowX: "hidden", position: "relative", width: "100%" }}>

//       {/* ambient glow orbs */}
//       <div style={{ position: "fixed", top: "8%", left: "12%", width: 440, height: 440, borderRadius: "50%", background: `radial-gradient(circle, ${C.emerald}07 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />
//       <div style={{ position: "fixed", bottom: "8%", right: "8%", width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${C.sky}05 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

//       {/* ── Toast ── */}
//       {toast && (
//         <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "success" ? C.emeraldMid : C.amberDim, border: `1px solid ${toast.type === "success" ? C.emerald : C.amber}`, borderRadius: 10, padding: "10px 16px", color: toast.type === "success" ? C.emerald : C.amber, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, animation: "slideIn 0.2s ease" }}>
//           {toast.type === "success" ? <TrendingUp size={14} /> : <AlertTriangle size={14} />}
//           {toast.msg}
//         </div>
//       )}

//       {/* ══════════════════════════════════════════════════════════════════
//           Task 2 & 3: "Rate this Result" Modal
//           — fixed, high z-index, body scroll locked when open
//       ══════════════════════════════════════════════════════════════════ */}
//       {showRatingModal && (
//         <div
//           onClick={e => { if (e.target === e.currentTarget) setShowRatingModal(false); }}
//           style={{ position: "fixed", inset: 0, background: "rgba(4,6,14,0.90)", backdropFilter: "blur(14px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "overlayIn 0.2s ease" }}
//         >
//           <div style={{ width: "100%", maxWidth: 460, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", animation: "modalIn 0.35s cubic-bezier(0.34,1.4,0.64,1)", boxShadow: `0 0 60px ${C.rose}12, 0 24px 64px rgba(0,0,0,0.65)` }}>

//             {/* gradient accent */}
//             <div style={{ height: 3, background: `linear-gradient(90deg, ${C.rose}, ${C.amber}, ${C.purple})` }} />

//             <div style={{ padding: "24px 26px 26px" }}>
//               {/* header */}
//               <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
//                 <div>
//                   <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
//                     What's missing from<br />this calculation?
//                   </div>
//                   <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>Your input helps us build a better tool.</div>
//                 </div>
//                 <button
//                   onClick={() => setShowRatingModal(false)}
//                   style={{ background: "none", border: `1px solid ${C.border2}`, borderRadius: 8, cursor: "pointer", color: C.textMuted, padding: "5px 6px", display: "flex", lineHeight: 1, fontFamily: "inherit", flexShrink: 0, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
//                   onMouseEnter={e => { Object.assign((e.currentTarget as any).style, { borderColor: C.rose, color: C.rose }); }}
//                   onMouseLeave={e => { Object.assign((e.currentTarget as any).style, { borderColor: C.border2, color: C.textMuted }); }}
//                 >
//                   <X size={15} />
//                 </button>
//               </div>

//               {/* textarea — fontSize 16px prevents mobile zoom (Task 3) */}
//               <div style={{ marginBottom: 16 }}>
//                 <label style={lbl}>Your feedback</label>
//                 <textarea
//                   value={ratingFeedback}
//                   onChange={e => setRatingFeedback(e.target.value)}
//                   placeholder="e.g. I need to account for brokerage, or I want to set a stop-loss target…"
//                   rows={5}
//                   autoFocus
//                   style={{
//                     ...inp,
//                     fontSize: 16,          // Task 3: prevents iOS zoom on focus
//                     resize: "none",
//                     lineHeight: 1.65,
//                     paddingTop: 12,
//                     minHeight: 120,
//                     color: C.text,
//                     background: C.surface3,
//                   }}
//                 />
//               </div>

//               {/* actions */}
//               <div style={{ display: "flex", gap: 10 }}>
//                 <button
//                   onClick={() => setShowRatingModal(false)}
//                   style={{ flex: 1, padding: "12px", borderRadius: 9, background: "transparent", border: `1px solid ${C.border2}`, color: C.textMuted, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.06em", minHeight: 44, transition: "all 0.15s" }}
//                   onMouseEnter={e => Object.assign((e.currentTarget as any).style, { borderColor: C.border, color: C.text })}
//                   onMouseLeave={e => Object.assign((e.currentTarget as any).style, { borderColor: C.border2, color: C.textMuted })}
//                 >
//                   CANCEL
//                 </button>
//                 <button
//                   onClick={submitRatingFeedback}
//                   disabled={!ratingFeedback.trim() || ratingSubmitting}
//                   style={{
//                     flex: 2, padding: "12px", borderRadius: 9, minHeight: 44,
//                     background: !ratingFeedback.trim() ? C.surface3 : `${C.roseMid}66`,
//                     border: `1px solid ${!ratingFeedback.trim() ? C.border2 : C.roseMid}`,
//                     color: !ratingFeedback.trim() ? C.textMuted : C.rose,
//                     cursor: !ratingFeedback.trim() ? "not-allowed" : "pointer",
//                     fontSize: 11, fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.06em",
//                     display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
//                     transition: "all 0.2s",
//                   }}
//                 >
//                   {ratingSubmitting
//                     ? <RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} />
//                     : <Send size={13} />}
//                   {ratingSubmitting ? "SENDING…" : "SUBMIT FEEDBACK"}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Header ── */}
//       <div style={{ padding: "0 24px", height: 56, background: `${C.surface}cc`, backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//           <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.emerald}cc, ${C.sky}cc)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
//             <TrendingUp size={16} color="#000" strokeWidth={2.5} />
//           </div>
//           <div>
//             <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em", color: C.text }}>Trade<span style={{ color: C.emerald }}>Rescue</span></div>
//             <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Recovery Calculator</div>
//           </div>
//         </div>
//         <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//           <div style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${C.border2}`, background: C.surface2, fontSize: 10, color: C.textMuted, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
//             <Shield size={10} color={C.emerald} /> NO DATA STORED EXTERNALLY
//           </div>
//         </div>
//       </div>

//       {/* ── Main Grid ── */}
//       <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 0", position: "relative", zIndex: 1 }}>
//         <div className="tr-grid">

//           {/* ══ LEFT PANEL ══ */}
//           <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

//             {/* Ticker search */}
//             <div style={card({ animation: "fadeInUp 0.35s ease both" })}>
//               <div style={{ ...lbl, marginBottom: 10, fontSize: 11, letterSpacing: "0.04em" }}>
//                 <Search size={10} style={{ marginRight: 4 }} />FETCH LIVE PRICE
//               </div>
//               <div style={{ position: "relative" }} ref={sugRef}>
//                 <div style={{ display: "flex", gap: 8 }}>
//                   <div style={{ position: "relative", flex: 1 }}>
//                     <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
//                     <input
//                       value={tickerInput}
//                       onChange={e => onTickerChange(e.target.value)}
//                       onKeyDown={e => e.key === "Enter" && fetchPrice(tickerInput)}
//                       onFocus={() => tickerInput && setShowSug(suggestions.length > 0)}
//                       placeholder="RELIANCE.NS, INFOSYS.NS…"
//                       style={{ ...inp, paddingLeft: 32 }}
//                     />
//                   </div>
//                   <button
//                     onClick={() => fetchPrice(tickerInput)}
//                     disabled={!tickerInput || fetching}
//                     style={{ padding: "0 16px", borderRadius: 8, minHeight: 44, background: !tickerInput || fetching ? C.surface3 : C.sky, color: !tickerInput || fetching ? C.textMuted : "#000", border: `1px solid ${!tickerInput || fetching ? C.border2 : C.sky}`, cursor: !tickerInput || fetching ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", transition: "all 0.2s" }}>
//                     {fetching ? <RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : "FETCH"}
//                   </button>
//                 </div>

//                 {showSug && (
//                   <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 500, background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 10, overflow: "hidden", boxShadow: `0 12px 40px rgba(0,0,0,0.8)`, animation: "fadeInUp 0.18s ease" }}>
//                     {suggestions.map(([sym, info]: any) => (
//                       <div key={sym} onClick={() => { setTickerInput(sym); fetchPrice(sym); }}
//                         style={{ padding: "10px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, transition: "background 0.12s" }}
//                         onMouseEnter={e => (e.currentTarget.style.background = C.surface4)}
//                         onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
//                         <div>
//                           <div style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>{sym}</div>
//                           <div style={{ fontSize: 10, color: C.textMuted }}>{info.name}</div>
//                         </div>
//                         <div style={{ textAlign: "right" }}>
//                           <div style={{ fontSize: 13, fontWeight: 700 }}>₹{info.price.toFixed(2)}</div>
//                           <div style={{ fontSize: 10, color: info.chg >= 0 ? C.emerald : C.rose }}>{info.chg >= 0 ? "▲" : "▼"} {Math.abs(info.chg)}%</div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </div>

//               {stockInfo && ticker && (
//                 <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.skyDim}`, display: "flex", justifyContent: "space-between", alignItems: "center", animation: "fadeInUp 0.3s ease" }}>
//                   <div>
//                     <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
//                       <div style={{ fontSize: 13, fontWeight: 700, color: C.sky }}>{ticker}</div>
//                       <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: C.emerald, animation: "livePulse 2s ease-in-out infinite" }} />
//                       <span style={{ fontSize: 9, color: C.emerald, fontWeight: 700, letterSpacing: "0.06em" }}>LIVE</span>
//                     </div>
//                     <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{stockInfo.name}</div>
//                   </div>
//                   <div style={{ textAlign: "right" }}>
//                     <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.03em" }}>₹{parseFloat(cmp).toFixed(2)}</div>
//                     <div style={{ fontSize: 10, color: stockInfo.chg >= 0 ? C.emerald : C.rose }}>{stockInfo.chg >= 0 ? "▲" : "▼"} {Math.abs(stockInfo.chg).toFixed(2)}% today</div>
//                   </div>
//                 </div>
//               )}
//             </div>

//             {/* Position inputs */}
//             <div style={card({ animation: "fadeInUp 0.38s ease both" })}>
//               <div style={{ ...lbl, marginBottom: 12 }}><BarChart2 size={10} style={{ marginRight: 4 }} />YOUR POSITION</div>
//               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
//                 <div><label style={lbl}>Avg Buy Price</label><input value={avgPrice} onChange={e => setAvgPrice(e.target.value)} placeholder="₹ 250.00" style={inp} type="number" /></div>
//                 <div><label style={lbl}>Quantity</label><input value={qty} onChange={e => setQty(e.target.value)} placeholder="100 shares" style={inp} type="number" /></div>
//               </div>
//               <div><label style={lbl}>CMP (override)</label><input value={cmp} onChange={e => setCmp(e.target.value)} placeholder="Current price" style={inp} type="number" /></div>
//               {valid && status && (
//                 <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: isLoss ? `${C.roseDim}88` : `${C.emeraldDim}88`, border: `1px solid ${isLoss ? C.roseMid : C.emeraldMid}`, display: "flex", alignItems: "center", justifyContent: "space-between", animation: "fadeInUp 0.25s ease" }}>
//                   <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
//                     {isLoss ? <TrendingDown size={13} color={C.rose} /> : <TrendingUp size={13} color={C.emerald} />}
//                     <span style={{ fontSize: 11, color: isLoss ? C.rose : C.emerald, fontWeight: 700 }}>{isLoss ? "LOSING POSITION" : "GAINING POSITION"}</span>
//                   </div>
//                   <span style={{ fontSize: 13, fontWeight: 700, color: isLoss ? C.rose : C.emerald }}>{status.pnlPct >= 0 ? "+" : ""}{status.pnlPct.toFixed(2)}%</span>
//                 </div>
//               )}
//             </div>

//             {/* Recovery mode */}
//             <div style={card({ animation: "fadeInUp 0.41s ease both" })}>
//               <div style={{ ...lbl, marginBottom: 12 }}><Zap size={10} style={{ marginRight: 4 }} />RECOVERY MODE</div>
//               <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
//                 <button onClick={() => setMode("target")}  style={chip(mode === "target",  C.emerald)}><Target    size={12} /> TARGET AVG</button>
//                 <button onClick={() => setMode("capital")} style={chip(mode === "capital", C.sky)}>   <DollarSign size={12} /> CAPITAL DEPLOY</button>
//               </div>
//               {mode === "target" ? (
//                 <div>
//                   <label style={lbl}>Desired Average Price (₹)</label>
//                   <input value={targetAvg} onChange={e => setTargetAvg(e.target.value)} placeholder={valid ? `Between ₹${fmt(nCmp)} – ₹${fmt(nAvg)}` : "Target avg"} style={inp} type="number" />
//                   {valid && !isNaN(nTarget) && nTarget > 0 && (nTarget >= nAvg || nTarget <= nCmp) && (
//                     <div style={{ marginTop: 6, fontSize: 10, color: C.amber, display: "flex", gap: 5, alignItems: "flex-start" }}>
//                       <AlertTriangle size={10} style={{ marginTop: 1, flexShrink: 0 }} />
//                       {nTarget >= nAvg ? "Target must be below your avg buy price" : "Target must be above CMP"}
//                     </div>
//                   )}
//                 </div>
//               ) : (
//                 <div>
//                   <label style={lbl}>Additional Capital (₹)</label>
//                   <input value={capitalAmt} onChange={e => setCapitalAmt(e.target.value)} placeholder="e.g. ₹50,000" style={inp} type="number" />
//                   {valid && !isNaN(nCapital) && nCapital > 0 && (
//                     <div style={{ marginTop: 6, fontSize: 10, color: C.textMuted }}>≈ {(nCapital / nCmp).toFixed(2)} shares at ₹{fmt(nCmp)} CMP</div>
//                   )}
//                 </div>
//               )}
//             </div>

//             {/* Recent history */}
//             {history.length > 0 && (
//               <div style={card({ animation: "fadeInUp 0.44s ease both" })}>
//                 <div style={{ ...lbl, marginBottom: 10 }}><Clock size={10} style={{ marginRight: 4 }} />RECENT CALCULATIONS</div>
//                 {history.map((item: any, i: number) => (
//                   <div key={i} onClick={() => loadItem(item)}
//                     style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: i < history.length - 1 ? 6 : 0, background: C.surface2, border: `1px solid ${C.border}`, transition: "border-color 0.15s, transform 0.15s" }}
//                     onMouseEnter={e => { (e.currentTarget as any).style.borderColor = C.border2; (e.currentTarget as any).style.transform = "translateX(2px)"; }}
//                     onMouseLeave={e => { (e.currentTarget as any).style.borderColor = C.border;  (e.currentTarget as any).style.transform = "translateX(0)"; }}>
//                     <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
//                       <div style={{ width: 30, height: 30, borderRadius: 7, background: parseFloat(item.pnlPct) < 0 ? C.roseDim : C.emeraldDim, border: `1px solid ${parseFloat(item.pnlPct) < 0 ? C.roseMid : C.emeraldMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald }}>{item.ticker.slice(0, 4)}</div>
//                       <div>
//                         <div style={{ fontSize: 11, fontWeight: 700 }}>{item.ticker}</div>
//                         <div style={{ fontSize: 9, color: C.textMuted }}>₹{item.avgPrice} → {item.newAvg ? `₹${item.newAvg}` : "—"}</div>
//                       </div>
//                     </div>
//                     <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                       <div style={{ fontSize: 10, fontWeight: 700, color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald }}>{parseFloat(item.pnlPct) > 0 ? "+" : ""}{item.pnlPct}%</div>
//                       <div onClick={e => delHistory(e, i)} style={{ color: C.textDim, cursor: "pointer", padding: 2, transition: "color 0.15s" }} onMouseEnter={e => ((e.currentTarget as any).style.color = C.rose)} onMouseLeave={e => ((e.currentTarget as any).style.color = C.textDim)}><X size={11} /></div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           {/* ══ RIGHT PANEL ══ */}
//           <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

//             {/* Status strip */}
//             {status ? (
//               <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10, width: "100%", boxSizing: "border-box" }}>
//                 {[
//                   { label: "TOTAL INVESTED",  val: status.totalInvested, prefix: "₹",                       color: C.text,                                border: C.border,    bg: C.surface },
//                   { label: "CURRENT VALUE",   val: status.currentValue,  prefix: "₹",                       color: C.text,                                border: C.border,    bg: C.surface },
//                   { label: "UNREALIZED P&L",  val: Math.abs(status.pnl), prefix: status.pnl >= 0 ? "₹" : "-₹", color: status.pnl >= 0 ? C.emerald : C.rose,  border: status.pnl >= 0 ? C.emeraldMid : C.roseMid, bg: status.pnl >= 0 ? `${C.emeraldDim}88` : `${C.roseDim}88` },
//                   { label: "P&L %",           val: status.pnlPct,        prefix: "",   suffix: "%",         color: status.pnlPct >= 0 ? C.emerald : C.rose, border: status.pnlPct >= 0 ? C.emeraldMid : C.roseMid, bg: status.pnlPct >= 0 ? `${C.emeraldDim}88` : `${C.roseDim}88` },
//                 ].map((item, i) => (
//                   <div key={i}
//                     style={{ background: item.bg, borderRadius: 12, border: `1px solid ${item.border}`, padding: "12px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, overflow: "hidden", animation: `fadeInUp ${0.3 + i * 0.06}s ease both`, transition: "transform 0.18s, box-shadow 0.18s" }}
//                     onMouseEnter={e => { (e.currentTarget as any).style.transform = "translateY(-2px)"; (e.currentTarget as any).style.boxShadow = `0 4px 20px ${C.bg}88`; }}
//                     onMouseLeave={e => { (e.currentTarget as any).style.transform = "none"; (e.currentTarget as any).style.boxShadow = "none"; }}>
//                     <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4, whiteSpace: "nowrap" }}>{item.label}</div>
//                     <div style={{ fontSize: 16, fontWeight: 700, color: item.color, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis" }}>
//                       <AnimNum value={item.val} prefix={item.prefix} suffix={(item as any).suffix || ""} color={item.color} />
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "2rem", textAlign: "center" }}>
//                 <Layers size={24} color={C.textDim} style={{ margin: "0 auto 10px" }} />
//                 <div style={{ fontSize: 13, color: C.textMuted }}>Enter position details to analyze</div>
//               </div>
//             )}

//             {/* Recovery Result Panel */}
//             {result ? (
//               <div style={{ background: `linear-gradient(135deg, ${C.surface2}f0, ${C.surface3}d0)`, border: `1px solid ${C.emeraldMid}`, borderRadius: 18, padding: "1.6rem", position: "relative", overflow: "hidden", animation: "panelIn 0.45s cubic-bezier(0.34,1.4,0.64,1)" }}>
//                 <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `${C.emerald}08`, pointerEvents: "none" }} />
//                 <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: `${C.sky}05`, pointerEvents: "none" }} />

//                 {/* Header row */}
//                 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
//                   <div>
//                     <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>{mode === "target" ? "TARGET RECOVERY" : "DEPLOYMENT PLAN"}</div>
//                     <div style={{ fontSize: 13, color: C.emerald, fontWeight: 600, marginTop: 4 }}>
//                       {mode === "target" ? `Buy ${result.addQty} shares at ₹${fmt(nCmp)} → ₹${fmt(nTarget)} avg` : `Deploy ${fmtCur(nCapital)} at CMP to rescue avg`}
//                     </div>
//                   </div>
//                   <div style={{ padding: "6px 14px", borderRadius: 20, background: `${C.emeraldMid}aa`, border: `1px solid ${C.emeraldMid}`, fontSize: 11, color: C.emerald, fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0, marginLeft: 12, animation: "pulseGlow 3s ease-in-out infinite" }}>
//                     {recovPct.toFixed(0)}% CLOSED
//                   </div>
//                 </div>

//                 {/* Before → After hero */}
//                 <div style={{ display: "flex", alignItems: "stretch", background: `${C.bg}70`, borderRadius: 12, border: `1px solid ${C.border2}`, marginBottom: 18, overflow: "hidden" }}>
//                   <div style={{ flex: 1, padding: "16px 18px", borderRight: `1px solid ${C.border2}` }}>
//                     <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.09em", marginBottom: 6 }}>YOUR CURRENT AVG</div>
//                     <div style={{ fontSize: 30, fontWeight: 800, color: C.rose, letterSpacing: "-0.04em", lineHeight: 1 }}>₹<AnimNum value={nAvg} color={C.rose} dec={2} /></div>
//                     <div style={{ fontSize: 10, color: `${C.rose}77`, marginTop: 6 }}>{fmt(nQty, 0)} shares · {fmtCur(nAvg * nQty)}</div>
//                   </div>
//                   <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 16px", background: `${C.emeraldMid}22`, borderRight: `1px solid ${C.border2}`, minWidth: 80 }}>
//                     <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>REDUCED</div>
//                     <div style={{ fontSize: 20, fontWeight: 800, color: C.emerald, letterSpacing: "-0.03em" }}>
//                       <AnimNum value={((nAvg - result.newAvg) / nAvg) * 100} color={C.emerald} prefix="↓ " suffix="%" dec={1} />
//                     </div>
//                     <ArrowRight size={14} color={`${C.emerald}55`} style={{ marginTop: 5 }} />
//                   </div>
//                   <div style={{ flex: 1, padding: "16px 18px", background: `${C.emeraldDim}44` }}>
//                     <div style={{ fontSize: 9, color: C.emerald, fontWeight: 700, letterSpacing: "0.09em", marginBottom: 6 }}>NEW RESCUE AVG</div>
//                     <div style={{ fontSize: 30, fontWeight: 800, color: C.emerald, letterSpacing: "-0.04em", lineHeight: 1 }}>₹<AnimNum value={result.newAvg} color={C.emerald} dec={2} /></div>
//                     <div style={{ fontSize: 10, color: `${C.emerald}77`, marginTop: 6 }}>{fmt(result.totalQty, mode === "target" ? 0 : 2)} shares · {fmtCur(result.newAvg * result.totalQty)}</div>
//                   </div>
//                 </div>

//                 {/* Metrics grid */}
//                 <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
//                   {[
//                     { label: "SHARES TO BUY",  val: `${result.addQty.toFixed(0)}`,                                                                hl: false },
//                     { label: "CAPITAL NEEDED", val: fmtCur(result.capital),                                                                         hl: false },
//                     { label: "NEW AVERAGE",    val: `₹${fmt(result.newAvg)}`,                                                                      hl: true  },
//                     { label: "TOTAL SHARES",   val: `${result.totalQty.toFixed(0)}`,                                                                hl: false },
//                     { label: "OLD AVERAGE",    val: `₹${fmt(nAvg)}`,                                                                               hl: false },
//                     { label: "AVG REDUCTION",  val: `↓ ₹${fmt(nAvg - result.newAvg)} (${fmt(((nAvg - result.newAvg) / nAvg) * 100, 1)}%)`,        hl: false },
//                   ].map((item, i) => (
//                     <div key={i}
//                       style={{ background: `${C.bg}80`, borderRadius: 10, padding: "12px", border: `1px solid ${item.hl ? C.emeraldMid : C.border}`, transition: "transform 0.18s, border-color 0.18s" }}
//                       onMouseEnter={e => { (e.currentTarget as any).style.transform = "translateY(-1px)"; (e.currentTarget as any).style.borderColor = item.hl ? C.emerald : C.border2; }}
//                       onMouseLeave={e => { (e.currentTarget as any).style.transform = "none"; (e.currentTarget as any).style.borderColor = item.hl ? C.emeraldMid : C.border; }}>
//                       <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6, letterSpacing: "0.07em", fontWeight: 700 }}>{item.label}</div>
//                       <div style={{ fontSize: 14, fontWeight: 700, color: item.hl ? C.emerald : C.text }}>{item.val}</div>
//                     </div>
//                   ))}
//                 </div>

//                 {/* Capital mode: break-even */}
//                 {mode === "capital" && (result as any).distBreakeven != null && (
//                   <div style={{ padding: "10px 14px", borderRadius: 9, marginBottom: 16, background: `${C.amberDim}cc`, border: `1px solid ${C.amber}33`, display: "flex", alignItems: "center", gap: 8 }}>
//                     <Target size={14} color={C.amber} />
//                     <span style={{ fontSize: 11, color: C.amber }}>Needs <strong>{(result as any).distBreakeven.toFixed(2)}% rally</strong> from CMP (to ₹{fmt(nCmp * (1 + (result as any).distBreakeven / 100))}) for break-even</span>
//                   </div>
//                 )}

//                 {/* Recovery progress bar */}
//                 <div style={{ marginBottom: 16 }}>
//                   <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
//                     <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "0.08em" }}>RECOVERY PROGRESS</span>
//                     <span style={{ fontSize: 9, color: C.emerald, fontWeight: 700 }}>{recovPct.toFixed(1)}% gap eliminated</span>
//                   </div>
//                   <div style={{ height: 12, background: C.surface3, borderRadius: 6, border: `1px solid ${C.border}`, overflow: "hidden", position: "relative" }}>
//                     <div style={{ height: "100%", width: `${recovPct}%`, background: `linear-gradient(90deg, ${C.rose}, ${C.amber}, ${C.emerald})`, borderRadius: 6, transition: "width 0.7s cubic-bezier(0.34,1.4,0.64,1)", boxShadow: `0 0 14px ${C.emerald}44`, position: "relative" }}>
//                       <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.12) 50%,transparent 100%)", backgroundSize: "200% 100%", animation: "shimmer 2s linear infinite", borderRadius: 6 }} />
//                     </div>
//                   </div>
//                   <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
//                     {[{ l: "CMP", v: nCmp, c: C.rose }, { l: "NEW AVG", v: result.newAvg, c: C.amber }, { l: "OLD AVG", v: nAvg, c: C.textMuted }].map(p => (
//                       <div key={p.l} style={{ textAlign: p.l === "NEW AVG" ? "center" as any : "inherit" as any }}>
//                         <div style={{ fontSize: 8, color: p.c, fontWeight: 700, letterSpacing: "0.06em" }}>{p.l}</div>
//                         <div style={{ fontSize: 11, fontWeight: 700, color: p.c }}>₹{fmt(p.v)}</div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>

//                 <button onClick={saveHistory}
//                   style={{ width: "100%", padding: "11px", borderRadius: 9, minHeight: 44, background: `${C.emeraldMid}66`, border: `1px solid ${C.emeraldMid}`, color: C.emerald, cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", transition: "background 0.2s, box-shadow 0.2s" }}
//                   onMouseEnter={e => { (e.currentTarget as any).style.background = `${C.emeraldMid}aa`; (e.currentTarget as any).style.boxShadow = `0 0 16px ${C.emerald}22`; }}
//                   onMouseLeave={e => { (e.currentTarget as any).style.background = `${C.emeraldMid}66`; (e.currentTarget as any).style.boxShadow = "none"; }}>
//                   SAVE TO RECENT CALCULATIONS <ArrowRight size={13} />
//                 </button>
//               </div>
//             ) : valid && status && (
//               <div style={{ ...card({ borderStyle: "dashed", borderColor: C.border2 }), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 130, gap: 8 }}>
//                 <div style={{ width: 44, height: 44, borderRadius: 12, background: C.surface3, border: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
//                   {mode === "target" ? <Target size={20} color={C.textDim} /> : <DollarSign size={20} color={C.textDim} />}
//                 </div>
//                 <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center" }}>
//                   {mode === "target" ? "Enter a target avg between CMP and your buy avg" : "Enter the capital amount you want to deploy"}
//                 </div>
//               </div>
//             )}

//             {/* ══════════════════════════════════════════════════════════════
//                 Task 2: "Rate this Result" strip
//                 Shows TrendingUp / TrendingDown; negative opens modal
//             ══════════════════════════════════════════════════════════════ */}
//             {result && (
//               <div style={{ ...card(), padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, animation: "fadeInUp 0.38s ease both" }}>
//                 {ratingDone ? (
//                   <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center", animation: "fadeInUp 0.4s ease" }}>
//                     <ThumbsUp size={16} color={C.emerald} />
//                     <span style={{ fontSize: 12, color: C.emerald, fontWeight: 700, letterSpacing: "0.04em" }}>Thank you, Trader</span>
//                     <span style={{ fontSize: 14, color: C.emerald }}>✦</span>
//                   </div>
//                 ) : (
//                   <>
//                     <div style={{ fontSize: 11, color: C.textMuted }}>Was this rescue plan helpful?</div>
//                     <div style={{ display: "flex", gap: 8 }}>
//                       {/* Thumbs up — positive rating */}
//                       <button
//                         onClick={() => { track("result_rated", { rating: "positive" }); setRatingDone(true); }}
//                         title="This helped!"
//                         style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, background: `${C.emeraldDim}`, border: `1px solid ${C.emeraldMid}`, color: C.emerald, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", minHeight: 44, transition: "all 0.18s" }}
//                         onMouseEnter={e => (e.currentTarget as any).style.background = `${C.emeraldMid}`}
//                         onMouseLeave={e => (e.currentTarget as any).style.background = `${C.emeraldDim}`}
//                       >
//                         <TrendingUp size={15} /> YES
//                       </button>
//                       {/* Thumbs down — opens improvement modal */}
//                       <button
//                         onClick={() => { track("result_rated", { rating: "negative" }); setShowRatingModal(true); }}
//                         title="Something's missing"
//                         style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, background: `${C.roseDim}`, border: `1px solid ${C.roseMid}`, color: C.rose, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", minHeight: 44, transition: "all 0.18s" }}
//                         onMouseEnter={e => (e.currentTarget as any).style.background = `${C.roseMid}`}
//                         onMouseLeave={e => (e.currentTarget as any).style.background = `${C.roseDim}`}
//                       >
//                         <TrendingDown size={15} /> NEEDS WORK
//                       </button>
//                     </div>
//                   </>
//                 )}
//               </div>
//             )}

//             {/* What-If Scenarios */}
//             {result && (
//               <div style={{ ...card(), animation: "fadeInUp 0.4s ease both" }}>
//                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
//                   <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.08em" }}><Zap size={10} color={C.amber} /> WHAT-IF SCENARIOS</div>
//                   <div style={{ fontSize: 9, color: C.textDim }}>P&amp;L if CMP bounces after averaging down</div>
//                 </div>
//                 <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
//                   {whatIfData.map(({ pct, pnl, pnlPct }: any) => (
//                     <div key={pct}
//                       style={{ borderRadius: 12, padding: "16px 12px", textAlign: "center" as any, background: pnl >= 0 ? `linear-gradient(145deg,${C.emeraldDim}cc,${C.surface3}bb)` : `linear-gradient(145deg,${C.roseDim}cc,${C.surface3}bb)`, border: `1px solid ${pnl >= 0 ? C.emeraldMid : C.roseMid}`, transition: "transform 0.18s, box-shadow 0.18s" }}
//                       onMouseEnter={e => { (e.currentTarget as any).style.transform = "translateY(-3px)"; (e.currentTarget as any).style.boxShadow = `0 6px 24px ${pnl >= 0 ? C.emerald : C.rose}18`; }}
//                       onMouseLeave={e => { (e.currentTarget as any).style.transform = "none"; (e.currentTarget as any).style.boxShadow = "none"; }}>
//                       <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 10 }}>+{pct}% BOUNCE</div>
//                       <div style={{ fontSize: 24, fontWeight: 800, color: pnl >= 0 ? C.emerald : C.rose, letterSpacing: "-0.04em", lineHeight: 1 }}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div>
//                       <div style={{ fontSize: 11, color: pnl >= 0 ? `${C.emerald}99` : `${C.rose}99`, marginTop: 6, fontWeight: 600 }}>{pnl >= 0 ? "+" : ""}{fmtCur(pnl)}</div>
//                       <div style={{ marginTop: 10, padding: "4px 6px", borderRadius: 6, background: `${C.bg}66`, border: `1px solid ${C.border}` }}>
//                         <div style={{ fontSize: 9, color: C.textMuted }}>@ ₹{fmt(nCmp * (1 + pct / 100))}</div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* Opportunity Cost + Math Check */}
//             {status && (
//               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, animation: "fadeInUp 0.45s ease both" }}>
//                 <div style={card()}>
//                   <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 5, letterSpacing: "0.08em" }}><AlertTriangle size={10} color={C.amber} /> OPPORTUNITY COST</div>
//                   <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.6, marginBottom: 10 }}>Position weight (10× portfolio):</div>
//                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
//                     <div><div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>CURRENT</div><div style={{ fontSize: 22, fontWeight: 800, color: C.amber }}>10.0%</div></div>
//                     {result && (
//                       <>
//                         <ArrowRight size={14} color={C.textDim} />
//                         <div><div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>AFTER</div><div style={{ fontSize: 22, fontWeight: 800, color: C.rose }}>{Math.min(100, ((status.totalInvested + result.capital) / (status.totalInvested * 10)) * 100).toFixed(1)}%</div></div>
//                       </>
//                     )}
//                   </div>
//                   {result && <div style={{ height: 4, background: C.surface3, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 2, width: `${Math.min(100, ((status.totalInvested + result.capital) / (status.totalInvested * 10)) * 100)}%`, background: C.amber, transition: "width 0.6s ease" }} /></div>}
//                 </div>

//                 <div onClick={() => setShowMath(!showMath)} style={{ ...card({ cursor: "pointer" }), borderColor: showMath ? C.skyMid : C.border, transition: "border-color 0.2s" }}>
//                   <div style={{ fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", color: showMath ? C.sky : C.textMuted, marginBottom: 10, letterSpacing: "0.08em" }}>
//                     <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Shield size={10} color={showMath ? C.sky : C.textMuted} /> MATH CHECK</div>
//                     <ChevronDown size={12} style={{ transform: showMath ? "rotate(180deg)" : "none", transition: "transform 0.25s" }} />
//                   </div>
//                   {!showMath
//                     ? <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.7 }}>Click to verify the underlying arithmetic of your rescue plan.</div>
//                     : result
//                       ? <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace", lineHeight: 1.9, animation: "fadeInUp 0.2s ease" }}>
//                           <div>OLD: {nQty} × ₹{fmt(nAvg)}</div>
//                           <div style={{ borderLeft: `2px solid ${C.border2}`, paddingLeft: 8, margin: "2px 0 2px 4px" }}>= ₹{fmt(nQty * nAvg)}</div>
//                           <div>NEW: {result.addQty.toFixed(0)} × ₹{fmt(nCmp)}</div>
//                           <div style={{ borderLeft: `2px solid ${C.border2}`, paddingLeft: 8, margin: "2px 0 2px 4px" }}>= {fmtCur(result.capital)}</div>
//                           <div style={{ color: C.emerald, fontWeight: 700, marginTop: 4 }}>∑ AVG = ₹{fmt(result.newAvg)} ✓</div>
//                         </div>
//                       : <div style={{ fontSize: 10, color: C.textMuted }}>Set recovery inputs to see breakdown.</div>}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* ══════════════════════════════════════════════════════════════════
//           Task 4: TradeRescue Roadmap Footer
//           — dimmed secondary action; MessageCircle icon
//           — links to external feedback portal (Tally/Canny)
//       ══════════════════════════════════════════════════════════════════ */}
//       <footer style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 32px", position: "relative", zIndex: 1 }}>
//         <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border2}, transparent)`, marginBottom: 24 }} />
//         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as any, gap: 14 }}>
//           {/* Branding blurb */}
//           <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//             <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${C.emerald}66, ${C.sky}66)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
//               <TrendingUp size={11} color="#000" strokeWidth={2.5} />
//             </div>
//             <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>Trade<span style={{ color: `${C.emerald}66` }}>Rescue</span></span>
//             <span style={{ fontSize: 10, color: C.textDim }}>· Pure client-side · No tracking · Open math</span>
//           </div>

//           {/* Roadmap CTA — dimmed, secondary */}
//           <a
//             href="https://forms.gle/pa6qQVPL7NDBTbrQ9"
//             target="_blank"
//             rel="noopener noreferrer"
//             onClick={() => track("roadmap_click", { source: "footer" })}
//             style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, fontWeight: 600, textDecoration: "none", letterSpacing: "0.04em", transition: "all 0.2s", minHeight: 44 }}
//             onMouseEnter={e => { Object.assign((e.currentTarget as any).style, { borderColor: C.purple, color: C.purple, background: `${C.purpleDim}` }); }}
//             onMouseLeave={e => { Object.assign((e.currentTarget as any).style, { borderColor: C.border, color: C.textMuted, background: "transparent" }); }}
//           >
//             <MessageCircle size={13} />
//             TRADERESCUE ROADMAP
//             <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: `${C.purple}22`, border: `1px solid ${C.purple}44`, color: C.purple }}>SUGGEST A FEATURE</span>
//           </a>
//         </div>
//       </footer>

//       {/* ── Global Styles ── */}
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');

//         @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
//         @keyframes slideIn   { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
//         @keyframes fadeInUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
//         @keyframes overlayIn { from{opacity:0} to{opacity:1} }
//         @keyframes modalIn   { from{opacity:0;transform:scale(0.93) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
//         @keyframes panelIn   { from{opacity:0;transform:scale(0.97) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
//         @keyframes pulseGlow { 0%,100%{box-shadow:0 0 0 0 rgba(16,217,138,0.28)} 50%{box-shadow:0 0 0 8px rgba(16,217,138,0)} }
//         @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.75)} }
//         @keyframes shimmer   { from{background-position:-200% center} to{background-position:200% center} }

//         * { box-sizing: border-box; }
//         input[type=number]::-webkit-inner-spin-button,
//         input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
//         input::placeholder, textarea::placeholder { color: ${C.textDim}; font-family: inherit; }
//         input:focus, textarea:focus { border-color: ${C.sky} !important; box-shadow: 0 0 0 2px ${C.skyDim} !important; outline: none; }
//         textarea { font-family: inherit; color: ${C.text}; background: ${C.surface3}; }
//         button { font-family: inherit; }

//         .tr-grid {
//           display: grid;
//           grid-template-columns: 330px 1fr;
//           gap: 20px;
//           width: 100%;
//         }
//         @media (max-width: 700px) {
//           .tr-grid {
//             grid-template-columns: 1fr !important;
//             width: 100% !important;
//             max-width: 100vw !important;
//             overflow: hidden;
//           }
//           input { font-size: 16px !important; }
//         }
//       `}</style>
//     </div>
//   );
// }



// 'use client';

// import { useState, useEffect, useRef } from "react";
// import {
//   TrendingDown, TrendingUp, Search, RefreshCw, Clock,
//   Shield, Target, DollarSign, BarChart2, AlertTriangle,
//   ArrowRight, Zap, ChevronDown, X, Info, Layers
// } from "lucide-react";

// const C = {
//   bg: "#06091a",
//   surface: "#0b1025",
//   surface2: "#0f1630",
//   surface3: "#131d3a",
//   surface4: "#172140",
//   border: "#1a2848",
//   border2: "#203059",
//   text: "#d6e4f7",
//   textMuted: "#5a7a9e",
//   textDim: "#2a3d5a",
//   emerald: "#10d98a",
//   emeraldDim: "#042d1c",
//   emeraldMid: "#065535",
//   rose: "#ff3d68",
//   roseDim: "#3d0018",
//   roseMid: "#5c0025",
//   amber: "#ffb830",
//   amberDim: "#3d2200",
//   sky: "#38c6f8",
//   skyDim: "#032840",
//   skyMid: "#054a74",
//   purple: "#a78bfa",
//   purpleDim: "#1e0d45",
// };

// const STOCKS: Record<string, any> = {
//   AAPL: { name: "Apple Inc.", price: 189.43, chg: -0.85 },
//   MSFT: { name: "Microsoft Corp.", price: 421.72, chg: 1.12 },
//   TSLA: { name: "Tesla Inc.", price: 178.21, chg: -3.42 },
//   NVDA: { name: "NVIDIA Corp.", price: 875.35, chg: 2.67 },
//   GOOGL: { name: "Alphabet Inc.", price: 172.86, chg: 0.44 },
//   AMZN: { name: "Amazon.com", price: 185.60, chg: -0.22 },
//   META: { name: "Meta Platforms", price: 538.92, chg: 1.85 },
//   NFLX: { name: "Netflix Inc.", price: 668.44, chg: 3.11 },
//   RELIANCE: { name: "Reliance Industries", price: 2847.50, chg: -0.65 },
//   TCS: { name: "Tata Consultancy", price: 3421.80, chg: 0.92 },
//   INFY: { name: "Infosys Ltd.", price: 1562.40, chg: -1.23 },
//   HDFCBANK: { name: "HDFC Bank", price: 1687.25, chg: 0.38 },
//   WIPRO: { name: "Wipro Ltd.", price: 478.60, chg: -0.74 },
//   BAJFINANCE: { name: "Bajaj Finance", price: 6823.40, chg: 1.56 },
//   TATAMOTORS: { name: "Tata Motors", price: 972.35, chg: -2.18 },
//   ICICIBANK: { name: "ICICI Bank", price: 1234.60, chg: 0.82 },
//   ADANIPORTS: { name: "Adani Ports", price: 1387.40, chg: -1.04 },
//   SUNPHARMA: { name: "Sun Pharma", price: 1847.20, chg: 0.63 },
// };

// const fmt = (n: any, dec: number = 2): string => {
//   const num = typeof n === 'string' ? parseFloat(n) : n;
//   if (num == null || isNaN(num)) return "—";
//   return new Intl.NumberFormat("en-IN", {
//     style: "decimal",
//     minimumFractionDigits: dec,
//     maximumFractionDigits: dec,
//   }).format(num);
// };

// const fmtCur = (n: any): string => {
//   const num = typeof n === 'string' ? parseFloat(n) : n;
//   if (num == null || isNaN(num)) return "—";
//   const abs = Math.abs(num);
//   const sign = num < 0 ? "-" : "";
//   if (abs >= 10000000) return sign + "₹" + (abs / 10000000).toFixed(2) + " Cr";
//   if (abs >= 100000) return sign + "₹" + (abs / 100000).toFixed(2) + " L";
//   return sign + "₹" + abs.toLocaleString("en-IN");
// };

// const calcStatus = (avg: number, qty: number, cmp: number) => ({
//   totalInvested: avg * qty,
//   currentValue: cmp * qty,
//   pnl: (cmp - avg) * qty,
//   pnlPct: ((cmp - avg) / avg) * 100,
//   gapPct: ((cmp - avg) / avg) * 100,
// });

// const calcTargetMode = (avg: number, qty: number, cmp: number, target: number) => {
//   if (target >= avg || target <= cmp || target <= 0) return null;
//   const addQty = Math.ceil((qty * (avg - target)) / (target - cmp));
//   const capital = addQty * cmp;
//   const newAvg = (avg * qty + capital) / (qty + addQty);
//   return { addQty, capital, newAvg, totalQty: qty + addQty };
// };

// const calcCapitalMode = (avg: number, qty: number, cmp: number, capital: number) => {
//   if (capital <= 0) return null;
//   const addQty = capital / cmp;
//   const newAvg = (avg * qty + capital) / (qty + addQty);
//   const distBreakeven = ((newAvg - cmp) / cmp) * 100;
//   return { addQty, capital, newAvg, totalQty: qty + addQty, distBreakeven };
// };

// function AnimNum({ value, prefix = "", suffix = "", dec = 2, color }: any) {
//   const [display, setDisplay] = useState(value);
//   const prev = useRef(value);
//   useEffect(() => {
//     const start = prev.current;
//     const end = value;
//     if (isNaN(end) || isNaN(start)) { setDisplay(end); return; }
//     const duration = 400;
//     const startTime = performance.now();
//     const tick = (now: number) => {
//       const elapsed = now - startTime;
//       const progress = Math.min(elapsed / duration, 1);
//       const eased = 1 - Math.pow(1 - progress, 3);
//       setDisplay(start + (end - start) * eased);
//       if (progress < 1) requestAnimationFrame(tick);
//       else prev.current = end;
//     };
//     requestAnimationFrame(tick);
//   }, [value]);
//   const n = typeof display === "number" ? display : value;
//   const str = isNaN(n) ? "—" : `${prefix}${fmt(n, dec)}${suffix}`;
//   return <span style={{ color }}>{str}</span>;
// }

// export default function TradeRescue() {
//   const [tickerInput, setTickerInput] = useState("");
//   const [ticker, setTicker] = useState("");
//   const [stockInfo, setStockInfo] = useState<any>(null);
//   const [cmp, setCmp] = useState("");
//   const [avgPrice, setAvgPrice] = useState("");
//   const [qty, setQty] = useState("");
//   const [fetching, setFetching] = useState(false);
//   const [suggestions, setSuggestions] = useState<any[]>([]);
//   const [showSug, setShowSug] = useState(false);
//   const [mode, setMode] = useState("target");
//   const [targetAvg, setTargetAvg] = useState("");
//   const [capitalAmt, setCapitalAmt] = useState("");
//   const [showMath, setShowMath] = useState(false);
//   const [history, setHistory] = useState<any[]>([]);
//   const [toast, setToast] = useState<any>(null);
//   const sugRef = useRef<any>(null);

//   useEffect(() => {
//     const r = localStorage.getItem("tr-history-v2");
//     if (r) setHistory(JSON.parse(r));
//   }, []);

//   useEffect(() => {
//     const handler = (e: any) => {
//       if (sugRef.current && !sugRef.current.contains(e.target)) setShowSug(false);
//     };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   const showToast = (msg: string, type = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3000);
//   };

//   const fetchPrice = async (sym: string) => {
//     if (!sym) return;
//     setFetching(true);
//     setShowSug(false);
//     try {
//       const response = await fetch(`/api/stock?symbol=${sym.toUpperCase()}`);
//       const data = await response.json();
//       if (data.error) {
//         showToast("Stock not found. Try adding .NS for NSE", "warn");
//       } else {
//         setCmp(data.price.toString());
//         setStockInfo({ name: data.name, price: data.price, chg: data.chg });
//         setTicker(data.symbol);
//         showToast(`Loaded ${data.symbol} live price`);
//       }
//     } catch (err) {
//       showToast("Failed to fetch market data", "warn");
//     } finally {
//       setFetching(false);
//     }
//   };

//   const onTickerChange = (val: string) => {
//     setTickerInput(val);
//     if (val.length >= 1) {
//       const f = Object.entries(STOCKS).filter(
//         ([k, v]) =>
//           k.startsWith(val.toUpperCase()) ||
//           v.name.toLowerCase().includes(val.toLowerCase())
//       ).slice(0, 6);
//       setSuggestions(f);
//       setShowSug(f.length > 0);
//     } else {
//       setSuggestions([]);
//       setShowSug(false);
//     }
//   };

//   const n = parseFloat;
//   const nAvg = n(avgPrice), nQty = n(qty), nCmp = n(cmp);
//   const nTarget = n(targetAvg), nCapital = n(capitalAmt);

//   const valid = !isNaN(nAvg) && !isNaN(nQty) && !isNaN(nCmp) && nAvg > 0 && nQty > 0 && nCmp > 0;
//   const status = valid ? calcStatus(nAvg, nQty, nCmp) : null;
//   const isLoss = status && status.pnlPct < 0;

//   const targetRes = valid && mode === "target" && !isNaN(nTarget) && nTarget > 0 ? calcTargetMode(nAvg, nQty, nCmp, nTarget) : null;
//   const capitalRes = valid && mode === "capital" && !isNaN(nCapital) && nCapital > 0 ? calcCapitalMode(nAvg, nQty, nCmp, nCapital) : null;
//   const result = mode === "target" ? targetRes : capitalRes;

//   const recovPct = result && valid ? Math.max(0, Math.min(100, ((nAvg - result.newAvg) / Math.max(nAvg - nCmp, 0.001)) * 100)) : 0;

//   const whatIfBounces = [3, 5, 10];
//   const whatIfData = whatIfBounces.map((pct) => {
//     if (!result) return { pct, pnlPct: 0, pnl: 0 };
//     const newP = nCmp * (1 + pct / 100);
//     const totalInv = result.newAvg * result.totalQty;
//     const curVal = newP * result.totalQty;
//     return { pct, pnl: curVal - totalInv, pnlPct: ((newP - result.newAvg) / result.newAvg) * 100 };
//   });

//   const saveHistory = async () => {
//     if (!valid || !ticker || !status) return showToast("Enter position details first", "warn");
//     const entry = {
//       ticker, name: stockInfo?.name || ticker,
//       avgPrice: nAvg, qty: nQty, cmp: nCmp,
//       newAvg: result?.newAvg?.toFixed(2) || null,
//       pnlPct: status.pnlPct.toFixed(2),
//       ts: Date.now(),
//     };
//     const updated = [entry, ...history.filter((h: any) => h.ticker !== ticker)].slice(0, 5);
//     setHistory(updated);
//     try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
//     showToast("Saved to recent calculations");
//   };

//   const loadItem = (item: any) => {
//     setTicker(item.ticker);
//     setTickerInput(item.ticker);
//     setStockInfo(STOCKS[item.ticker] || { name: item.name, price: item.cmp, chg: 0 });
//     setCmp(item.cmp.toString());
//     setAvgPrice(item.avgPrice.toString());
//     setQty(item.qty.toString());
//   };

//   const delHistory = async (e: any, idx: number) => {
//     e.stopPropagation();
//     const updated = history.filter((_, i) => i !== idx);
//     setHistory(updated);
//     try { localStorage.setItem("tr-history-v2", JSON.stringify(updated)); } catch {}
//   };

//   const card = (extra = {}) => ({
//     background: C.surface,
//     border: `1px solid ${C.border}`,
//     borderRadius: 14,
//     padding: "1.25rem" as any,
//     ...extra,
//   });

//   const inputStyle: any = {
//     width: "100%",
//     background: C.surface3,
//     border: `1px solid ${C.border2}`,
//     borderRadius: 8,
//     padding: "9px 12px",
//     color: C.text,
//     fontSize: 13,
//     outline: "none",
//     boxSizing: "border-box",
//     fontFamily: "inherit",
//   };

//   const labelStyle: any = {
//     display: "block",
//     fontSize: 10,
//     fontWeight: 700,
//     letterSpacing: "0.09em",
//     textTransform: "uppercase",
//     color: C.textMuted,
//     marginBottom: 5,
//   };

//   const chip = (active: boolean, color: string): any => ({
//     flex: 1, padding: "9px 4px", borderRadius: 8, cursor: "pointer",
//     border: `1px solid ${active ? color : C.border2}`,
//     background: active ? `${color}18` : C.surface3,
//     color: active ? color : C.textMuted,
//     fontSize: 12, fontWeight: 600,
//     display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
//     transition: "all 0.15s",
//   });

//   return (
//   //  <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Mono', 'IBM Plex Mono', 'Courier New', monospace", color: C.text }}>
// // Inside your return()
//       <div style={{ 
//         background: C.bg, 
//         minHeight: "100vh", 
//         fontFamily: "'DM Mono', monospace", 
//         color: C.text,
//         overflowX: "hidden", // Prevents horizontal stretching
//         position: "relative",
//         width: "100%" 
//       }}>

//       {toast && (
//         <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.type === "success" ? C.emeraldMid : C.amberDim, border: `1px solid ${toast.type === "success" ? C.emerald : C.amber}`, borderRadius: 10, padding: "10px 16px", color: toast.type === "success" ? C.emerald : C.amber, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, animation: "slideIn 0.2s ease" }}>
//           {toast.type === "success" ? <TrendingUp size={14} /> : <AlertTriangle size={14} />}
//           {toast.msg}
//         </div>
//       )}

//       <div style={{ padding: "0 24px", height: 56, background: `${C.surface}cc`, backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//           <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.emerald}cc, ${C.sky}cc)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
//             <TrendingUp size={16} color="#000" strokeWidth={2.5} />
//           </div>
//           <div>
//             <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em", color: C.text }}>Trade<span style={{ color: C.emerald }}>Rescue</span></div>
//             <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Recovery Calculator</div>
//           </div>
//         </div>
//         <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//           <div style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${C.border2}`, background: C.surface2, fontSize: 10, color: C.textMuted, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
//             <Shield size={10} color={C.emerald} /> NO DATA STORED EXTERNALLY
//           </div>
//         </div>
//       </div>

//       <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 40px" }}>
//         <div className="tr-grid">
//           <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
//             <div style={card()}>
//               <div style={{ ...labelStyle, marginBottom: 10, fontSize: 11, letterSpacing: "0.04em" }}><Search size={10} style={{ marginRight: 4 }} />FETCH LIVE PRICE</div>
//               <div style={{ position: "relative" }} ref={sugRef}>
//                 <div style={{ display: "flex", gap: 8 }}>
//                   <div style={{ position: "relative", flex: 1 }}>
//                     <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
//                     <input value={tickerInput} onChange={(e) => onTickerChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchPrice(tickerInput)} onFocus={() => tickerInput && setShowSug(suggestions.length > 0)} placeholder="RELIANCE.NS, INFOSYS.NS..." style={{ ...inputStyle, paddingLeft: 32 }} />
//                   </div>
//                   <button onClick={() => fetchPrice(tickerInput)} disabled={!tickerInput || fetching} style={{ padding: "0 16px", borderRadius: 8, background: !tickerInput || fetching ? C.surface3 : C.sky, color: !tickerInput || fetching ? C.textMuted : "#000", border: `1px solid ${!tickerInput || fetching ? C.border2 : C.sky}`, cursor: !tickerInput || fetching ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
//                     {fetching ? <RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <>FETCH</>}
//                   </button>
//                 </div>
//                 {showSug && (
//                   <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200, background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 10, overflow: "hidden", boxShadow: `0 8px 32px ${C.bg}cc` }}>
//                     {suggestions.map(([sym, info]: any) => (
//                       <div key={sym} onClick={() => { setTickerInput(sym); fetchPrice(sym); }} style={{ padding: "10px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }} onMouseEnter={(e) => e.currentTarget.style.background = C.surface4} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
//                         <div><div style={{ fontSize: 12, fontWeight: 700, color: C.sky }}>{sym}</div><div style={{ fontSize: 10, color: C.textMuted }}>{info.name}</div></div>
//                         <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 700 }}>₹{info.price.toFixed(2)}</div><div style={{ fontSize: 10, color: info.chg >= 0 ? C.emerald : C.rose }}>{info.chg >= 0 ? "▲" : "▼"} {Math.abs(info.chg)}%</div></div>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </div>
//               {stockInfo && ticker && (
//                 <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.skyDim}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//                   <div><div style={{ fontSize: 13, fontWeight: 700, color: C.sky }}>{ticker}</div><div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{stockInfo.name}</div></div>
//                   <div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.03em" }}>₹{parseFloat(cmp).toFixed(2)}</div><div style={{ fontSize: 10, color: stockInfo.chg >= 0 ? C.emerald : C.rose }}>{stockInfo.chg >= 0 ? "▲" : "▼"} {Math.abs(stockInfo.chg).toFixed(2)}% today</div></div>
//                 </div>
//               )}
//             </div>

//             <div style={card()}>
//               <div style={{ ...labelStyle, marginBottom: 12 }}><BarChart2 size={10} style={{ marginRight: 4 }} />YOUR POSITION</div>
//               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
//                 <div><label style={labelStyle}>Avg Buy Price</label><input value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} placeholder="₹ 250.00" style={inputStyle} type="number" /></div>
//                 <div><label style={labelStyle}>Quantity</label><input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="100 shares" style={inputStyle} type="number" /></div>
//               </div>
//               <div><label style={labelStyle}>CMP (override)</label><input value={cmp} onChange={(e) => setCmp(e.target.value)} placeholder="Current price" style={inputStyle} type="number" /></div>
//               {valid && status && (
//                 <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: isLoss ? `${C.roseDim}88` : `${C.emeraldDim}88`, border: `1px solid ${isLoss ? C.roseMid : C.emeraldMid}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//                   <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{isLoss ? <TrendingDown size={13} color={C.rose} /> : <TrendingUp size={13} color={C.emerald} />}<span style={{ fontSize: 11, color: isLoss ? C.rose : C.emerald, fontWeight: 700 }}>{isLoss ? "LOSING POSITION" : "GAINING POSITION"}</span></div>
//                   <span style={{ fontSize: 13, fontWeight: 700, color: isLoss ? C.rose : C.emerald }}>{status.pnlPct >= 0 ? "+" : ""}{status.pnlPct.toFixed(2)}%</span>
//                 </div>
//               )}
//             </div>

//             <div style={card()}>
//               <div style={{ ...labelStyle, marginBottom: 12 }}><Zap size={10} style={{ marginRight: 4 }} />RECOVERY MODE</div>
//               <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
//                 <button onClick={() => setMode("target")} style={chip(mode === "target", C.emerald)}><Target size={12} /> TARGET AVG</button>
//                 <button onClick={() => setMode("capital")} style={chip(mode === "capital", C.sky)}><DollarSign size={12} /> CAPITAL DEPLOY</button>
//               </div>
//               {mode === "target" ? (
//                 <div><label style={labelStyle}>Desired Average Price (₹)</label><input value={targetAvg} onChange={(e) => setTargetAvg(e.target.value)} placeholder="Target avg" style={inputStyle} type="number" /></div>
//               ) : (
//                 <div><label style={labelStyle}>Additional Capital (₹)</label><input value={capitalAmt} onChange={(e) => setCapitalAmt(e.target.value)} placeholder="e.g. ₹50,000" style={inputStyle} type="number" /></div>
//               )}
//             </div>

//             {history.length > 0 && (
//               <div style={card()}>
//                 <div style={{ ...labelStyle, marginBottom: 10 }}><Clock size={10} style={{ marginRight: 4 }} />RECENT CALCULATIONS</div>
//                 {history.map((item: any, i: number) => (
//                   <div key={i} onClick={() => loadItem(item)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: i < history.length - 1 ? 6 : 0, background: C.surface2, border: `1px solid ${C.border}` }}>
//                     <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
//                       <div style={{ width: 30, height: 30, borderRadius: 7, background: parseFloat(item.pnlPct) < 0 ? C.roseDim : C.emeraldDim, border: `1px solid ${parseFloat(item.pnlPct) < 0 ? C.roseMid : C.emeraldMid}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald }}>{item.ticker.slice(0, 4)}</div>
//                       <div><div style={{ fontSize: 11, fontWeight: 700 }}>{item.ticker}</div><div style={{ fontSize: 9, color: C.textMuted }}>₹{item.avgPrice} → {item.newAvg ? `₹${item.newAvg}` : "—"}</div></div>
//                     </div>
//                     <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 10, fontWeight: 700, color: parseFloat(item.pnlPct) < 0 ? C.rose : C.emerald }}>{parseFloat(item.pnlPct) > 0 ? "+" : ""}{item.pnlPct}%</div><div onClick={(e) => delHistory(e, i)} style={{ color: C.textDim }}><X size={11} /></div></div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
//             {/* {status ? (
//               <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
//                 {[
//                   { label: "TOTAL INVESTED", val: status.totalInvested, color: C.text },
//                   { label: "CURRENT VALUE", val: status.currentValue, color: C.text },
//                   { label: "UNREALIZED P&L", val: status.pnl, color: status.pnl >= 0 ? C.emerald : C.rose },
//                   { label: "P&L %", val: status.pnlPct, color: status.pnlPct >= 0 ? C.emerald : C.rose },
//                 ].map((item, i) => (
//                   <div key={i} style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px" }}>
//                     <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, marginBottom: 8 }}>{item.label}</div>
//                     <div style={{ fontSize: 17, fontWeight: 700, color: item.color }}>
//                       <AnimNum value={item.val} prefix={i < 3 ? "₹" : ""} suffix={i === 3 ? "%" : ""} color={item.color} />
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <div style={{ ...card(), minHeight: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}><Layers size={24} color={C.textDim} /><div style={{ fontSize: 13, color: C.textMuted }}>Enter position details to analyze</div></div>
//             )} */}

//             {status ? (
//               <div style={{ 
//                 display: "grid", 
//                 // This magic line ensures boxes stack on mobile but spread out on desktop
//                 gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", 
//                 gap: "10px",
//                 width: "100%",
//                 boxSizing: "border-box"
//               }}>
//                 {[
//                   { label: "TOTAL INVESTED", val: status.totalInvested, prefix: "₹", color: C.text },
//                   { label: "CURRENT VALUE", val: status.currentValue, prefix: "₹", color: C.text },
//                   { label: "UNREALIZED P&L", val: status.pnl, prefix: status.pnl >= 0 ? "₹" : "-₹", color: status.pnl >= 0 ? C.emerald : C.rose },
//                   { label: "P&L %", val: status.pnlPct, prefix: "", suffix: "%", color: status.pnlPct >= 0 ? C.emerald : C.rose },
//                 ].map((item, i) => (
//                   <div key={i} style={{
//                     background: C.surface,
//                     borderRadius: 12,
//                     border: `1px solid ${C.border}`,
//                     padding: "12px",
//                     display: "flex",
//                     flexDirection: "column",
//                     justifyContent: "center",
//                     minWidth: "0", // Critical: allows the box to shrink if needed
//                     overflow: "hidden"
//                   }}>
//                     <div style={{ 
//                       fontSize: 9, 
//                       color: C.textMuted, 
//                       fontWeight: 700, 
//                       letterSpacing: "0.05em", 
//                       marginBottom: 4,
//                       whiteSpace: "nowrap" // Prevents label from breaking layout
//                     }}>
//                       {item.label}
//                     </div>
//                     <div style={{ 
//                       fontSize: 16, 
//                       fontWeight: 700, 
//                       color: item.color,
//                       letterSpacing: "-0.02em",
//                       overflow: "hidden",
//                       textOverflow: "ellipsis" // If number is huge, it adds "..." instead of stretching
//                     }}>
//                       <AnimNum 
//                         value={Math.abs(item.val)} 
//                         prefix={item.prefix} 
//                         suffix={item.suffix || ""} 
//                         color={item.color} 
//                       />
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <div style={{ 
//                 background: C.surface, 
//                 border: `1px solid ${C.border}`, 
//                 borderRadius: 14, 
//                 padding: "2rem", 
//                 textAlign: "center" 
//               }}>
//                 <Layers size={24} color={C.textDim} style={{ margin: "0 auto 10px" }} />
//                 <div style={{ fontSize: 13, color: C.textMuted }}>Enter position details to analyze</div>
//               </div>
//             )}

//             {result ? (
//               <div style={{ background: `linear-gradient(135deg, ${C.surface2}f0, ${C.surface3}d0)`, border: `1px solid ${C.emeraldMid}`, borderRadius: 16, padding: "1.5rem", position: "relative", overflow: "hidden" }}>
//                 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
//                   <div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>{mode === "target" ? "TARGET RECOVERY" : "DEPLOYMENT PLAN"}</div><div style={{ fontSize: 13, color: C.emerald, fontWeight: 600 }}>{mode === "target" ? `Buy ${result.addQty} shares at ₹${fmt(nCmp)}` : `Deploy ${fmtCur(nCapital)} at CMP`}</div></div>
//                   <div style={{ padding: "5px 12px", borderRadius: 20, background: `${C.emeraldMid}88`, border: `1px solid ${C.emeraldMid}`, fontSize: 10, color: C.emerald }}>{recovPct.toFixed(0)}% CLOSED</div>
//                 </div>
//                 <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
//                   {[
//                     { label: "SHARES TO BUY", val: `${result.addQty.toFixed(0)}` },
//                     { label: "CAPITAL NEEDED", val: fmtCur(result.capital) },
//                     { label: "NEW AVERAGE", val: `₹${fmt(result.newAvg)}`, highlight: true },
//                     { label: "TOTAL SHARES", val: `${result.totalQty.toFixed(0)}` },
//                     { label: "OLD AVERAGE", val: `₹${fmt(nAvg)}` },
//                     { label: "REDUCTION", val: `↓ ₹${fmt(nAvg - result.newAvg)}` },
//                   ].map((item, i) => (
//                     <div key={i} style={{ background: `${C.bg}80`, borderRadius: 10, padding: "12px", border: `1px solid ${item.highlight ? C.emeraldMid : C.border}` }}>
//                       <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6 }}>{item.label}</div>
//                       <div style={{ fontSize: 14, fontWeight: 700, color: item.highlight ? C.emerald : C.text }}>{item.val}</div>
//                     </div>
//                   ))}
//                 </div>
//                 <div>
//                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}><span style={{ fontSize: 9, color: C.textMuted }}>RECOVERY PROGRESS</span><span style={{ fontSize: 9, color: C.emerald }}>{recovPct.toFixed(1)}% Gap Reduced</span></div>
//                    <div style={{ height: 10, background: C.surface3, borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${recovPct}%`, background: `linear-gradient(90deg, ${C.rose}, ${C.amber}, ${C.emerald})` }} /></div>
//                 </div>
//                 <button onClick={saveHistory} style={{ marginTop: 16, width: "100%", padding: "10px", borderRadius: 9, background: `${C.emeraldMid}55`, border: `1px solid ${C.emeraldMid}`, color: C.emerald, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>SAVE TO RECENT</button>
//               </div>
//             ) : valid && status && (
//               <div style={{ ...card({ borderStyle: "dashed" }), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 6 }}><Target size={22} color={C.textDim} /><div style={{ fontSize: 12, color: C.textMuted }}>Enter recovery inputs</div></div>
//             )}

//             {result && (
//               <div style={card()}>
//                 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
//                   <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}><Zap size={10} color={C.amber} /> WHAT-IF SCENARIOS</div>
//                   <div style={{ fontSize: 9, color: C.textDim }}>If CMP bounces after average</div>
//                 </div>
//                 <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
//                   {whatIfData.map(({ pct, pnl, pnlPct }) => (
//                     <div key={pct} style={{ borderRadius: 10, padding: "14px 10px", textAlign: "center", background: pnl >= 0 ? `${C.emeraldDim}88` : `${C.roseDim}88`, border: `1px solid ${pnl >= 0 ? C.emeraldMid : C.roseMid}` }}>
//                       <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, marginBottom: 8 }}>+{pct}% BOUNCE</div>
//                       <div style={{ fontSize: 20, fontWeight: 700, color: pnl >= 0 ? C.emerald : C.rose }}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div>
//                       <div style={{ fontSize: 10, color: pnl >= 0 ? `${C.emerald}99` : `${C.rose}99`, marginTop: 4 }}>{fmtCur(pnl)}</div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {status && (
//               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
//                 <div style={card()}>
//                   <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, marginBottom: 12 }}><AlertTriangle size={10} color={C.amber} /> OPPORTUNITY COST</div>
//                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
//                     <div><div style={{ fontSize: 9, color: C.textMuted }}>CURRENT</div><div style={{ fontSize: 20, fontWeight: 700, color: C.amber }}>10.0%</div></div>
//                     {result && <><ArrowRight size={14} color={C.textDim} /><div><div style={{ fontSize: 9, color: C.textMuted }}>AFTER</div><div style={{ fontSize: 20, fontWeight: 700, color: C.rose }}>{Math.min(100, ((status.totalInvested + result.capital) / (status.totalInvested * 10)) * 100).toFixed(1)}%</div></div></>}
//                   </div>
//                 </div>
//                 <div onClick={() => setShowMath(!showMath)} style={{ ...card({ cursor: "pointer" }), borderColor: showMath ? C.sky : C.border }}>
//                   <div style={{ fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", color: showMath ? C.sky : C.textMuted }}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><Shield size={10} /> MATH CHECK</div><ChevronDown size={12} style={{ transform: showMath ? "rotate(180deg)" : "none" }} /></div>
//                   {!showMath ? <div style={{ fontSize: 10, color: C.textMuted, marginTop: 10 }}>Verify the underlying breakdown.</div> : result && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 10, fontFamily: "monospace" }}><div>OLD: {nQty} @ ₹{fmt(nAvg)}</div><div>NEW: {result.addQty} @ ₹{fmt(nCmp)}</div><div style={{ color: C.emerald }}>∑ AVG: ₹{fmt(result.newAvg)} ✓</div></div>}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
//         @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
//         @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
//         .tr-grid { display: grid; grid-template-columns: 330px 1fr; gap: 20px; width: 100%;}
//         @media (max-width: 700px) { 
//           .tr-grid { 
//             grid-template-columns: 1fr !important; 
//             width: 100% !important;
//             max-width: 100vw !important; /* Forces the box to stay inside the screen */
//             overflow: hidden;
//           }
          
//           input {
//             font-size: 16px !important; 
//           }
//         }
//       `}</style>
//     </div>
//             //@media (max-width: 700px) { .tr-grid { grid-template-columns: 1fr; } }

//   );
// }
