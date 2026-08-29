import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPolicy, updatePolicy } from '../api/client';
import { Spinner } from '../components';
import { useUIStore } from '../stores/uiStore';

export default function PolicySettings() {
  const { id } = useParams<{ id: string }>();
  const merchantId = Number(id);
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();

  const { data: policy, isLoading } = useQuery({
    queryKey: ['policy', merchantId],
    queryFn: () => fetchPolicy(merchantId),
  });

  const [form, setForm] = useState<any>(null);
  const currentPolicy = form ?? policy;

  const updateMut = useMutation({
    mutationFn: (data: any) => updatePolicy(merchantId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['policy', merchantId], updated);
      queryClient.invalidateQueries({ queryKey: ['policy', merchantId] });
      setForm(updated);
      addToast('Policy updated successfully! Guardrails saved.', 'success');
    },
    onError: (err: any) => addToast(err?.response?.data?.detail || 'Failed to update policy', 'error'),
  });


  if (isLoading) return <Spinner />;
  if (!currentPolicy) return null;

  const handleChange = (key: string, value: any) => {
    const updated = { ...currentPolicy, [key]: value };
    setForm(updated);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 animate-fadeIn">

      <div className="flex items-center gap-2 text-xs sm:text-sm text-text-secondary mb-4 sm:mb-6 flex-wrap">
        <Link to="/" className="hover:text-primary transition-colors">Merchants</Link>
        <span>/</span>
        <Link to={`/merchant/${merchantId}/dashboard`} className="hover:text-primary transition-colors">Dashboard</Link>
        <span>/</span>
        <span>Policy Settings</span>
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-text mb-1.5 sm:mb-2">Policy Settings</h1>
      <p className="text-text-secondary text-xs sm:text-sm mb-6 sm:mb-8">
        Configure the guardrails for AI agent negotiations and automated orders
      </p>

      <div className="bg-white rounded-2xl border border-border shadow-sm p-5 sm:p-8 space-y-6 sm:space-y-8">
        {/* Max Discount */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Maximum Discount (%)</label>
          <p className="text-xs text-text-secondary mb-3">The highest discount an AI agent can offer during negotiation</p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={50}
              value={currentPolicy.max_discount}
              onChange={e => handleChange('max_discount', Number(e.target.value))}
              className="flex-1 h-2 bg-surface-alt rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="w-16 text-center font-bold text-primary text-lg">{currentPolicy.max_discount}%</span>
          </div>
        </div>

        {/* Min Price */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Minimum Price (₹)</label>
          <p className="text-xs text-text-secondary mb-3">No product can be sold below this price after negotiation</p>
          <input
            type="number"
            value={currentPolicy.min_price}
            onChange={e => handleChange('min_price', Number(e.target.value))}
            className="w-full px-4 py-3 rounded-lg border border-border bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Max Auto Order */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Max Auto-Order Amount (₹)</label>
          <p className="text-xs text-text-secondary mb-3">Orders above this amount require manual approval</p>
          <input
            type="number"
            value={currentPolicy.max_auto_order}
            onChange={e => handleChange('max_auto_order', Number(e.target.value))}
            className="w-full px-4 py-3 rounded-lg border border-border bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Negotiation Toggle */}
        <div className="flex items-center justify-between py-4 border-t border-border">
          <div>
            <label className="block text-sm font-medium text-text">Enable Negotiation</label>
            <p className="text-xs text-text-secondary mt-0.5">Allow AI buyers to negotiate on product prices</p>
          </div>
          <button
            onClick={() => handleChange('negotiation_enabled', !currentPolicy.negotiation_enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              currentPolicy.negotiation_enabled ? 'bg-primary' : 'bg-surface-alt border border-border'
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
              currentPolicy.negotiation_enabled ? 'left-6' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Safety Notice */}
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-primary">Policy Engine Protection</p>
              <p className="text-xs text-text-secondary mt-1">
                All AI negotiations are validated by a deterministic policy engine (pure Python, no LLM).
                No payment is processed unless the offer passes all policy checks.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={() => updateMut.mutate(currentPolicy)}
          disabled={updateMut.isPending}
          className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {updateMut.isPending ? 'Saving...' : 'Save Policy'}
        </button>
      </div>
    </div>
  );
}
