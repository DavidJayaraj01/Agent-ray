import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchMyOrders } from '../api/client';
import { useAuthStore } from '../stores/authStore';

export default function MyOrders() {
  const { user } = useAuthStore();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['myOrders'],
    queryFn: fetchMyOrders,
    enabled: !!user,
  });

  const orderList = orders || [];

  return (
    <div className="max-w-5xl mx-auto my-8 px-4 sm:px-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-light-blue text-primary text-[10px] font-bold rounded-full border border-primary/20">
              PURCHASE HISTORY
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight mt-1">My AI Orders</h1>
          <p className="text-xs text-text-secondary">
            View orders, verified payment receipts, and automated agent negotiations.
          </p>
        </div>

        <Link
          to="/shop"
          className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-full shadow-xs transition-colors self-start sm:self-auto"
        >
          Browse Marketplace +
        </Link>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs text-text-secondary">Retrieving your order history...</span>
        </div>
      ) : orderList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-border space-y-4">
          <div className="text-4xl">🛍️</div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-text">No orders placed yet</div>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              You haven’t completed any purchases. Find items in the AI Shop and let the agent negotiate the best price for you!
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/shop"
              className="inline-flex px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-full shadow-xs transition-colors"
            >
              Start Shopping ⚡
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {orderList.map((order: any) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl sm:rounded-3xl border border-border p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-sm sm:text-base text-text">
                    Order #{order.id}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      order.status === 'paid'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : order.status === 'pending_approval'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : order.status === 'failed'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-surface-alt text-text-secondary border border-border'
                    }`}
                  >
                    {order.status === 'paid'
                      ? '✓ Paid & Verified'
                      : order.status === 'pending_approval'
                      ? '⏳ Pending Merchant Approval'
                      : order.status}
                  </span>

                  {order.merchant_name && (
                    <span className="text-xs text-text-tertiary">
                      via <span className="font-medium text-text-secondary">{order.merchant_name}</span>
                    </span>
                  )}
                </div>

                <div className="text-xs text-text">
                  <span className="font-semibold">{order.product_name || `Product ID ${order.product_id}`}</span>
                </div>

                <div className="text-[11px] text-text-tertiary flex items-center gap-3">
                  <span>
                    Date: {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'Recent'}
                  </span>
                  {order.razorpay_order_id && (
                    <span className="font-mono text-[10px] text-text-tertiary truncate max-w-[160px]">
                      {order.razorpay_order_id}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                <div className="text-base sm:text-lg font-bold text-text">
                  ₹{Number(order.amount).toLocaleString('en-IN')}
                </div>

                {order.status === 'paid' ? (
                  <Link
                    to={`/shop/receipt/${order.id}`}
                    className="px-4 py-1.5 bg-surface-alt hover:bg-surface text-text text-xs font-semibold rounded-full border border-border transition-colors inline-flex items-center gap-1"
                  >
                    View Receipt 🧾
                  </Link>
                ) : order.status === 'created' ? (
                  <Link
                    to={`/shop/negotiate/${order.product_id}`}
                    className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-full shadow-xs transition-colors"
                  >
                    Complete Checkout →
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
