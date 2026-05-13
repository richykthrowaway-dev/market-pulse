import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link2, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react'
import {
  useConnectBrokerage,
  useSnapTradeAccounts,
  useSnapTradeConnections,
  useSnapTradeSync,
} from '@/hooks/useSnapTrade'
import { cn } from '@/lib/utils'

/**
 * SnapTradeConnectCard — entry point for automatic brokerage sync.
 *
 * Empty state → "Connect Brokerage" button opens the SnapTrade portal in
 * a popup, registers the user (idempotent), and pulls holdings.
 *
 * Connected state → list of linked brokerages + manual refresh.
 */
export function SnapTradeConnectCard() {
  const accounts    = useSnapTradeAccounts()
  const connections = useSnapTradeConnections()
  const connect     = useConnectBrokerage()
  const sync        = useSnapTradeSync()

  const hasConnections = (connections.data?.length ?? 0) > 0

  function fmtCurrency(v: number | null | undefined): string {
    if (v == null) return '—'
    return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  function fmtTime(iso: string | null | undefined): string {
    if (!iso) return 'never'
    const d = new Date(iso)
    const mins = Math.round((Date.now() - d.getTime()) / 60_000)
    if (mins < 1)   return 'just now'
    if (mins < 60)  return `${mins}m ago`
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <Card>
      <CardContent className="py-3 px-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Auto-sync
            </p>
          </div>
          {hasConnections && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px]"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              {sync.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span className="ml-1">Refresh</span>
            </Button>
          )}
        </div>

        {!hasConnections && (
          <>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Connect a brokerage to auto-import positions. No CSV uploads required.
            </p>
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => connect.mutate(undefined)}
              disabled={connect.isPending}
            >
              {connect.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  Connecting…
                </>
              ) : (
                <>
                  <Link2 className="h-3 w-3 mr-1.5" />
                  Connect Brokerage
                </>
              )}
            </Button>
            {connect.error && (
              <p className="text-[10px] text-danger leading-snug">
                {String(connect.error)}
              </p>
            )}
          </>
        )}

        {hasConnections && (
          <div className="space-y-1.5">
            {connections.data?.map((c) => {
              const acc = accounts.data?.filter((a) =>
                // accounts are tied to authorizations via SnapTrade — best
                // effort link by institution name for the row label.
                a.institution_name === c.brokerage_name,
              )
              const total = acc?.reduce((sum, a) => sum + (a.total_value ?? 0), 0) ?? 0
              return (
                <div
                  key={c.authorization_id}
                  className={cn(
                    'flex items-center justify-between text-[11px] py-1 px-2 rounded',
                    'bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2
                      className={cn(
                        'h-3 w-3 flex-shrink-0',
                        c.disabled ? 'text-muted-foreground' : 'text-success',
                      )}
                    />
                    <span className="truncate font-medium">
                      {c.brokerage_name ?? 'Unknown broker'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono">{fmtCurrency(total)}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {fmtTime(c.last_synced_at)}
                    </span>
                  </div>
                </div>
              )
            })}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-6 text-[10px]"
              onClick={() => connect.mutate(undefined)}
              disabled={connect.isPending}
            >
              {connect.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                '+ Add another'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
