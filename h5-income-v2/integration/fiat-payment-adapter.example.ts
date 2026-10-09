/**
 * Proposed contract for integration with existing GEXFI services.
 * No endpoint names, payment permission, provider approval or live connection are implied.
 * Client amounts are display values only. Authoritative pricing, eligibility and ledger writes
 * must be validated and performed on the server.
 */
export type USDTAmount = string; // Decimal, max 6 places; integer micro-USDT in ledger.
export type FiatMinorUnits = string; // Integer cents/fen, not JavaScript floating point.
export type ProductId = string;
export type PurchasePurpose = 'USDT_PURCHASE';
export type PaymentState = 'created' | 'awaiting_payment' | 'confirming' | 'received'
  | 'cancel_requested' | 'cancelled' | 'expired' | 'failed' | 'review_required'
  | 'refund_pending' | 'refunded';
export type ReleaseState = 'not_received' | 'pending_review' | 'released' | 'held' | 'rejected';
export type PurchaseExecution = 'not_started' | 'processing' | 'unknown' | 'settled' | 'not_executed';
export interface PaymentMethod {
  id:string;
  displayName:string;
  modes:('hosted_checkout'|'qr'|'app_deeplink')[];
  available:boolean;
  unavailableReason?:string;
  // True only when the server has verified both the legal service market and rail permission.
  purpose:PurchasePurpose;
  minimumFiatMinor:FiatMinorUnits;
  maximumFiatMinor:FiatMinorUnits;
}
export interface PaymentAvailability {
  canPurchase:boolean;
  decisionId:string;
  expiresAt:string;
  methods:PaymentMethod[];
  customerMessage?:string;
  // This is server-derived from verified customer information, not a UI region selector.
  jurisdictionDecisionReference:string;
}
export interface PurchaseQuote {
  id:string; expiresAt:string; pricingVersion:string; availabilityDecisionId:string;
  productId:ProductId;
  purchaseAmount:USDTAmount; asset:'USDT'; fiatCurrency:string;
  customerFiatPerUSDT:string; spreadIncluded:true;
  additionalFees:{label:string;amountMinor:FiatMinorUnits}[];
  totalPayableMinor:FiatMinorUnits;
  methodId:string; purpose:PurchasePurpose;
  terms:{id:string;version:string;sha256:string;url:string}[];
}
export interface PurchaseOrder {
  id:string; paymentId:string; quoteId:string; productId:ProductId;
  purpose:PurchasePurpose; fiatCurrency:string;
  totalPayableMinor:FiatMinorUnits; receivedMinor:FiatMinorUnits;
  purchaseAmount:USDTAmount; actualCreditedAmount:USDTAmount;
  paymentState:PaymentState; releaseState:ReleaseState; executionState:PurchaseExecution;
  checkoutExpiresAt:string; statusVersion:string; serverTime:string;
  // Production URLs are opaque provider-issued values on an audited allowlist, never synthesized.
  checkout:null|{hostedUrl?:string;qrPayload?:string;appUrl?:string;expiresAt:string};
  walletCreditId:string|null; fundingLotId:string|null;
  refund:null|{id:string;amountMinor:FiatMinorUnits;status:'pending'|'failed'|'completed';originalMethod:string};
  linkedSubscriptionOrderId:string|null;
  canContinuePayment:boolean;canRequestCancel:boolean;canContinueSubscription:boolean;
  customerStatusLabel:string; customerMessage:string;
}
export interface FiatPaymentAdapter {
  getPaymentAvailability(input:{productId:ProductId;asset:'USDT';fiatCurrency:string;purpose:PurchasePurpose},signal?:AbortSignal):Promise<PaymentAvailability>;
  getQuote(input:{productId:ProductId;purchaseAmount:USDTAmount;fiatCurrency:string;methodId:string;availabilityDecisionId:string},signal?:AbortSignal):Promise<PurchaseQuote>;
  createPurchase(input:{quoteId:string;idempotencyKey:string;acceptedPricingVersion:string;acceptedTermsVersions:string[];consentTimestamp:string},signal?:AbortSignal):Promise<PurchaseOrder>;
  getPurchase(orderId:string,signal?:AbortSignal):Promise<PurchaseOrder>;
  requestCancel(input:{orderId:string;expectedStatusVersion:string;idempotencyKey:string}):Promise<PurchaseOrder>;
  // This must refresh both funding eligibility and the Income preview. A payment callback cannot call it directly.
  prepareSubscription(input:{purchaseOrderId:string;productId:string;fundingLotId:string}):Promise<{
    previewId:string;expiresAt:string;principal:USDTAmount;netTargetAnnualRate:string;
    startAt:string;maturityAt:string;documents:{id:string;version:string;sha256:string;url:string}[];
  }>;
  openOriginalSupport(input:{purchaseOrderId?:string;paymentId?:string;subscriptionOrderId?:string}):void;
}
/** Always use this server-state check before exposing Continue to Income. */
export function canProceedToIncome(o:PurchaseOrder):boolean {
  return o.paymentState==='received' && o.releaseState==='released' &&
    o.executionState==='settled' && !!o.walletCreditId && !!o.fundingLotId &&
    o.canContinueSubscription && !o.refund;
}
/** A hosted checkout return URL does not establish a payment result. */
export async function refreshAfterCheckoutReturn(adapter:FiatPaymentAdapter, orderId:string, signal?:AbortSignal):Promise<PurchaseOrder> {
  return adapter.getPurchase(orderId,signal);
}
/* Production invariants:
  1. ALIPAY/WECHAT cannot be enabled by a front-end config toggle. Reusing an AI-card merchant
     account or relabelling USDT_PURCHASE as CARD_TOPUP / SOFTWARE_SERVICE is not allowed.
  2. The backend validates provider signatures, exact amount/currency/order identity, settlement
     and financial release. No trust in screenshots, QR scans, browser callbacks or "I have paid".
  3. Duplicate webhooks, repeated order creation and retrying subscription use idempotency keys.
  4. cancel_requested is not cancelled. A captured payment after closure is reconciled/refunded;
     never silently create a new USDT purchase at a new quote.
  5. executionState=unknown must remain on hold until resolved. Refund only after non-execution
     is confirmed, otherwise the same money might be both converted and refunded.
  6. Completing the purchase creates an eligible funding lot. It does NOT imply consent to invest.
     A second explicit Income confirmation with versioned documents creates the reservation.
  7. Cancelling a subscription after purchase releases/retains USDT in the wallet, not a new fiat refund.
  8. Query every ~3s only while needed, pause on hidden tabs, cap retries/backoff, stop on terminal
     states and use AbortController on navigation. Refresh on return and use server time.
  9. Do not copy demo quotes, limits, balances, QR payload, timestamps or test-state buttons to production.
 */
