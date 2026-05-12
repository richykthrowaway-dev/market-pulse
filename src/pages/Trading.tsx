import { useState, useMemo } from 'react';
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
import { toast } from 'sonner';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  DollarSign,
  Minus,
  Plus,
  Radio,
  Search,
  Server,
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

/* ─── helpers ─── */
function fmtCurrency(v: number | null | undefined, fallback = '—') {
  if (v == null) return fallback;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}
function pnlClass(v: number | null | undefined) {
  if (v == null || v === 0) return 'text-muted-foreground';
  return v > 0 ? 'text-trading-buy' : 'text-trading-sell';
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

/* ─── Gateway Setup Guide ─── */
function GatewayGuide() {
  return (
    <Card className="trading-card border-dashed border-muted-foreground/30">
      <CardContent className="py-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Server className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-lg font-semibold">Connect Your IBKR Gateway</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To use live trading features, you need to run the IBKR Client Portal Gateway on your machine
              and expose it via a public tunnel (e.g. ngrok). Then set the <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">IBKR_GATEWAY_URL</code> secret
              to the tunnel&apos;s public URL.
            </p>
          </div>
          <div className="grid gap-2 text-left text-xs text-muted-foreground w-full max-w-sm">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 shrink-0">1</Badge>
              <span>Download &amp; run the <strong>IB Gateway</strong> or <strong>TWS</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 shrink-0">2</Badge>
              <span>Start a tunnel: <code className="font-mono bg-muted px-1 rounded">ngrok http 5000</code></span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 shrink-0">3</Badge>
              <span>Set the <strong>IBKR_GATEWAY_URL</strong> secret to the ngrok URL</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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

/* ─── Quick Order ─── */
function QuickOrder({ accountId }: { accountId: string }) {
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('1');
  const [orderType, setOrderType] = useState('MKT');
  const [price, setPrice] = useState('');

  const { data: searchResults } = useIBKRContractSearch(symbol);
  const placeOrder = useIBKRPlaceOrder();

  const contracts = Array.isArray(searchResults) ? searchResults : [];
  const selectedConid = contracts[0]?.conid;

  const handleSubmit = () => {
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
          setPrice('');
        },
        onError: (err) => toast.error(`Order failed: ${err.message}`),
      }
    );
  };

  const isBuy = side === 'BUY';

  return (
    <Card className="trading-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Quick Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Symbol search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search symbol…"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="pl-9 font-mono text-sm"
          />
        </div>

        {/* Contract result */}
        {selectedConid && (
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
              onClick={() => setQty(String(Math.max(1, Number(qty) - 1)))}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="text-center font-mono-num text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setQty(String(Number(qty) + 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
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

        {/* Order summary */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Action</span>
            <span className={isBuy ? 'text-trading-buy font-medium' : 'text-trading-sell font-medium'}>{side}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span>{orderType === 'MKT' ? 'Market' : orderType === 'LMT' ? 'Limit' : 'Stop'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Qty</span>
            <span className="font-mono-num">{qty || '—'}</span>
          </div>
          {orderType !== 'MKT' && price && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price</span>
              <span className="font-mono-num">{fmtCurrency(Number(price))}</span>
            </div>
          )}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={placeOrder.isPending || !selectedConid || !qty}
          className={`w-full font-semibold ${isBuy ? 'btn-buy' : 'btn-sell'}`}
        >
          {placeOrder.isPending
            ? 'Submitting…'
            : `${side} ${qty || 0} ${symbol || '…'}`}
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

        {/* Gateway guide if offline */}
        {isGatewayOffline && <GatewayGuide />}

        {/* Stats row */}
        {!isGatewayOffline && <AccountStats accountId={accountId} />}

        {/* Main content: tables + sidebar */}
        {!isGatewayOffline && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Tabbed data */}
            <div className="lg:col-span-2 space-y-4">
              <Tabs defaultValue="positions">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="positions" className="gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Positions
                  </TabsTrigger>
                  <TabsTrigger value="orders" className="gap-1.5">
                    <Zap className="h-3.5 w-3.5" /> Orders
                  </TabsTrigger>
                  <TabsTrigger value="trades" className="gap-1.5">
                    <Radio className="h-3.5 w-3.5" /> Trades
                  </TabsTrigger>
                </TabsList>
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
              </Tabs>
            </div>

            {/* Right: Order form + Live Prices */}
            <div className="space-y-4">
              <QuickOrder accountId={accountId} />
              {accountId && <LivePrices accountId={accountId} />}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
