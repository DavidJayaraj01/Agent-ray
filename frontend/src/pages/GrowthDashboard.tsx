import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchGrowthData } from '../api/client';
import { Spinner, MerchantLogo } from '../components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function GrowthDashboard() {
  const { id } = useParams<{ id: string }>();
  const merchantId = Number(id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['growth', merchantId],
    queryFn: () => fetchGrowthData(merchantId),
  });


  if (isLoading) return <Spinner />;
  if (error || !data) return <div className="text-center py-16 text-text-secondary">Failed to load growth data</div>;

  const { cross_sell_opportunities, pricing_outliers, cart_recovery_nudges, gmv_simulation } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fadeIn">
      {/* Header */}


      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-3 sm:gap-4">
          <MerchantLogo name={data.merchant_name} size="lg" className="shadow-lg ring-2 ring-white/80" />
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">🚀 AI Growth Agent</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-light text-text tracking-tight">{data.merchant_name}</h1>
            <p className="text-xs text-text-secondary mt-1">{data.product_count} products analyzed · Proactive revenue optimization</p>
          </div>
        </div>
        <Link
          to={`/merchant/${merchantId}/dashboard`}
          className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text bg-white border border-border rounded-xl transition-colors shadow-2xs"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* GMV Before/After */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">📊</span>
          <h2 className="font-semibold text-text">GMV Simulation: Baseline vs Agent-Assisted (90 days)</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-50 rounded-xl p-3.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold mb-1">Baseline GMV</p>
            <p className="text-lg font-bold text-text">₹{(gmv_simulation.baseline_gmv / 100000).toFixed(1)}L</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3.5 text-center border border-emerald-200/50">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">Agent-Assisted</p>
            <p className="text-lg font-bold text-emerald-700">₹{(gmv_simulation.agent_gmv / 100000).toFixed(1)}L</p>
          </div>
          <div className="bg-primary/5 rounded-xl p-3.5 text-center border border-primary/15">
            <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">GMV Uplift</p>
            <p className="text-lg font-bold text-primary">+{gmv_simulation.uplift_pct}%</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Revenue Gain</p>
            <p className="text-lg font-bold text-amber-700">₹{(gmv_simulation.uplift_absolute / 1000).toFixed(0)}K</p>
          </div>
        </div>

        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gmv_simulation.weekly_breakdown} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: any) => `₹${Number(value ?? 0).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="baseline" fill="#d4d4d8" name="Baseline" radius={[3, 3, 0, 0]} />
              <Bar dataKey="agent_assisted" fill="#6366f1" name="Agent-Assisted" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cross-Sell Opportunities */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🔗</span>
            <h2 className="font-semibold text-text text-sm">Cross-Sell Opportunities</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{cross_sell_opportunities.length}</span>
          </div>
          <div className="space-y-3">
            {cross_sell_opportunities.map((cs: any, i: number) => (
              <div key={i} className="bg-surface-alt rounded-xl p-3.5 hover:bg-primary/5 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-text">{cs.primary.name}</p>
                    <p className="text-[10px] text-primary font-medium mt-0.5">+ {cs.recommended.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-emerald-600">{cs.attach_rate_pct}</span>
                    <p className="text-[10px] text-text-secondary">attach rate</p>
                  </div>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">{cs.reason}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    +₹{cs.revenue_uplift_per_order.toLocaleString()} per order
                  </span>
                </div>
              </div>
            ))}
            {cross_sell_opportunities.length === 0 && (
              <p className="text-xs text-text-secondary text-center py-4">No cross-sell opportunities detected for this catalog.</p>
            )}
          </div>
        </div>

        {/* Pricing Outliers */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📈</span>
            <h2 className="font-semibold text-text text-sm">Pricing Outliers vs Category Benchmark</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">{pricing_outliers.length}</span>
          </div>
          <div className="space-y-3">
            {pricing_outliers.map((o: any, i: number) => (
              <div key={i} className={`rounded-xl p-3.5 border ${
                o.status === 'overpriced' ? 'bg-rose-50/50 border-rose-200/50' : 'bg-emerald-50/50 border-emerald-200/50'
              }`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-xs font-semibold text-text">{o.product.name}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    o.status === 'overpriced' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {o.status === 'overpriced' ? '↑' : '↓'} {Math.abs(o.deviation_pct)}%
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-text-secondary mb-1.5">
                  <span>Price: ₹{o.product.price.toLocaleString()}</span>
                  <span>Median: ₹{o.category_median.toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">{o.recommendation}</p>
              </div>
            ))}
            {pricing_outliers.length === 0 && (
              <p className="text-xs text-text-secondary text-center py-4">All products are priced within category benchmarks.</p>
            )}
          </div>
        </div>
      </div>

      {/* Cart Recovery Nudges */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-5 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🛒</span>
          <h2 className="font-semibold text-text text-sm">Cart Recovery Nudges (Policy-Gated)</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cart_recovery_nudges.map((n: any, i: number) => (
            <div key={i} className={`rounded-xl p-3.5 border ${
              n.policy_approved ? 'bg-emerald-50/30 border-emerald-200/50' : 'bg-rose-50/30 border-rose-200/50'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-text leading-snug flex-1">{n.product.name}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  n.policy_approved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {n.policy_approved ? '✓ Approved' : '✕ Blocked'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xs text-text-secondary line-through">₹{n.product.price.toLocaleString()}</span>
                <span className="text-sm font-bold text-text">₹{n.nudge_price.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-emerald-600">-{n.discount_pct}%</span>
              </div>
              <p className="text-[10px] text-text-secondary leading-relaxed italic">"{n.nudge_message}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
