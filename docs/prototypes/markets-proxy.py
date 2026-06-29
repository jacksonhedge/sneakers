#!/usr/bin/env python3
"""
Tiny local proxy for the Sneakers markets grid prototype.

Serves the repo statically AND exposes GET /api/markets, which fetches live
short-interval crypto Up/Down markets from BOTH sites:
  - Polymarket (public Gamma API)  — BTC/ETH/SOL/XRP/etc. 5m + 15m
  - Kalshi (public trade-api)      — BTC/ETH/SOL/XRP 15m  (KX*15M series)
...normalizes them to one shape (with a `venue`), and returns JSON (with CORS)
so the static grid page can show REAL, live data per site.

Run:  python3 docs/prototypes/markets-proxy.py
Open: http://127.0.0.1:8765/docs/prototypes/sneakers-markets-grid.html

Throwaway prototype proxy — the production path is the Plan 2 worker.
"""
import json, time, os, urllib.request
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORT = 8765
UA = {"User-Agent": "Mozilla/5.0"}

GAMMA = ("https://gamma-api.polymarket.com/events"
         "?closed=false&limit=500&order=endDate&ascending=true&tag_slug=crypto")
INTERVAL_SEC = {"5m": 300, "10m": 600, "15m": 900, "1h": 3600}

# Kalshi 15-minute Up/Down series → asset
KALSHI_15M = {"KXBTC15M": "BTC", "KXETH15M": "ETH", "KXSOL15M": "SOL", "KXXRP15M": "XRP"}
KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2"


def to_ms(s):
    if not s:
        return None
    try:
        return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:
        return None


def fetch_polymarket():
    """Returns (markets, server_now_ms). server_now from Polymarket's HTTP Date header."""
    req = urllib.request.Request(GAMMA, headers=UA)
    resp = urllib.request.urlopen(req, timeout=12)
    server_now = None
    try:
        from email.utils import parsedate_to_datetime
        d = resp.headers.get("Date")
        if d:
            server_now = int(parsedate_to_datetime(d).timestamp() * 1000)
    except Exception:
        server_now = None
    data = json.load(resp)
    out = []
    for e in data:
        slug = e.get("slug", "")
        if "-updown-" not in slug:
            continue
        parts = slug.split("-")              # asset-updown-5m-<ts>
        asset = parts[0].upper()
        interval = next((p for p in parts if p in INTERVAL_SEC), None)
        if not interval:
            continue
        for m in e.get("markets", []):
            try:
                px = json.loads(m.get("outcomePrices") or "[]")
            except Exception:
                px = []
            if len(px) < 2:
                continue
            em = to_ms(m.get("endDate") or e.get("endDate"))
            if em is None:
                continue
            out.append({
                "venue": "polymarket", "asset": asset, "interval": interval,
                "intervalSec": INTERVAL_SEC[interval], "title": e.get("title", ""),
                "id": slug, "startDate": m.get("startDate") or e.get("startDate"),
                "endDate": m.get("endDate") or e.get("endDate"), "endMs": em,
                "up": float(px[0]), "down": float(px[1]), "priceKnown": True,
            })
    return out, server_now


def _kalshi_yes(m):
    """(up_fraction, price_known) — None when the market has no book/last trade."""
    yb, ya, lp = m.get("yes_bid"), m.get("yes_ask"), m.get("last_price")
    if yb is not None and ya is not None:
        return (yb + ya) / 200.0, True    # cents → fraction
    if lp is not None:
        return lp / 100.0, True
    return None, False                    # genuinely no market yet


def fetch_kalshi():
    """Returns markets for the KX*15M Up/Down series (best-effort per series)."""
    out = []
    for series, asset in KALSHI_15M.items():
        try:
            url = f"{KALSHI_BASE}/markets?series_ticker={series}&status=open&limit=5"
            data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=10))
        except Exception:
            continue
        for m in data.get("markets", []):
            em = to_ms(m.get("close_time"))
            if em is None:
                continue
            up, known = _kalshi_yes(m)
            out.append({
                "venue": "kalshi", "asset": asset, "interval": "15m",
                "intervalSec": 900, "title": m.get("title", ""), "id": m.get("ticker"),
                "startDate": m.get("open_time"), "endDate": m.get("close_time"),
                "endMs": em, "up": up, "down": (None if up is None else 1.0 - up),
                "priceKnown": known,
            })
    return out


def build_feed():
    pm, server_now = fetch_polymarket()
    try:
        ks = fetch_kalshi()
    except Exception:
        ks = []
    markets = pm + ks
    if server_now:
        # live or imminent: closing within next 30 min (small grace for just-settling)
        markets = [m for m in markets if -15_000 <= (m["endMs"] - server_now) <= 1_800_000]
    markets.sort(key=lambda m: m["endMs"])
    return markets[:60], server_now


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/markets"):
            try:
                markets, server_now = build_feed()
                body = json.dumps({
                    "fetchedAt": int(time.time() * 1000),
                    "now": server_now or int(time.time() * 1000),
                    "sources": ["polymarket", "kalshi"],
                    "markets": markets,
                }).encode()
                self.send_response(200)
            except Exception as ex:
                body = json.dumps({"error": str(ex)}).encode()
                self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    os.chdir(REPO_ROOT)
    print(f"Sneakers markets proxy on http://127.0.0.1:{PORT}")
    print(f"  grid:  http://127.0.0.1:{PORT}/docs/prototypes/sneakers-markets-grid.html")
    print(f"  feed:  http://127.0.0.1:{PORT}/api/markets  (Polymarket + Kalshi)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
