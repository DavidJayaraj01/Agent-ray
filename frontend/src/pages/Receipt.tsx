import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchOrder, completeTestPayment } from '../api/client';
import { Spinner, TrustBadge, MerchantLogo } from '../components';
import { useUIStore } from '../stores/uiStore';
import { formatLocalDateTime } from '../utils/date';

export default function Receipt() {
  const { id: routeId, orderId: routeOrderId } = useParams<{ id?: string; orderId?: string }>();
  const orderId = Number(routeId || routeOrderId);
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
  });

  const payMutation = useMutation({
    mutationFn: () => completeTestPayment(orderId),
    onSuccess: (res) => {
      addToast(`Payment verified! (Razorpay ID: ${res.razorpay_payment_id})`, 'success');
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
    },
    onError: (err: any) => {
      addToast(err?.response?.data?.detail || 'Failed to complete payment', 'error');
    },
  });

  if (isLoading) return <Spinner />;
  if (!data) return <div className="text-center py-16 text-text-secondary">Order not found</div>;

  const { order, product, merchant, negotiation } = data;
  const formattedTime = formatLocalDateTime(order.created_at);
  const isPaid = order.status === 'paid';

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-12 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-border shadow-lg overflow-hidden">
        {/* Header */}
        <div className={`px-4 sm:px-8 py-8 sm:py-10 text-white text-center relative overflow-hidden ${
          isPaid ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-primary-dark' : 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700'
        }`}>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner">
            {isPaid ? (
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <span className="text-2xl">⏳</span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1.5">
            {isPaid ? 'Verified AI Commerce Receipt' : 'Order Awaiting Payment Verification'}
          </h1>
          <p className="text-blue-100 text-xs sm:text-sm font-medium">
            Order #{order.id} · {formattedTime}
          </p>
        </div>

        <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          {/* Razorpay Transaction Details Banner */}
          <div className={`p-4 rounded-2xl border space-y-2 ${
            isPaid ? 'bg-emerald-50/80 border-emerald-200/80' : 'bg-amber-50/80 border-amber-200/80'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${
                isPaid ? 'text-emerald-900' : 'text-amber-900'
              }`}>
                <span>{isPaid ? '🛡️' : '⏳'}</span>
                <span>{isPaid ? 'Razorpay Test API Verified Transaction' : 'Razorpay Order Created — Awaiting Payment'}</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shadow-2xs ${
                isPaid ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-900'
              }`}>
                {isPaid ? 'Paid & Verified' : 'Payment Awaiting'}
              </span>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t font-mono ${
              isPaid ? 'border-emerald-200/60' : 'border-amber-200/60'
            }`}>
              <div>
                <span className={`${isPaid ? 'text-emerald-700' : 'text-amber-700'} font-sans text-[11px] block`}>
                  Razorpay Order ID:
                </span>
                <span className={`${isPaid ? 'text-emerald-950' : 'text-amber-950'} font-bold break-all`}>
                  {order.razorpay_order_id || 'N/A'}
                </span>
              </div>
              <div>
                <span className={`${isPaid ? 'text-emerald-700' : 'text-amber-700'} font-sans text-[11px] block`}>
                  Razorpay Payment ID:
                </span>
                <span className={`${isPaid ? 'text-emerald-950' : 'text-amber-950'} font-bold break-all`}>
                  {order.razorpay_payment_id || (isPaid ? `pay_verified_${order.id}` : 'Pending Confirmation')}
                </span>
              </div>
            </div>

            {!isPaid && (
              <div className="pt-2">
                <button
                  onClick={() => payMutation.mutate()}
                  disabled={payMutation.isPending}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {payMutation.isPending ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>⚡</span>
                  )}
                  <span>Complete Payment Verification Now (₹{Number(order.amount).toLocaleString('en-IN')})</span>
                </button>
              </div>
            )}
          </div>

          {/* User Intent & Upsell Details */}
          {order.buyer_intent && (
            <div className="space-y-3">
              {order.buyer_intent.includes('Cross-Sell Bundle') && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚀</span>
                    <div>
                      <p className="text-xs font-bold text-emerald-900">
                        AI Growth Cross-Sell Bundle Included
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        {order.buyer_intent.split('Cross-Sell Bundle:')[1]?.trim()}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
                    Upsell Unlocked
                  </span>
                </div>
              )}
              <div>
                <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                  Buyer Intent
                </h3>
                <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4">
                  <p className="text-xs sm:text-sm text-text italic">"{order.buyer_intent}"</p>
                </div>
              </div>
            </div>
          )}

          {/* Product & Merchant */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                Purchased Product
              </h3>
              <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4">
                <p className="font-semibold text-text text-sm sm:text-base leading-snug">
                  {product?.name}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">{product?.category}</p>
                <p className="text-base sm:text-lg font-bold text-text mt-1.5">
                  ₹{product?.price?.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                Merchant
              </h3>
              <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4">
                <div className="flex items-center gap-3">
                  <MerchantLogo name={merchant?.name} category={merchant?.category} size="md" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-text text-sm sm:text-base">{merchant?.name}</p>
                      <TrustBadge score={merchant?.trust_score || 0} />
                    </div>
                    <p className="text-xs text-text-secondary">Verified Autonomous Commerce Merchant</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Negotiation Delta */}
          {negotiation && (
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                Negotiation Summary
              </h3>
              <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-text-secondary">Original List Price</span>
                  <span className="text-text">₹{negotiation.original_price?.toLocaleString('en-IN')}</span>
                </div>
                {negotiation.final_price && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-text-secondary">Negotiated Final Price</span>
                    <span className="font-bold text-emerald-600">
                      ₹{negotiation.final_price?.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-text-secondary">Discount Applied</span>
                  <span className="text-primary font-bold">
                    {negotiation.discount_percent?.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-text-secondary">Policy Status</span>
                  <span className="font-bold text-emerald-600 uppercase text-xs">
                    ✓ Accepted by Policy Engine
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Autonomous Verification */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
              Autonomous Verification
            </h3>
            <div className="bg-emerald-50 rounded-xl p-3.5 sm:p-4 border border-emerald-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-emerald-700 font-bold text-xs sm:text-sm">
                  ✓ Passed Deterministic Policy Gate
                </span>
              </div>
              <p className="text-xs text-emerald-800">
                Price is bounded within merchant discount policy and verified against catalog manifest.
              </p>
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
              Payment Summary
            </h3>
            <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4 space-y-2.5">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-text-secondary">Total Amount Charged</span>
                <span className="text-lg sm:text-2xl font-black text-slate-900">
                  ₹{Number(order.amount).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-text-secondary">Transaction Currency</span>
                <span className="text-text font-bold">{order.currency || 'INR'}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-text-secondary">Order Timestamp</span>
                <span className="text-text font-medium">{formattedTime}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm items-center">
                <span className="text-text-secondary">Payment State</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isPaid ? 'PAID & VERIFIED' : 'PAYMENT AWAITING'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
            <Link
              to="/shop/orders"
              className="flex-1 py-3 bg-primary text-white rounded-xl text-xs sm:text-sm font-bold text-center hover:bg-primary-dark transition-all shadow-xs"
            >
              Back to My Orders
            </Link>
            <Link
              to="/shop"
              className="flex-1 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-center hover:bg-slate-50 transition-all shadow-2xs"
            >
              Continue Shopping 🛍️
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
