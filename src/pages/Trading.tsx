import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatsCard } from '@/components/ui/StatsCard';
import { TradeTracker } from '@/components/trading/TradeTracker';
import { Watchlist } from '@/components/trading/Watchlist';
import { SymbolChart } from '@/components/trading/SymbolChart';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  DollarSign,
  Eye,
  Minus,
  Plus,
  Radio,
  Search,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  useIBKRAuthStatus,
  useIBKRTickle,
  useIBKRAccounts,
  useIBKRPositions,
  useIBKRPnL,
  useIBKROrders,
  useIBKRTrades,
  useIBKRContractSearch,
  useIBKRPlaceOrder,
  useIBKRCancelOrder,
  useIBKRPortfolioSummary,
  useIBKRSnapshot,
} from '@/hooks/useIBKR';
import { useSymbolSearch } from '@/hooks/useSymbolSearch';
import { useOpenTrades } from '@/hooks/useOpenTrades';
import { fetchYahooQuote } from '@/services/yahooFinanceApi';
import { riskPreview } from '@/lib/riskPreview';
import { stopFromPct, targetFromR, qtyFromRisk } from '@/lib/entryMath';

/* ─── helpers ─── */
function fmtCurrency(v: number | null | undefined, fallback = '—') {
  if (v == null) return fallback;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}
function pnlClass(v: number | null | undefined) {
  if (v == null || v === 0) return 'text-muted-foreground';
  return v > 0 ? 'text-trading-buy' : 'text-trading-sell';
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Read the user's saved Risk Parameters (set in My Trading Plan) so the
// Order Ticket preview can show account-relative risk. Read-only; optional.
function readRiskParams(): { account: number; riskPct: number } | null {
  try {
    const r = localStorage.getItem('tp-risk-v1');
    if (!r) return null;
    const p = JSON.parse(r);
    if (typeof p?.account === 'number' && typeof p?.riskPct === 'number') {
      return { account: p.account, riskPct: p.riskPct };
    }
    return null;
  } catch { return null; }
}

/* ─── Connection Status ─── */
function ConnectionStatus() {
  const { data, isLoading } = useIBKRAuthStatus();
  useIBKRTickle();

  if (isLoading) return <Skeleton className="h-7 w-36 rounded-full" />;

  const connected = data?.authenticated === true;
  const notConfigured = data === null; // gateway returned error

  if (notConfigured) {
    return (
      <div className="flex items-center gap-2">
        <span className="pulse-live bg-muted-foreground" />
        <span className="text-sm text-muted-foreground">Gateway Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`pulse-live ${connected ? 'bg-trading-buy' : 'bg-trading-sell'}`} />
      <span className="text-sm font-medium">
        {connected ? 'Connected' : 'Not Authenticated'}
      </span>
    </div>
  );
}

/* ─── Account Stats Row ─── */
function AccountStats({ accountId }: { accountId: string }) {
  const { data: pnl } = useIBKRPnL();
  const { data: summary } = useIBKRPortfolioSummary(accountId);

  const dailyPnl = pnl?.upnl?.dpl ?? null;
  const unrealizedPnl = pnl?.upnl?.upl ?? null;
  const nlv = summary?.totalcashvalue?.amount ?? summary?.netliquidation?.amount ?? null;
  const buyingPower = summary?.buyingpower?.amount ?? null;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
      <StatsCard
        title="Net Liquidation"
        value={fmtCurrency(nlv)}
        icon={<Briefcase className="h-4 w-4" />}
        valueClassName="font-mono-num"
      />
      <StatsCard
        title="Daily P&L"
        value={fmtCurrency(dailyPnl)}
        icon={<TrendingUp className="h-4 w-4" />}
        valueClassName={`font-mono-num ${pnlClass(dailyPnl)}`}
        trend={dailyPnl != null && dailyPnl !== 0 ? (dailyPnl > 0 ? 1 : -1) : undefined}
      />
      <StatsCard
        title="Unrealized P&L"
        value={fmtCurrency(unrealizedPnl)}
        icon={<Activity className="h-4 w-4" />}
        valueClassName={`font-mono-num ${pnlClass(unrealizedPnl)}`}
        trend={unrealizedPnl != null && unrealizedPnl !== 0 ? (unrealizedPnl > 0 ? 1 : -1) : undefined}
      />
      <StatsCard
        title="Buying Power"
        value={fmtCurrency(buyingPower)}
        icon={<DollarSign className="h-4 w-4" />}
        valueClassName="font-mono-num"
      />
    </div>
  );
}

/* ─── Positions Table ─── */
function PositionsTable({ accountId }: { accountId: string }) {
  const { data: positions, isLoading } = useIBKRPositions(accountId);

  if (isLoading) return <Skeleton className="h-48" />;
  if (!positions || (Array.isArray(positions) && positions.length === 0)) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
        <Briefcase className="h-8 w-8 opacity-40" />
        <p className="text-sm">No open positions</p>
      </div>
    );
  }

  const positionList = Array.isArray(positions) ? positions : [];

  return (
    <div className="trading-table overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Mkt Price</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Mkt Value</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Avg Cost</TableHead>
            <TableHead className="text-right">Unrealized P&L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positionList.map((pos: any, i: number) => {
            const uPnl = Number(pos.unrealizedPnl ?? 0);
            return (
              <TableRow key={i}>
                <TableCell className="font-semibold">{pos.contractDesc || pos.ticker || 'N/A'}</TableCell>
                <TableCell className="text-muted-foreground text-xs hidden md:table-cell">{pos.fullName || pos.name || ''}</TableCell>
                <TableCell className="text-right font-mono-num">{pos.position ?? pos.pos ?? 0}</TableCell>
                <TableCell className="text-right font-mono-num">{fmtCurrency(pos.mktPrice)}</TableCell>
                <TableCell className="text-right font-mono-num hidden sm:table-cell">{fmtCurrency(pos.mktValue)}</TableCell>
                <TableCell className="text-right font-mono-num hidden sm:table-cell">{fmtCurrency(pos.avgCost)}</TableCell>
                <TableCell className={`text-right font-mono-num font-medium ${pnlClass(uPnl)}`}>
                  <span className="inline-flex items-center gap-1">
                    {uPnl > 0 ? <ArrowUpRight className="h-3 w-3" /> : uPnl < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                    {fmtCurrency(uPnl)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Orders Table ─── */
function OrdersTable({ accountId }: { accountId: string }) {
  const { data, isLoading } = useIBKROrders();
  const cancelOrder = useIBKRCancelOrder();

  if (isLoading) return <Skeleton className="h-48" />;
  const orders = data?.orders || (Array.isArray(data) ? data : []);
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
        <Zap className="h-8 w-8 opacity-40" />
        <p className="text-sm">No active orders</p>
      </div>
    );
  }

  const handleCancel = (orderId: string) => {
    if (!accountId) return;
    cancelOrder.mutate(
      { accountId, orderId },
      {
        onSuccess: () => toast.success('Order cancelled'),
        onError: (err) => toast.error(`Cancel failed: ${err.message}`),
      }
    );
  };

  return (
    <div className="trading-table overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order: any, i: number) => (
            <TableRow key={i}>
              <TableCell className="font-semibold">{order.ticker || order.symbol || 'N/A'}</TableCell>
              <TableCell>
                <Badge className={order.side === 'BUY' ? 'bg-trading-buy/15 text-trading-buy border-trading-buy/30' : 'bg-trading-sell/15 text-trading-sell border-trading-sell/30'} variant="outline">
                  {order.side}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{order.orderType || order.order_type || 'N/A'}</TableCell>
              <TableCell className="text-right font-mono-num">{order.totalSize ?? order.quantity ?? 0}</TableCell>
              <TableCell className="text-right font-mono-num">{order.price ? fmtCurrency(Number(order.price)) : 'MKT'}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">{order.status || 'Unknown'}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-trading-sell hover:bg-trading-sell/10"
                  onClick={() => handleCancel(order.orderId || order.order_id)}
                  disabled={cancelOrder.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Trades Table ─── */
function TradesTable() {
  const { data, isLoading } = useIBKRTrades();

  if (isLoading) return <Skeleton className="h-48" />;
  const trades = Array.isArray(data) ? data : [];
  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
        <Radio className="h-8 w-8 opacity-40" />
        <p className="text-sm">No recent trades</p>
      </div>
    );
  }

  return (
    <div className="trading-table overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Commission</TableHead>
            <TableHead className="hidden md:table-cell">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade: any, i: number) => {
            const isBuy = trade.side === 'BOT' || trade.side === 'BUY';
            return (
              <TableRow key={i}>
                <TableCell className="font-semibold">{trade.symbol || trade.ticker || 'N/A'}</TableCell>
                <TableCell>
                  <Badge className={isBuy ? 'bg-trading-buy/15 text-trading-buy border-trading-buy/30' : 'bg-trading-sell/15 text-trading-sell border-trading-sell/30'} variant="outline">
                    {trade.side}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono-num">{trade.size ?? trade.quantity ?? 0}</TableCell>
                <TableCell className="text-right font-mono-num">{fmtCurrency(Number(trade.price ?? 0))}</TableCell>
                <TableCell className="text-right font-mono-num hidden sm:table-cell">{fmtCurrency(Number(trade.commission ?? 0))}</TableCell>
                <TableCell className="text-muted-foreground text-xs hidden md:table-cell">{trade.trade_time || ''}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Live Prices Widget ─── */
function LivePrices({ accountId }: { accountId: string }) {
  const { data: positions } = useIBKRPositions(accountId);

  const conids = useMemo(() => {
    if (!positions || !Array.isArray(positions)) return [];
    return positions
      .map((p: any) => p.conid)
      .filter((c: any) => typeof c === 'number' && c > 0)
      .slice(0, 10);
  }, [positions]);

  const { data: snapshots } = useIBKRSnapshot(conids);
  const snapshotList = Array.isArray(snapshots) ? snapshots : [];

  if (conids.length === 0) {
    return (
      <Card className="trading-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Live Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">Prices will appear once you have open positions.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="trading-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Live Prices
          <span className="pulse-live bg-trading-buy ml-auto" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {snapshotList.map((snap: any, i: number) => {
          const last = snap['31'] ?? snap.lastPrice ?? null;
          const change = snap['84'] ?? snap.change ?? null;
          const changePct = snap['85'] ?? snap.changePercent ?? null;
          const positive = Number(change) >= 0;
          return (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <span className="text-xs font-semibold">{snap.conid || `#${conids[i]}`}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-num">{last != null ? fmtCurrency(Number(last)) : '—'}</span>
                {change != null && (
                  <span className={`text-xs font-mono-num ${positive ? 'text-trading-buy' : 'text-trading-sell'}`}>
                    {positive ? '+' : ''}{Number(change).toFixed(2)} ({Number(changePct ?? 0).toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ─── Quick Order / Order Ticket ─── */
function QuickOrder({ accountId, isConnected, selSymbol }: { accountId: string; isConnected: boolean; selSymbol: string }) {
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('1');
  const [orderType, setOrderType] = useState('MKT');
  const [price, setPrice] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [entry, setEntry] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [qtyTouched, setQtyTouched] = useState(false);

  // Symbol autocomplete (broker-independent)
  const [showSym, setShowSym] = useState(false);
  const symBoxRef = useRef<HTMLDivElement>(null);
  const { data: symResults = [] } = useSymbolSearch(symbol);

  // IBKR contract resolution (still needed for selectedConid on connected path)
  const { data: searchResults } = useIBKRContractSearch(symbol);
  const placeOrder = useIBKRPlaceOrder();
  const { addOpen } = useOpenTrades();

  const contracts = Array.isArray(searchResults) ? searchResults : [];
  // TODO Wave 2: contract disambiguation when multiple IBKR contracts
  const selectedConid = contracts[0]?.conid;

  // Close the suggestion dropdown on any outside click.
  useEffect(() => {
    if (!showSym) return;
    const onDoc = (e: MouseEvent) => {
      if (symBoxRef.current && !symBoxRef.current.contains(e.target as Node)) {
        setShowSym(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showSym]);

  // selSymbol sync — watchlist "→ Ticket" / row-select prefills the ticket.
  useEffect(() => {
    if (selSymbol && selSymbol !== symbol) setSymbol(selSymbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selSymbol]);

  // Live price for the chosen symbol.
  const { data: liveQuote } = useQuery({
    queryKey: ['ticket-quote', symbol],
    queryFn: () => fetchYahooQuote(symbol),
    staleTime: 60_000,
    enabled: symbol.length > 0,
  });
  const livePrice = liveQuote?.regularMarketPrice ?? null;
  const liveName = liveQuote?.shortName ?? liveQuote?.longName ?? null;

  // Prefill entry with a fresh live price only when entry is empty/0.
  useEffect(() => {
    if (livePrice != null && (!entry || Number(entry) === 0)) {
      setEntry(String(livePrice));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePrice]);

  // Any change to the order parameters resets the confirm step.
  useEffect(() => {
    setConfirming(false);
  }, [symbol, side, qty, orderType, price, stop, target, entry]);

  const rp = readRiskParams();
  const preview = riskPreview({
    side: side === 'BUY' ? 'long' : 'short',
    entry: Number(entry) || 0,
    stop: stop ? Number(stop) : undefined,
    target: target ? Number(target) : undefined,
    qty: Number(qty) || 0,
    account: rp?.account,
    riskPct: rp?.riskPct,
  });

  const sideLW = side === 'BUY' ? 'long' : 'short';
  const entryN = Number(entry) || 0;
  const stopN = stop ? Number(stop) : undefined;

  const applyStopPct = (pct: number) => {
    const s = stopFromPct(sideLW, entryN, pct);
    if (s != null) setStop(String(s));
  };
  const applyTargetR = (r: number) => {
    const t = targetFromR(sideLW, entryN, stopN, r);
    if (t != null) setTarget(String(t));
  };
  const useLive = () => { if (livePrice != null) setEntry(String(livePrice)); };

  useEffect(() => {
    if (qtyTouched) return;
    if (entryN > 0 && stopN != null && rp) {
      const q = qtyFromRisk(entryN, stopN, rp.account, rp.riskPct);
      if (q > 0) setQty(String(q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, stop, side, qtyTouched]);

  const isBuy = side === 'BUY';
  const sym = symbol.trim().toUpperCase();
  const canSubmit = !!symbol && Number(qty) > 0 && (!isConnected || !!selectedConid);
  const actionWord = isConnected ? side : `Track ${side}`;

  const doConnectedOrder = () => {
    if (!accountId || !selectedConid || !qty) {
      toast.error('Fill all required fields');
      return;
    }
    placeOrder.mutate(
      {
        accountId,
        orders: [
          {
            conid: selectedConid,
            orderType,
            side,
            quantity: Number(qty),
            price: orderType !== 'MKT' ? Number(price) : undefined,
            tif: 'DAY',
          },
        ],
      },
      {
        onSuccess: () => {
          toast.success('Order submitted successfully');
          setSymbol('');
          setQty('1');
          setQtyTouched(false);
          setPrice('');
          setConfirming(false);
        },
        onError: (err) => toast.error(`Order failed: ${err.message}`),
      }
    );
  };

  const doTrack = () => {
    addOpen({
      id: Math.random().toString(36).slice(2, 9),
      symbol: sym,
      side: side === 'BUY' ? 'long' : 'short',
      quantity: Number(qty) || 0,
      entryPrice: Number(entry) || 0,
      stopLoss: stop ? Number(stop) : undefined,
      target: target ? Number(target) : undefined,
      entryDate: todayISO(),
      planValid: true,
    });
    toast.success('Tracked — see Trade Tracker');
    setSymbol('');
    setQty('1');
    setQtyTouched(false);
    setPrice('');
    setStop('');
    setTarget('');
    setEntry('');
    setConfirming(false);
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      toast.error('Fill all required fields');
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    if (isConnected) doConnectedOrder();
    else doTrack();
  };

  return (
    <Card className="trading-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Order Ticket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Symbol search — broker-independent autocomplete */}
        <div className="relative" ref={symBoxRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
          <Input
            placeholder="Search symbol…"
            value={symbol}
            onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setShowSym(true); }}
            onFocus={() => { if (symbol) setShowSym(true); }}
            className="pl-9 font-mono text-sm"
            autoComplete="off"
          />
          {showSym && symResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
              {symResults.map((r) => (
                <button
                  key={r.symbolId}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSymbol(r.canonicalTicker.toUpperCase());
                    setShowSym(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                >
                  <span className="font-mono text-sm font-semibold">{r.canonicalTicker}</span>
                  <span className="truncate text-xs text-muted-foreground">{r.name}</span>
                  {r.primaryExchangeCode && (
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {r.primaryExchangeCode}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live price */}
        {symbol && livePrice != null && (
          <p className="-mt-2 text-[11px] text-muted-foreground">
            <Zap className="inline h-3 w-3 text-primary mr-0.5 -mt-0.5" />
            Live <span className="font-mono-num text-foreground">{fmtCurrency(livePrice)}</span>
            {liveName && <> · {liveName}</>}
          </p>
        )}

        {/* Contract result (connected path) */}
        {isConnected && selectedConid && (
          <div className="rounded-lg bg-muted/50 p-2.5 text-xs space-y-0.5">
            <p className="font-medium">{contracts[0]?.companyName || symbol}</p>
            <p className="text-muted-foreground">conid: {selectedConid} · {contracts[0]?.secType || 'STK'}</p>
          </div>
        )}

        {/* Buy / Sell toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSide('BUY')}
            className={`rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
              isBuy
                ? 'btn-buy'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setSide('SELL')}
            className={`rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
              !isBuy
                ? 'btn-sell'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Order type */}
        <Select value={orderType} onValueChange={setOrderType}>
          <SelectTrigger className="w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MKT">Market</SelectItem>
            <SelectItem value="LMT">Limit</SelectItem>
            <SelectItem value="STP">Stop</SelectItem>
          </SelectContent>
        </Select>

        {/* Quantity with stepper */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Quantity</label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => { setQty(String(Math.max(1, Number(qty) - 1))); setQtyTouched(true); }}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => { setQty(e.target.value); setQtyTouched(true); }}
              className="text-center font-mono-num text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => { setQty(String(Number(qty) + 1)); setQtyTouched(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Entry / Stop / Target */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Entry</label>
            <div className="flex gap-1 items-center">
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                className="w-full font-mono-num text-sm"
              />
              <button type="button" onClick={useLive} disabled={livePrice == null}
                className="shrink-0 px-2 rounded text-[11px] font-mono-num border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                Use live
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Stop</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              className="w-full font-mono-num text-sm"
            />
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 5].map((p) => (
                <button key={p} type="button" onClick={() => applyStopPct(p)}
                  disabled={entryN <= 0}
                  className="px-2 py-0.5 rounded text-[10px] font-mono-num border border-border/50 text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-40 transition-colors">
                  −{p}%
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Target</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full font-mono-num text-sm"
            />
            <div className="flex gap-1 mt-1">
              {[1, 2, 3].map((r) => (
                <button key={r} type="button" onClick={() => applyTargetR(r)}
                  disabled={entryN <= 0 || stopN == null}
                  className="px-2 py-0.5 rounded text-[10px] font-mono-num border border-border/50 text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-40 transition-colors">
                  +{r}R
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Price (for limit/stop) */}
        {orderType !== 'MKT' && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{orderType === 'LMT' ? 'Limit' : 'Stop'} Price</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full font-mono-num text-sm"
            />
          </div>
        )}

        {/* Risk preview */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Risk : Reward</span>
            <span className={`font-mono-num font-semibold ${
              preview.rr == null ? '' : preview.rr >= 2 ? 'text-trading-buy' : preview.rr >= 1.5 ? 'text-warning' : 'text-trading-sell'
            }`}>{preview.rr != null ? `${preview.rr.toFixed(2)} : 1` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">$ at risk</span>
            <span className={`font-mono-num ${preview.overRisk ? 'text-trading-sell font-semibold' : ''}`}>
              {preview.dollarRisk != null ? fmtCurrency(preview.dollarRisk) : '—'}
              {preview.acctRiskPct != null && (
                <span className="text-muted-foreground"> · {preview.acctRiskPct.toFixed(2)}%</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Position value</span>
            <span className="font-mono-num">{preview.posValue ? fmtCurrency(preview.posValue) : '—'}</span>
          </div>
          {preview.overRisk && (
            <div className="flex items-center gap-1.5 text-warning pt-0.5">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Exceeds your saved max risk %.</span>
            </div>
          )}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={placeOrder.isPending || !canSubmit}
          className={`w-full font-semibold ${isBuy ? 'btn-buy' : 'btn-sell'}`}
        >
          {placeOrder.isPending
            ? 'Submitting…'
            : confirming
              ? `Confirm ${actionWord} ${qty || 0} ${sym || '…'}`
              : `${actionWord} ${qty || 0} ${sym || '…'}`}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Main Trading Page ─── */
export default function Trading() {
  const { data: authStatus, isLoading: authLoading } = useIBKRAuthStatus();
  const { data: accounts } = useIBKRAccounts();

  const accountList = Array.isArray(accounts) ? accounts : accounts ? [accounts] : [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const account = accountList[selectedIdx];
  const accountId = account?.id || account?.accountId || '';

  const isGatewayOffline = !authLoading && authStatus === null;
  const isConnected = authStatus?.authenticated === true;

  // selSymbol drives the SymbolChart and prefills the Order Ticket; set by
  // Watchlist row-select / "→ Ticket".
  const [selSymbol, setSelSymbol] = useState('');

  const [activeTab, setActiveTab] = useState('watchlist');
  useEffect(() => {
    if (!isConnected && activeTab !== 'watchlist') setActiveTab('watchlist');
  }, [isConnected, activeTab]);

  return (
    <PageLayout
      title="IBKR Trading"
      description="Interactive Brokers trading dashboard — manage positions, orders, and execute trades."
      canonical="/trading"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Trading</h1>
            {accountList.length > 1 && (
              <Select value={String(selectedIdx)} onValueChange={(v) => setSelectedIdx(Number(v))}>
                <SelectTrigger className="w-auto h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountList.map((acc: any, i: number) => (
                    <SelectItem key={i} value={String(i)}>
                      {acc.id || acc.accountId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <ConnectionStatus />
        </div>

        {/* Trade Tracker — broker-independent; always shown (moved here from
            My Trading Plan). Closing a trade files it into the shared Journal. */}
        <TradeTracker />

        {/* Stats row — IBKR-only, self-gated */}
        {isConnected && <AccountStats accountId={accountId} />}

        {/* Always-on workspace: broker-independent core + IBKR self-gating */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Tabbed data */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="watchlist" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Watchlist
                </TabsTrigger>
                {isConnected && (
                  <>
                    <TabsTrigger value="positions" className="gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" /> Positions
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Orders
                    </TabsTrigger>
                    <TabsTrigger value="trades" className="gap-1.5">
                      <Radio className="h-3.5 w-3.5" /> Trades
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
              <TabsContent value="watchlist" className="mt-3">
                <Watchlist
                  selSymbol={selSymbol}
                  onSelect={setSelSymbol}
                  onSendToTicket={setSelSymbol}
                  showGatewayNote={isGatewayOffline}
                />
              </TabsContent>
              {isConnected && (
                <>
                  <TabsContent value="positions" className="mt-3">
                    <Card className="trading-card">
                      <CardContent className="pt-4 px-0 sm:px-4">
                        {accountId ? (
                          <PositionsTable accountId={accountId} />
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">Connect to view positions.</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="orders" className="mt-3">
                    <Card className="trading-card">
                      <CardContent className="pt-4 px-0 sm:px-4">
                        <OrdersTable accountId={accountId} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="trades" className="mt-3">
                    <Card className="trading-card">
                      <CardContent className="pt-4 px-0 sm:px-4">
                        <TradesTable />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </>
              )}
            </Tabs>
          </div>

          {/* Right: Symbol chart + Order form + Live Prices */}
          <div className="space-y-4">
            <SymbolChart symbol={selSymbol} />
            <QuickOrder accountId={accountId} isConnected={isConnected} selSymbol={selSymbol} />
            {isConnected && accountId && <LivePrices accountId={accountId} />}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
