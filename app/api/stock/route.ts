import { NextResponse } from 'next/server';

// Robust Fallback using a public finance API (Yahoo/Google mirror)
async function fetchFallback(sym: string) {
  try {
    // We use the Yahoo Finance Query API as it's more stable for cloud IPs
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}.NS?interval=1d&range=1d`, {
      cache: 'no-store'
    });
    const data = await res.json();
    const meta = data.chart.result[0].meta;
    
    if (meta) {
      return NextResponse.json({
        price: meta.regularMarketPrice,
        name: sym,
        chg: meta.regularMarketChangePercent || 0,
        symbol: sym
      });
    }
    throw new Error('Fallback failed');
  } catch (error) {
    return NextResponse.json({ error: 'Market data unavailable in production' }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 });

  const cleanSymbol = symbol.trim().toUpperCase().split('.')[0];

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/',
      'Connection': 'keep-alive'
    };

    // Step 1: Handshake - Get Cookies
    // On Vercel, we must fetch the homepage first to establish a session
    const sessionRes = await fetch("https://www.nseindia.com/", { 
      headers,
      cache: 'no-store' // Critical: Prevent Vercel from caching the session
    });

    const setCookie = sessionRes.headers.get('set-cookie');
    if (!setCookie) throw new Error("Cloud IP Blocked by NSE");

    // Extract only the necessary parts of the cookie
    const cookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');

    // Step 2: API Call with valid Session Cookies
    const quoteUrl = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(cleanSymbol)}`;
    const response = await fetch(quoteUrl, {
      headers: { 
        ...headers, 
        'Cookie': cookies 
      },
      cache: 'no-store'
    });

    if (!response.ok) throw new Error("NSE API rejected request");

    const data = await response.json();

    if (data && data.priceInfo) {
      return NextResponse.json({
        price: data.priceInfo.lastPrice,
        name: data.info.companyName,
        chg: data.priceInfo.pChange,
        symbol: data.info.symbol
      });
    }

    return await fetchFallback(cleanSymbol);

  } catch (error: any) {
    console.error("Vercel Production Error:", error?.message);
    // Automatically trigger fallback if NSE blocks the Cloud IP
    return await fetchFallback(cleanSymbol);
  }
}
// import { NextResponse } from 'next/server';

// // Fallback logic in case NSE is down or blocking the IP
// async function fetchFallback(sym: string) {
//   try {
//     const res = await fetch(`https://api.stockmarketapi.in/v1/quote?symbol=${sym}`, {
//       next: { revalidate: 60 }
//     });
//     const data = await res.json();
//     if (data && data.price) {
//       return NextResponse.json({
//         price: data.price,
//         name: sym,
//         chg: data.change_percent || 0,
//         symbol: sym
//       });
//     }
//     throw new Error('Fallback failed');
//   } catch {
//     return NextResponse.json({ error: 'All market sources failed' }, { status: 500 });
//   }
// }

// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url);
//   const symbol = searchParams.get('symbol');

//   if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 });

//   const cleanSymbol = symbol.trim().toUpperCase().split('.')[0];

//   try {
//     const headers = {
//       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//       'Accept-Language': 'en-US,en;q=0.9',
//       'Referer': 'https://www.nseindia.com/'
//     };

//     // Step 1: Initialize session
//     const sessionRes = await fetch("https://www.nseindia.com/", { headers });
//     const setCookie = sessionRes.headers.get('set-cookie');

//     if (!setCookie) throw new Error("Session init failed");

//     // Step 2: Fetch actual data
//     const quoteUrl = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(cleanSymbol)}`;
//     const response = await fetch(quoteUrl, {
//       headers: { ...headers, 'Cookie': setCookie }
//     });

//     const data = await response.json();

//     if (data && data.priceInfo) {
//       return NextResponse.json({
//         price: data.priceInfo.lastPrice,
//         name: data.info.companyName,
//         chg: data.priceInfo.pChange,
//         symbol: data.info.symbol
//       });
//     }

//     return await fetchFallback(cleanSymbol);

//   } catch (error: any) {
//     console.error("NSE Fetch Error:", error?.message || "Unknown Error");
//     return await fetchFallback(cleanSymbol);
//   }
// }