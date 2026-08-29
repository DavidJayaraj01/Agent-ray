import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { applyAsMerchant, fetchApplicationStatus } from '../api/client';

export default function MerchantApply() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuthStore();
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('Fashion & Apparel');
  const [description, setDescription] = useState('');
  const [catalogUrl, setCatalogUrl] = useState('');

  const { data: appStatus, isLoading } = useQuery({
    queryKey: ['merchantApplicationStatus'],
    queryFn: fetchApplicationStatus,
    enabled: !!user,
  });

  const applyMutation = useMutation({
    mutationFn: applyAsMerchant,
    onSuccess: () => {
      addToast('Application submitted successfully! Our administrators will review your store.', 'success');
      queryClient.invalidateQueries({ queryKey: ['merchantApplicationStatus'] });
    },
    onError: (err: any) => {
      addToast(err?.response?.data?.detail || 'Failed to submit application', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      addToast('Please enter your business or brand name', 'error');
      return;
    }
    applyMutation.mutate({
      business_name: businessName.trim(),
      category,
      description: description.trim(),
      catalog_url: catalogUrl.trim(),
    });
  };

  if (user?.role === 'merchant') {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-border shadow-md text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl">
          🎉
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text">You Are an Approved Merchant</h2>
          <p className="text-xs text-text-secondary">
            Your merchant account is active and verified on the AgentReady platform.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => navigate(`/merchant/${user.merchantId}/dashboard`)}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-full shadow-xs transition-colors cursor-pointer"
          >
            Go to Merchant Dashboard →
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs text-text-secondary">Checking application status...</span>
      </div>
    );
  }

  if (appStatus?.status === 'pending') {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-border shadow-md text-center space-y-6 animate-fadeIn">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl animate-pulse">
          ⏳
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-800 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Under Admin Review
          </div>
          <h2 className="text-xl font-bold text-text">Application Pending Review</h2>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Your store application for <span className="font-semibold text-text">"{appStatus.business_name}"</span> has been received. Our team will verify your catalog and elevate your account to Merchant.
          </p>
        </div>

        <div className="p-4 bg-surface-alt rounded-2xl border border-border text-left text-xs space-y-2">
          <div className="flex items-center justify-between text-text-secondary">
            <span>Submitted Account:</span>
            <span className="font-medium text-text">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between text-text-secondary">
            <span>Application Date:</span>
            <span className="font-medium text-text">
              {appStatus.created_at ? new Date(appStatus.created_at).toLocaleDateString() : 'Today'}
            </span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => refreshProfile()}
            className="px-5 py-2 bg-surface-alt hover:bg-surface text-text text-xs font-semibold rounded-full border border-border transition-colors cursor-pointer"
          >
            Check Status ↻
          </button>
          <Link
            to="/shop"
            className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-full shadow-xs transition-colors"
          >
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto my-8 px-4 sm:px-8 lg:px-12 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-border shadow-lg p-6 sm:p-10 space-y-8">

        {/* Header */}
        <div className="space-y-2 border-b border-border/80 pb-6">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-light-blue text-primary text-[10px] font-bold rounded-full border border-primary/20">
              MERCHANT APPLICATION
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Become an AgentReady Merchant</h1>
          <p className="text-xs text-text-secondary leading-relaxed">
            Sell directly to AI buyer agents, configure automated negotiation policies, and protect your margins with deterministic rules.
          </p>
        </div>

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text">
              Business / Store Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Acme Tech Direct, Artisanal Silk Hub"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface-alt text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface-alt text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="Fashion & Apparel">Fashion & Apparel</option>
              <option value="Consumer Electronics">Consumer Electronics</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
              <option value="Sports & Outdoors">Sports & Outdoors</option>
              <option value="Health & Beauty">Health & Beauty</option>
              <option value="General Retail">General Retail</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text">Store Description & Value Proposition</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell buyer agents what products you specialize in, return policies, and unique advantages..."
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface-alt text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text">Product Catalog / Website URL (Optional)</label>
            <input
              type="url"
              value={catalogUrl}
              onChange={(e) => setCatalogUrl(e.target.value)}
              placeholder="https://yourstore.com or Meesho/Amazon store link"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface-alt text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="p-4 rounded-2xl bg-surface-alt border border-border/80 space-y-2 text-xs text-text-secondary">
            <div className="font-semibold text-text flex items-center gap-1.5">
              <span>🛡️</span> Role Assignment Security Policy
            </div>
            <p className="text-[11px] leading-relaxed">
              Merchant roles cannot be self-assigned. Submitting this application creates a pending record for administrative verification. You will be notified when your store is approved.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-xs font-medium text-text-secondary hover:text-text hover:bg-surface-alt rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={applyMutation.isPending}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-full shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {applyMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Merchant Application 🚀</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
