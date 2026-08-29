import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { negotiate, createOrder } from '../api/client';
import { Spinner, TrustBadge } from '../components';
import { useUIStore } from '../stores/uiStore';
import axios from 'axios';

export default function NegotiationCheckout() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const pid = Number(productId);

  const [proposedPrice, setProposedPrice] = useState('');
  const [buyerMessage, setBuyerMessage] = useState('');
  const [negotiation, setNegotiation] = useState<any>(null);
  const [policyResult, setPolicyResult] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);

  // Fetch product info
  const { data: productData, isLoading } = useQuery({
    queryKey: ['product-for-negotiate', pid],
    queryFn: async () => {
      // Fetch all manifests to find the product
      const merchants = await axios.get('/api/merchants').then(r => r.data);
      for (const m of merchants) {
        try {
          const manifest = await axios.get(`/api/manifest/${m.id}`).then(r => r.data);
          const product = manifest.products?.find((p: any) => p.id === pid);
          if (product) return { product, merchant: m };
        } catch { continue; }
      }
      return null;
    },
  });

  const product = productData?.product;
  const merchant = productData?.merchant;

  const negotiateMut = useMutation({
    mutationFn: (data: any) => negotiate(data),
    onSuccess: (data) => {
      setNegotiation(data);
      if (data.status === 'accepted') {
        setPolicyResult({ approved: true, reason: data.policy_reason });
      } else if (data.status === 'blocked') {
        setPolicyResult({ approved: false, reason: data.policy_reason });
      }
    },
    onError: (err: any) => addToast(err?.response?.data?.detail || 'Negotiation failed', 'error'),
  });

  const orderMut = useMutation({
    mutationFn: (data: any) => createOrder(data),
    onSuccess: (data) => {
      setOrderData(data);
      addToast('Order created! Redirecting to receipt...', 'success');
      setTimeout(() => navigate(`/shop/receipt/${data.id}`), 1500);
    },
    onError: (err: any) => addToast(err?.response?.data?.detail || 'Order creation failed', 'error'),
  });

  const handleNegotiate = () => {
    if (!proposedPrice) return addToast('Enter your proposed price', 'error');
    negotiateMut.mutate({
      product_id: pid,
      proposed_price: Number(proposedPrice),
      buyer_message: buyerMessage,
    });
  };

  const handlePay = () => {
    if (!negotiation?.final_price || !product) return;
    orderMut.mutate({
      product_id: pid,
      amount: negotiation.final_price,
      negotiation_id: negotiation.id,
      buyer_intent: buyerMessage,
    });
  };

  if (isLoading) return <Spinner />;
  if (!product) return <div className="text-center py-16 text-text-secondary">Product not found</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold text-text mb-6 sm:mb-8">Negotiate & Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Product + Negotiation */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6">
          {/* Product Card */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex-1">
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">{product.category}</span>
                <h2 className="text-lg sm:text-xl font-bold text-text mt-2 leading-snug">{product.name}</h2>
                {merchant && (
                  <p className="text-xs sm:text-sm text-text-secondary mt-1.5 flex items-center gap-2 flex-wrap">
                    <span>by {merchant.name}</span>
                    <TrustBadge score={merchant.trust_score} />
                  </p>
                )}
                {(product.variants?.source_url || product.source_url) && (
                  <a
                    href={product.variants?.source_url || product.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 font-medium"
                  >
                    <span>View original product listing</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-text-tertiary block sm:hidden">Price</span>
                <p className="text-2xl sm:text-3xl font-bold text-text">₹{Number(product.price).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 sm:gap-4 mt-4 pt-3 border-t border-border/60 text-xs sm:text-sm text-text-secondary">
              <span>📦 {product.stock} in stock</span>
              <span>🚚 {product.delivery_days}-day delivery</span>
              <span>↩️ {product.return_policy}</span>
            </div>
          </div>

          {/* Negotiation Input */}
          {!negotiation && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-6">
              <h3 className="font-semibold text-text text-base mb-4">Make Your Offer</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm text-text-secondary mb-1">Your Price (₹)</label>
                  <input
                    type="number"
                    value={proposedPrice}
                    onChange={e => setProposedPrice(e.target.value)}
                    placeholder={`e.g. ${Math.round(product.price * 0.9)}`}
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-text-secondary mb-1">Message (optional)</label>
                  <textarea
                    value={buyerMessage}
                    onChange={e => setBuyerMessage(e.target.value)}
                    placeholder="I'm looking to buy immediately if we can agree on this price."
                    rows={2}
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-border bg-white text-text text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <button
                  onClick={handleNegotiate}
                  disabled={negotiateMut.isPending}
                  className="w-full py-2.5 sm:py-3 bg-primary text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {negotiateMut.isPending ? 'Negotiating...' : 'Submit Offer'}
                </button>
              </div>
            </div>
          )}

          {/* Negotiation Transcript */}
          {negotiation && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-6">
              <h3 className="font-semibold text-text text-base mb-4">Negotiation Transcript</h3>
              <div className="space-y-3 sm:space-y-4">
                {negotiation.negotiation_transcript?.map((msg: any, i: number) => (
                  <div key={i} className={`flex ${msg.role === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 ${
                      msg.role === 'buyer' ? 'bg-primary text-white rounded-br-md' :
                      msg.role === 'policy' ? (
                        msg.status === 'accepted' || msg.status === 'blocked' ? (
                          msg.status === 'accepted' ? 'bg-success/10 text-success border border-success/30' :
                          'bg-danger/10 text-danger border border-danger/30'
                        ) : 'bg-surface-alt text-text'
                      ) : 'bg-surface-alt text-text rounded-bl-md'
                    }`}>
                      <div className="text-[10px] uppercase font-medium mb-1 opacity-75">
                        {msg.role === 'buyer' ? '🛒 Buyer' : msg.role === 'merchant_ai' ? '🤖 Merchant AI' : '🛡️ Policy Engine'}
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Policy Check + Payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Policy Check Result */}
          {policyResult && (
            <div className={`rounded-2xl border-2 shadow-sm p-6 ${
              policyResult.approved
                ? 'bg-success/5 border-success/30'
                : 'bg-danger/5 border-danger/30'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  policyResult.approved ? 'bg-success text-white' : 'bg-danger text-white'
                }`}>
                  {policyResult.approved ? '✓' : '✕'}
                </div>
                <h3 className="font-semibold text-text">
                  {policyResult.approved ? 'Policy Check Passed' : 'Policy Violation'}
                </h3>
              </div>
              <p className="text-sm text-text-secondary">{policyResult.reason}</p>
              {negotiation && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Original Price</span>
                    <span className="text-text">₹{negotiation.original_price?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Your Offer</span>
                    <span className="text-text">₹{negotiation.proposed_price?.toLocaleString()}</span>
                  </div>
                  {negotiation.final_price && (
                    <div className="flex justify-between font-semibold">
                      <span className="text-text">Final Price</span>
                      <span className="text-primary">₹{negotiation.final_price?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Discount</span>
                    <span className="text-text">{negotiation.discount_percent?.toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Blocked State */}
          {negotiation?.status === 'blocked' && (
            <div className="bg-danger/5 rounded-2xl border-2 border-danger/30 p-6 text-center">
              <div className="text-3xl mb-3">🚫</div>
              <h3 className="font-bold text-danger text-lg mb-2">Payment Blocked</h3>
              <p className="text-sm text-text-secondary mb-4">{negotiation.policy_reason}</p>
              <p className="text-xs text-text-secondary">
                No payment attempt was made. The policy engine blocked this transaction.
              </p>
              <button
                onClick={() => { setNegotiation(null); setPolicyResult(null); setProposedPrice(''); }}
                className="mt-4 px-6 py-2 bg-white border border-border rounded-lg text-sm text-text hover:bg-surface-alt transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Payment Section */}
          {negotiation?.status === 'accepted' && !orderData && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
              <h3 className="font-semibold text-text mb-4">Complete Payment</h3>
              <div className="bg-surface-alt rounded-xl p-4 mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">Amount</span>
                  <span className="font-bold text-text text-lg">₹{negotiation.final_price?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Razorpay Test Mode</span>
                  <span className="text-success">🔒 Secure</span>
                </div>
              </div>
              <button
                onClick={handlePay}
                disabled={orderMut.isPending}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {orderMut.isPending ? 'Processing...' : `Pay ₹${negotiation.final_price?.toLocaleString()}`}
              </button>
              <p className="text-[10px] text-text-secondary text-center mt-2">
                Test mode — no real money charged
              </p>
            </div>
          )}

          {/* Order Created */}
          {orderData && (
            <div className="bg-success/5 rounded-2xl border-2 border-success/30 p-6 text-center">
              <div className="text-3xl mb-2">✅</div>
              <h3 className="font-bold text-success text-lg mb-1">Order Created!</h3>
              <p className="text-sm text-text-secondary">Redirecting to receipt...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
