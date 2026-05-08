import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) return NextResponse.json([]);

  // Yahoo Finance suggestion endpoint is great for finding Indian tickers
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${q}&quotesCount=6&newsCount=0&listsCount=0`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 } // Cache results for 1 hour
    });
    const data = await res.json();

    // Filter for Indian stocks (ending in .NS or .BO) and map to a clean format
    const suggestions = data.quotes
      .filter((s: any) => s.symbol.endsWith('.NS') || s.symbol.endsWith('.BO'))
      .map((s: any) => ({
        symbol: s.symbol,
        name: s.shortname || s.longname,
        exch: s.exchDisp
      }));

    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json([]);
  }
}