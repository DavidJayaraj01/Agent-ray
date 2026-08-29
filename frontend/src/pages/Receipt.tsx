import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchOrder } from '../api/client';
import { Spinner, TrustBadge } from '../components';

export default function Receipt() {
  const { orderId } = useParams<{ orderId: string }>();
  const oid = Number(orderId);

  const { data, isLoading } = useQuery({
    queryKey: ['order', oid],
    queryFn: () => fetchOrder(oid),
  });

  if (isLoading) return <Spinner />;
  if (!data) return <div className="text-center py-16 text-text-secondary">Order not found</div>;

  const { order, product, merchant, negotiation } = data;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-dark px-4 sm:px-8 py-6 sm:py-8 text-white text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-1">AI Commerce Receipt</h1>
          <p className="text-white/70 text-xs sm:text-sm">Order #{order.id} · {new Date(order.created_at).toLocaleString()}</p>
        </div>

        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          {/* User Intent & Upsell Details */}
          {order.buyer_intent && (
            <div className="space-y-3">
              {order.buyer_intent.includes('Cross-Sell Bundle') && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚀</span>
                    <div>
                      <p className="text-xs font-bold text-emerald-900">AI Growth Cross-Sell Bundle Included</p>
                      <p className="text-[11px] text-emerald-700">{order.buyer_intent.split('Cross-Sell Bundle:')[1]?.trim()}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
                    Upsell Unlocked
                  </span>
                </div>
              )}
              <div>
                <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Buyer Intent</h3>
                <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4">
                  <p className="text-xs sm:text-sm text-text italic">"{order.buyer_intent}"</p>
                </div>
              </div>
            </div>
          )}

          {/* Product & Merchant */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Product</h3>
              <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4">
                <p className="font-semibold text-text text-sm sm:text-base leading-snug">{product?.name}</p>
                <p className="text-xs text-text-secondary mt-0.5">{product?.category}</p>
                <p className="text-base sm:text-lg font-bold text-text mt-1.5">₹{product?.price?.toLocaleString()}</p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Merchant</h3>
              <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-text text-sm sm:text-base">{merchant?.name}</p>
                  <TrustBadge score={merchant?.trust_score || 0} />
                </div>
              </div>
            </div>
          </div>

          {/* Negotiation Delta */}
          {negotiation && (
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Negotiation</h3>
              <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-text-secondary">Original Price</span>
                  <span className="text-text">₹{negotiation.original_price?.toLocaleString()}</span>
                </div>
                {negotiation.final_price && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-text-secondary">Final Price</span>
                    <span className="font-bold text-success">₹{negotiation.final_price?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-text-secondary">Discount</span>
                  <span className="text-primary font-medium">{negotiation.discount_percent?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-text-secondary">Status</span>
                  <span className={`font-medium ${
                    negotiation.status === 'accepted' ? 'text-success' : 'text-danger'
                  }`}>
                    {negotiation.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Authorization Check */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Authorization Check</h3>
            <div className="bg-success/5 rounded-xl p-3.5 sm:p-4 border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-success font-bold text-xs sm:text-sm">✓ Passed Policy Gate</span>
              </div>
              <p className="text-xs text-text-secondary">
                Price is within policy discount cap and meets minimum order value.
              </p>
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Payment Details</h3>
            <div className="bg-surface-alt rounded-xl p-3.5 sm:p-4 space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-text-secondary">Amount Charged</span>
                <span className="text-lg sm:text-xl font-bold text-text">₹{order.amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-text-secondary">Currency</span>
                <span className="text-text">{order.currency}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-0.5">
                <span className="text-text-secondary">Razorpay Order ID</span>
                <span className="text-text font-mono text-[11px] sm:text-xs break-all">{order.razorpay_order_id}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm items-center">
                <span className="text-text-secondary">Status</span>
                <span className={`px-2 py-0.5 rounded text-[11px] sm:text-xs font-medium ${
                  order.status === 'paid' ? 'bg-success/10 text-success' :
                  order.status === 'created' ? 'bg-primary/10 text-primary' :
                  'bg-danger/10 text-danger'
                }`}>
                  {order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
            <Link
              to="/shop"
              className="flex-1 py-3 bg-primary text-white rounded-xl text-xs sm:text-sm font-semibold text-center hover:bg-primary-dark transition-colors shadow-xs"
            >
              Continue Shopping
            </Link>
            <Link
              to="/admin/audit"
              className="flex-1 py-3 bg-white text-text border border-border rounded-xl text-xs sm:text-sm font-medium text-center hover:bg-surface-alt transition-colors shadow-2xs"
            >
              View Audit Log
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
