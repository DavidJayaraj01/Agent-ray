import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchMyOrders, completeTestPayment } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { formatLocalDateTime } from '../utils/date';


export default function MyOrders() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['myOrders'],
    queryFn: fetchMyOrders,
    enabled: !!user,
  });

  const payMutation = useMutation({
    mutationFn: (orderId: number) => completeTestPayment(orderId),
    onSuccess: (data) => {
      addToast(`Payment verified! (Razorpay ID: ${data.razorpay_payment_id})`, 'success');
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
    },
    onError: (err: any) => {
      addToast(err?.response?.data?.detail || 'Failed to complete payment', 'error');
    },
  });

  const orderList = orders || [];

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 space-y-6 animate-fadeIn">

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
          className="btn-3d-primary inline-flex items-center justify-center px-5 py-2 text-white text-xs font-semibold rounded-full shadow-xs transition-all self-start sm:self-auto"
        >
          Browse AI Shop +
        </Link>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs text-text-secondary">Retrieving your order history...</span>
        </div>
      ) : orderList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-border space-y-4 shadow-xs">
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
              className="btn-3d-primary inline-flex px-6 py-2.5 text-white text-xs font-semibold rounded-full shadow-xs transition-colors"
            >
              Start Shopping ⚡
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orderList.map((order: any) => {
            const formattedTime = formatLocalDateTime(order.created_at);


            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl sm:rounded-3xl border border-border p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5"
              >
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-extrabold text-sm sm:text-base text-text">
                      Order #{order.id}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        order.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          : order.status === 'pending_approval'
                          ? 'bg-amber-50 text-amber-800 border border-amber-300'
                          : order.status === 'failed'
                          ? 'bg-rose-50 text-rose-800 border border-rose-300'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {order.status === 'paid'
                        ? '✓ Paid & Verified'
                        : order.status === 'pending_approval'
                        ? '⏳ Pending Merchant Approval'
                        : order.status === 'created'
                        ? '💳 Payment Awaiting'
                        : order.status}
                    </span>

                    {order.merchant_name && (
                      <span className="text-xs text-text-tertiary">
                        via <span className="font-semibold text-text-secondary">{order.merchant_name}</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-text">
                    <span className="font-bold text-slate-800">
                      {order.product_name || `Product ID ${order.product_id}`}
                    </span>
                  </div>

                  {/* Order Metadata & Razorpay Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="text-slate-400 font-medium">Order Time:</span>
                      <span className="font-semibold text-slate-700">{formattedTime}</span>
                    </div>

                    {order.razorpay_order_id && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <span className="text-slate-400 font-medium">Razorpay Order ID:</span>
                        <span className="font-mono text-[10px] text-primary font-bold truncate">
                          {order.razorpay_order_id}
                        </span>
                      </div>
                    )}

                    {order.razorpay_payment_id && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <span className="text-slate-400 font-medium">Payment ID:</span>
                        <span className="font-mono text-[10px] text-emerald-700 font-bold truncate">
                          {order.razorpay_payment_id}
                        </span>
                      </div>
                    )}

                    {order.status === 'paid' && (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                        <span>🛡️ Verified via Razorpay Test API</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/60 shrink-0">
                  <div className="text-base sm:text-xl font-black text-slate-900">
                    ₹{Number(order.amount).toLocaleString('en-IN')}
                  </div>

                  <div className="flex items-center gap-2">
                    {order.status === 'paid' ? (
                      <Link
                        to={`/shop/receipt/${order.id}`}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all inline-flex items-center gap-1.5"
                      >
                        <span>View Receipt</span>
                        <span>🧾</span>
                      </Link>
                    ) : order.status === 'created' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => payMutation.mutate(order.id)}
                          disabled={payMutation.isPending}
                          className="btn-3d-primary px-4 py-2 text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {payMutation.isPending ? 'Verifying...' : 'Complete Payment ⚡'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
