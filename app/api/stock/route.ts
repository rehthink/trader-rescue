import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 });

  const cleanSymbol = symbol.trim().toUpperCase();

  try {
    // 1. Define the headers to look like a real Indian browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': 'https://www.nseindia.com/'
    };

    // 2. STEP 1: Handshake with NSE Homepage to get Cookies
    const sessionResponse = await fetch("https://www.nseindia.com/", { headers });
    const setCookie = sessionResponse.headers.get('set-cookie');

    if (!setCookie) throw new Error("Could not initialize NSE session");

    // 3. STEP 2: Use that Cookie to fetch the actual Stock Quote
    const quoteUrl = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(cleanSymbol)}`;
    
    const response = await fetch(quoteUrl, {
      headers: {
        ...headers,
        'Cookie': setCookie,
      }
    });

    const data = await response.json();

    // 4. Map NSE's specific data format to your TradeRescue format
    if (data && data.priceInfo) {
      return NextResponse.json({
        price: data.priceInfo.lastPrice,
        name: data.info.companyName,
        chg: data.priceInfo.pChange,
        symbol: data.info.symbol
      });
    }

    return NextResponse.json({ error: 'Stock not found on NSE' }, { status: 404 });

  } catch (error) {
    console.error("NSE Fetch Error:", error.message);
    // If NSE blocks us, try one last simple public mirror
    return await fetchFallback(cleanSymbol);
  }
}

// Emergency Fallback to a public mirror if NSE Handshake fails
async function fetchFallback(sym: string) {
  try {
    const res = await fetch(`https://api.stockmarketapi.in/v1/quote?symbol=${sym}`);
    const data = await res.json();
    if (data && data.price) return NextResponse.json(data);
    throw new Error();
  } catch {
    return NextResponse.json({ error: 'All market sources failed' }, { status: 500 });
  }
}