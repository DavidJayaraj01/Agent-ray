import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCertificate } from '../api/client';
import { Spinner } from '../components';
import { useState } from 'react';


export default function AgentReadyCertificate() {
  const { id } = useParams<{ id: string }>();
  const merchantId = Number(id);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['certificate', merchantId],
    queryFn: () => fetchCertificate(merchantId),
  });


  if (isLoading) return <Spinner />;
  if (!data) return <div className="text-center py-16 text-text-secondary">Certificate not found</div>;

  const { merchant, trust_score, certification, catalog_stats, policy_summary, capabilities } = data;
  const score = trust_score.overall;
  const bd = trust_score.breakdown;

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 animate-fadeIn">
      {/* Certificate Card */}

      <div className="bg-white rounded-3xl border-2 border-border shadow-lg overflow-hidden">
        {/* Certificate Header */}
        <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 px-6 sm:px-8 py-8 sm:py-10 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, #6366f1 0%, transparent 50%), radial-gradient(circle at 75% 75%, #8b5cf6 0%, transparent 50%)',
          }} />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-semibold mb-3">
              AgentReady Certification
            </div>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mb-1">{merchant.name}</h1>
            <p className="text-xs text-white/50">{merchant.category}</p>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-8 space-y-8">
          {/* Trust Score Ring */}
          <div className="flex flex-col items-center">
            <div className="relative w-36 h-36 mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#f4f4f5" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  stroke={certification.tier_color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-text">{score}</span>
                <span className="text-[10px] text-text-secondary uppercase tracking-wider">/100</span>
              </div>
            </div>

            <div
              className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: certification.tier_color }}
            >
              {certification.badge_text}
            </div>
            <p className="text-[10px] text-text-secondary mt-2">
              Tier: {certification.tier} · Valid until {new Date(certification.valid_until).toLocaleDateString()}
            </p>
          </div>

          {/* Score Breakdown */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">Trust Score Breakdown</h3>
            <div className="space-y-3">
              {[
                { label: 'Catalog Completeness', value: bd.completeness, weight: '35%', color: '#6366f1' },
                { label: 'Settlement Consistency', value: bd.settlement_consistency, weight: '30%', color: '#10b981' },
                { label: 'Dispute Rate (lower is better)', value: bd.dispute_rate, weight: '20%', color: '#f59e0b' },
                { label: 'Catalog Freshness', value: bd.freshness, weight: '15%', color: '#8b5cf6' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary">{item.label} <span className="text-text-tertiary">({item.weight})</span></span>
                    <span className="font-semibold text-text">{item.value.toFixed(1)}</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${item.value}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-alt rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-text">{catalog_stats.total_products}</p>
              <p className="text-[10px] text-text-secondary uppercase">Products</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-text">{catalog_stats.catalog_completeness.toFixed(0)}%</p>
              <p className="text-[10px] text-text-secondary uppercase">Completeness</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-text">{catalog_stats.flagged_products}</p>
              <p className="text-[10px] text-text-secondary uppercase">Flagged</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-text">{policy_summary.max_discount}%</p>
              <p className="text-[10px] text-text-secondary uppercase">Max Discount</p>
            </div>
          </div>

          {/* Policy Summary */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">Policy Configuration</h3>
            <div className="bg-surface-alt rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">Negotiation</span>
                <span className={`font-semibold ${policy_summary.negotiation_enabled ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {policy_summary.negotiation_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Max Auto-Order</span>
                <span className="font-semibold text-text">₹{policy_summary.max_auto_order.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Min Price Floor</span>
                <span className="font-semibold text-text">₹{policy_summary.min_price.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">Agent Capabilities</h3>
            <div className="flex flex-wrap gap-1.5">
              {capabilities.map((cap: string, i: number) => (
                <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  ✓ {cap}
                </span>
              ))}
            </div>
          </div>

          {/* Verification Hash */}
          <div className="bg-zinc-50 rounded-xl p-4 text-center border border-zinc-200/50">
            <p className="text-[9px] uppercase tracking-widest text-text-tertiary font-semibold mb-1">Verification Hash</p>
            <p className="font-mono text-sm text-text font-bold tracking-wider">{certification.verification_hash}</p>
            <p className="text-[10px] text-text-tertiary mt-1">
              Generated {new Date(certification.generated_at).toLocaleString()}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={copyUrl}
              className="w-full sm:w-auto px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer shadow-xs"
            >
              {copied ? '✓ Copied!' : '🔗 Copy Certificate URL'}
            </button>
            <Link
              to={`/merchant/${merchantId}/dashboard`}
              className="w-full sm:w-auto px-6 py-2.5 bg-white border border-border text-text-secondary rounded-xl text-xs font-medium hover:bg-surface-alt transition-colors text-center"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
