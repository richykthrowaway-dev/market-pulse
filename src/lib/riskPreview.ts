export interface RiskPreviewInput {
  side: 'long' | 'short';
  entry: number;
  stop?: number;
  target?: number;
  qty: number;
  account?: number;
  riskPct?: number;
}
export interface RiskPreviewResult {
  rr: number | null;
  dollarRisk: number | null;
  posValue: number;
  acctRiskPct: number | null;
  overRisk: boolean;
}

/** Position risk/reward preview. Pure; all optional fields degrade to null. */
export function riskPreview(i: RiskPreviewInput): RiskPreviewResult {
  const riskPS = i.stop != null && i.entry > 0 ? Math.abs(i.entry - i.stop) : null;
  const rewardPS = i.target != null && i.entry > 0 ? Math.abs(i.target - i.entry) : null;
  const rr = riskPS != null && rewardPS != null && riskPS > 0 ? rewardPS / riskPS : null;
  const dollarRisk = riskPS != null && i.qty > 0 ? riskPS * i.qty : null;
  const posValue = i.entry > 0 && i.qty > 0 ? i.entry * i.qty : 0;
  const acctRiskPct =
    dollarRisk != null && i.account != null && i.account > 0
      ? (dollarRisk / i.account) * 100
      : null;
  const overRisk =
    acctRiskPct != null && i.riskPct != null ? acctRiskPct > i.riskPct : false;
  return { rr, dollarRisk, posValue, acctRiskPct, overRisk };
}
