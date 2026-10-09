/** Proposed contract, not a claim that the current backend already has these APIs. */
export type Amount = string; // Decimal USDT amounts, at most 6 decimals; NEVER JS floats for ledger writes.
export type IncomeRoute = 'products' | 'holdings' | 'subscription' | 'receipt' | 'settlement';
export interface DocumentRef { id: string; version: string; sha256: string; url: string; language: 'en'|'zh'; }
export interface Product {
  id: string; days: 90|180|365; targetAnnualRate: Amount; managementFeeIncluded: true;
  minAmount: Amount; maxAmount: Amount; enabled: boolean; termsVersion: string;
}
export interface Eligibility {
  canSubscribe: boolean; reasons: string[]; eligibleAvailable: Amount; snapshotVersion: string;
  fundingLots: {id: string; settledPurchaseId: string; eligibleUnreservedAmount: Amount}[];
}
export interface Preview {
  previewId: string; expiresAt: string; product: Product; principal: Amount;
  startAt: string; maturityAt: string; expectedSettlementBy: string;
  estimatedIncome: Amount; estimateIsGuaranteed: false; documents: DocumentRef[];
  counterparty: { legalName: string; registrationIdentifier?: string; };
  settlementTermsVersion: string; agreementVersion: string; signatureRequired: boolean;
}
export interface Holding {
  id:string; principal:Amount; targetAnnualRate:Amount; startAt:string; maturityAt:string;
  status:'active'|'matured'|'settling'|'settlement_failed'|'settled';
  estimatedAccrual:Amount; confirmedIncome:Amount|null; creditedIncome:Amount;
  confirmation:DocumentRef; ledgerReference:string; chainRecord:null|{
    network:string; txHash:string; status:'pending'|'confirmed'|'failed'; explorerUrl:string|null;
  };
}
export interface HostAdapter {
  // These callbacks reuse the current auth session/router. Never duplicate customer onboarding.
  openIncome(destination:IncomeRoute):void;
  openOriginalExchange(input:{purchaseAsset:'USDT'; returnTo:'income'}):void;
  openOriginalVerification(input:{returnTo:'income'}):void;
  openOriginalWallet(input:{asset:'USDT'; reference?:string}):void;
  openOriginalCardFunding(input:{asset:'USDT'; suggestedAmount?:Amount; walletCreditId?:string; returnTo:'income'}):void;
  // Wire to real services; endpoint names are intentionally not fabricated.
  getProducts(signal?:AbortSignal):Promise<Product[]>;
  getEligibility(signal?:AbortSignal):Promise<Eligibility>;
  getSubscriptionPreview(input:{productId:string; amount:Amount; eligibilityVersion:string}, signal?:AbortSignal):Promise<Preview>;
  submitSubscription(input:{previewId:string; idempotencyKey:string; acceptedDocumentVersions:string[]; consentTimestamp:string; signatureToken?:string}):Promise<{orderId:string; status:'pending'|'accepted'}>;
  getSubscription(orderId:string):Promise<{id:string; status:string; holdingId?:string}>;
  cancelBeforeAcceptance(orderId:string, idempotencyKey:string):Promise<{status:'cancelled'|'already_accepted'}>;
  listHoldings(signal?:AbortSignal):Promise<Holding[]>;
  getHolding(id:string):Promise<Holding>;
  requestMaturitySettlement(holdingId:string,idempotencyKey:string):Promise<{settlementId:string;status:string}>;
  getSettlement(settlementId:string):Promise<{status:string;netPayable:Amount|null;walletCreditId:string|null;failureReason?:string}>;
}

/** Mount only an additional entry in an agreed host placeholder. No DOM-selector injection. */
export function connectIncomeEntries(adapter: HostAdapter, enabled: boolean): () => void {
  const listener=(event:Event)=>{
    const ev=event as CustomEvent<{destination:'products'|'holdings';source:string}>;
    if(!enabled)return;
    adapter.openIncome(ev.detail.destination);
  };
  document.addEventListener('gex-income-open',listener);
  return ()=>document.removeEventListener('gex-income-open',listener);
}
/* Required host markup examples:
   Under the existing quick actions, above the existing subaccount heading:
   <gex-income-entry enabled="true" variant="home" lang="zh"></gex-income-entry>
   Under the existing asset-category switcher, in a separate Income block:
   <gex-income-entry enabled="true" variant="holdings" principal-usdt="0" lang="zh"></gex-income-entry>
   Add one same-sized item to the existing More grid, not a new bottom tab:
   <gex-income-entry enabled="true" variant="menu" lang="zh"></gex-income-entry>
   Use server feature flags; do not default to enabled for every account.
*/
