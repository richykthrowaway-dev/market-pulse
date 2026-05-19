export interface ClosePlan {
  mode: 'full' | 'partial' | 'invalid';
  closeQty: number;
  remainder: number;
}
export function planClose({ positionQty, closeQty }: { positionQty: number; closeQty: number }): ClosePlan {
  if (!Number.isFinite(closeQty) || closeQty <= 0 || closeQty > positionQty) {
    return { mode: 'invalid', closeQty, remainder: positionQty };
  }
  if (closeQty === positionQty) return { mode: 'full', closeQty, remainder: 0 };
  return { mode: 'partial', closeQty, remainder: positionQty - closeQty };
}
