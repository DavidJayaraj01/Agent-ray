import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../api/client';
import { TrustBadge, TrustBreakdownBar, Spinner } from '../components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatLocalTime, formatLocalDateTime } from '../utils/date';


export default function MerchantDashboard() {
  const { id } = useParams<{ id: string }>();
  const merchantId = Number(id);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', merchantId],
    queryFn: () => fetchDashboard(merchantId),
  });

  if (isLoading) return <Spinner />;
  if (!data) return null;

  const { merchant, trust_breakdown, raw_match_rate, manifest_match_rate, recent_activity, product_count, flagged_count } = data;

  const chartData = [
    { name: 'Raw Catalog', matchRate: raw_match_rate },
    { name: 'AI Manifest', matchRate: manifest_match_rate },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fadeIn">
      {/* Header */}


      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Merchant Operations
            </span>
            <span className="text-text-tertiary">·</span>
            <span className="text-xs text-text-secondary">{merchant.category}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-text tracking-tight flex items-center gap-3 flex-wrap">
            <span>{merchant.name}</span>
            <TrustBadge score={merchant.trust_score} />
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <Link
            to={`/merchant/${merchantId}/growth`}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>🚀</span>
            <span>AI Growth Engine</span>
          </Link>
          <Link
            to={`/merchant/${merchantId}/certificate`}
            className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <span>🏆</span>
            <span>Agent-Ready Certificate</span>
          </Link>
          <Link
            to={`/merchant/${merchantId}/manifest`}
            className="px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text bg-white hover:bg-surface-alt border border-border rounded-xl transition-colors shadow-2xs"
          >
            Review Manifest
          </Link>
          <Link
            to={`/merchant/${merchantId}/policy`}
            className="px-3.5 py-2 text-xs font-medium bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors shadow-xs"
          >
            Policy Engine Rules
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Trust Score Breakdown */}
        <div className="bg-white rounded-2xl border border-border shadow-xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4 sm:mb-6">
              Trust Score Breakdown
            </h2>
            <div className="text-center mb-4 sm:mb-6 py-4 bg-light-blue rounded-2xl border border-[#2F6BFF]/10">
              <div className="text-4xl sm:text-5xl font-light text-text tracking-tight">
                {merchant.trust_score.toFixed(0)}
              </div>
              <div className="text-xs text-primary font-medium mt-1">Autonomous Trust Rating</div>
            </div>
            <TrustBreakdownBar label="Catalog Completeness" value={trust_breakdown.completeness} />
            <TrustBreakdownBar label="Settlement Consistency" value={trust_breakdown.settlement_consistency} />
            <TrustBreakdownBar label="Dispute Rate (inverse)" value={trust_breakdown.dispute_rate} />
            <TrustBreakdownBar label="Manifest Freshness" value={trust_breakdown.freshness} />
          </div>
        </div>

        {/* Before/After Match Rate Chart */}
        <div className="bg-white rounded-2xl border border-border shadow-xs p-5 sm:p-6">
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-text-secondary mb-1">
            Agent Match Efficiency
          </h2>
          <p className="text-xs text-text-secondary mb-4 sm:mb-6">Discovery match percentage before vs. after AI normalization</p>
          
          <div className="h-48 sm:h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5F6368' }} axisLine={{ stroke: '#E5E7EB' }} />
                <YAxis tick={{ fontSize: 11, fill: '#5F6368' }} domain={[0, 100]} axisLine={{ stroke: '#E5E7EB' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                />
                <Bar dataKey="matchRate" fill="#2F6BFF" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-around pt-4 mt-2 border-t border-border text-xs text-text-secondary">
            <div>
              <span className="font-semibold text-text">{product_count}</span> products active
            </div>
            <div>
              <span className="font-semibold text-amber-600">{flagged_count}</span> flagged for check
            </div>
          </div>
        </div>

        {/* Quick Stats & Recent AI Activity */}
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl border border-border shadow-xs p-5 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
              Catalog Metrics
            </h2>
            <div className="space-y-2.5">
              {[
                { label: 'Active Catalog Items', value: product_count, tag: 'Standardized' },
                { label: 'Low Confidence Flags', value: flagged_count, tag: flagged_count > 0 ? 'Action Needed' : 'Clean' },
                { label: 'Domain Category', value: merchant.category, tag: 'Mapped' },
                { label: 'Readiness State', value: merchant.status, tag: 'Verified' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0 text-xs">
                  <span className="text-text-secondary">{s.label}</span>
                  <span className="font-semibold text-text">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-border shadow-xs p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-3">
              Recent Activity
            </h2>
            <div className="space-y-2.5 max-h-48 overflow-y-auto">
              {recent_activity?.length > 0 ? recent_activity.map((a: any) => (
                <div key={a.id} className="flex items-start gap-2.5 text-xs py-1 border-b border-border/40 last:border-0">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                    a.decision === 'approved' ? 'bg-emerald-500' :
                    a.decision === 'blocked'  ? 'bg-rose-500' : 'bg-primary'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text">{a.action}</span>
                      <span className="text-[10px] text-text-tertiary" title={formatLocalDateTime(a.timestamp)}>
                        {formatLocalTime(a.timestamp)}
                      </span>

                    </div>
                    <p className="text-text-secondary text-[11px] truncate">{a.reason || 'Completed'}</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-text-secondary">No transaction logs recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Protocol Export & Standards Section */}
      <div className="mt-6 sm:mt-8 bg-white rounded-2xl border border-border shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                🌐 Protocol Interoperability & Ecosystem Exports
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                UAP / ACP / x402 Ready
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Export this merchant's standardized catalog into open agent commerce formats for autonomous buyer discovery.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <a
              href={`/api/export/acp/${merchantId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>📦</span>
              <span>Export ACP Envelope (JSON)</span>
            </a>
            <a
              href={`/api/export/schema-org/${merchantId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 text-xs font-semibold text-text-secondary bg-surface-alt hover:bg-zinc-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>🏷️</span>
              <span>schema.org/Product (JSON-LD)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
