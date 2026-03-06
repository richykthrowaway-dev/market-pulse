
import React from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { usePortfolio } from '@/hooks/usePortfolio';

const Performance = () => {
  const { data: holdings = [], isLoading } = usePortfolio();

  if (isLoading) {
    return (
      <PageLayout title="Performance">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading performance data…</p>
        </div>
      </PageLayout>
    );
  }

  if (holdings.length === 0) {
    return (
      <PageLayout title="Performance">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground text-lg">No portfolio holdings yet</p>
            <p className="text-muted-foreground text-sm mt-2">Add holdings to your portfolio to see performance analytics.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  const totalCostBasis = holdings.reduce((sum: number, h: any) => sum + h.shares * h.avg_cost_basis, 0);

  return (
    <PageLayout title="Performance">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-card rounded-lg p-6 shadow">
            <h2 className="text-xl font-semibold mb-4">Portfolio Summary</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Cost Basis</p>
                <p className="text-2xl font-bold">${totalCostBasis.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Holdings</p>
                <p className="text-xl font-bold">{holdings.length} positions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Performance;
