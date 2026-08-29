import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores/uiStore';
import { fetchPendingOrders, approvePendingOrder, rejectPendingOrder } from '../api/client';

export default function MerchantApprovals() {
  const { id } = useParams<{ id: string }>();
  const merchantId = Number(id);
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();

  const { data: pendingOrders, isLoading } = useQuery({
    queryKey: ['merchantPendingOrders', merchantId],
    queryFn: () => fetchPendingOrders(merchantId),
    enabled: !!merchantId,
  });


  const approveMutation = useMutation({
    mutationFn: (orderId: number) => approvePendingOrder(orderId),
    onSuccess: () => {
      addToast('Order approved and released for buyer checkout!', 'success');
      queryClient.invalidateQueries({ queryKey: ['merchantPendingOrders', merchantId] });
    },
    onError: (err: any) => {
      addToast(err?.response?.data?.detail || 'Failed to approve order', 'error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (orderId: number) => rejectPendingOrder(orderId),
    onSuccess: () => {
      addToast('Order declined', 'info');
      queryClient.invalidateQueries({ queryKey: ['merchantPendingOrders', merchantId] });
    },
    onError: (err: any) => {
      addToast(err?.response?.data?.detail || 'Failed to decline order', 'error');
    },
  });

  const ordersList = pendingOrders || [];

  return (
    <div className="max-w-5xl mx-auto my-8 px-4 sm:px-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-light-blue text-primary text-[10px] font-bold rounded-full border border-primary/20">
              MANUAL POLICY QUEUE
            </span>
            {ordersList.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full">
                {ordersList.length} Requires Decision
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight mt-1">High-Value Order Approvals</h1>
          <p className="text-xs text-text-secondary">
            Review orders exceeding your store's automated ceiling (<code className="font-mono text-primary">max_auto_order</code>) and manually authorize payment release.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs text-text-secondary">Loading pending order requests...</span>
        </div>
      ) : ordersList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-border space-y-3">
          <div className="text-3xl">✅</div>
          <div className="text-sm font-semibold text-text">No pending order reviews</div>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            All current buyer agent transactions are within automated policy boundaries or have already been processed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ordersList.map((order: any) => (
            <div
              key={order.id}
              className="bg-white rounded-3xl border border-border p-6 shadow-sm hover:shadow-md transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-text">Order #{order.id}</span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200">
                      Exceeds Auto-Limit
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary">
                    Product: <span className="font-semibold text-text">{order.product_name || `Product ID ${order.product_id}`}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-text">₹{Number(order.amount).toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-text-tertiary">
                    {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
                  </div>
                </div>
              </div>

              {order.buyer_intent && (
                <div className="p-3 bg-surface-alt rounded-2xl border border-border/60 text-xs space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    Buyer Agent Intent:
                  </div>
                  <p className="text-text-secondary italic">"{order.buyer_intent}"</p>
                </div>
              )}

              <div className="pt-2 border-t border-border flex items-center justify-end gap-3">
                <button
                  onClick={() => rejectMutation.mutate(order.id)}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                  className="px-4 py-2 bg-surface-alt hover:bg-rose-50 hover:text-rose-700 text-text-secondary text-xs font-semibold rounded-full border border-border transition-colors cursor-pointer"
                >
                  Decline Order
                </button>
                <button
                  onClick={() => approveMutation.mutate(order.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-full shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {approveMutation.isPending ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <span>Release for Checkout ✓</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
