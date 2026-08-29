import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores/uiStore';
import {
  fetchMerchantApplications,
  approveMerchantApplication,
  rejectMerchantApplication,
} from '../api/client';

export default function AdminApprovals() {
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const { data: applications, isLoading } = useQuery({
    queryKey: ['adminMerchantApplications'],
    queryFn: fetchMerchantApplications,
  });


  const approveMutation = useMutation({
    mutationFn: (uid: string) => approveMerchantApplication(uid),
    onSuccess: (data) => {
      addToast(data.message || 'Merchant approved successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['adminMerchantApplications'] });
    },
    onError: (err: any) => {
      addToast(err?.response?.data?.detail || 'Failed to approve application', 'error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ uid, reason }: { uid: string; reason?: string }) =>
      rejectMerchantApplication(uid, reason),
    onSuccess: () => {
      addToast('Application rejected', 'info');
      queryClient.invalidateQueries({ queryKey: ['adminMerchantApplications'] });
    },
    onError: (err: any) => {
      addToast(err?.response?.data?.detail || 'Failed to reject application', 'error');
    },
  });

  const appsList = applications || [];
  const filteredApps = appsList.filter((app: any) => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const pendingCount = appsList.filter((a: any) => a.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto my-8 px-4 sm:px-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full border border-rose-200">
              ADMINISTRATION
            </span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full">
                {pendingCount} Pending Review
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight mt-1">Merchant Approvals</h1>
          <p className="text-xs text-text-secondary">
            Review onboarding applications, verify merchant credentials, and grant store ownership.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-full border border-border shadow-2xs self-start sm:self-auto">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text hover:bg-surface-alt'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs text-text-secondary">Loading applications...</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-border space-y-3">
          <div className="text-3xl">📭</div>
          <div className="text-sm font-semibold text-text">No {filter} applications</div>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            When buyers apply to list their store on AgentReady, their submissions will appear here for review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredApps.map((app: any) => (
            <div
              key={app.uid}
              className="bg-white rounded-3xl border border-border p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-text">{app.businessName}</h3>
                    <span className="inline-block mt-0.5 text-[11px] font-medium text-text-secondary bg-surface-alt px-2 py-0.5 rounded-md border border-border/60">
                      {app.category}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      app.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : app.status === 'rejected'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                {app.description && (
                  <p className="text-xs text-text-secondary leading-relaxed bg-surface-alt p-3 rounded-xl border border-border/50">
                    "{app.description}"
                  </p>
                )}

                <div className="text-xs space-y-1 text-text-tertiary pt-1 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <span>Applicant Email:</span>
                    <span className="font-medium text-text">{app.email}</span>
                  </div>
                  {app.displayName && (
                    <div className="flex items-center justify-between">
                      <span>Display Name:</span>
                      <span className="text-text">{app.displayName}</span>
                    </div>
                  )}
                  {app.catalogUrl && (
                    <div className="flex items-center justify-between">
                      <span>Catalog URL:</span>
                      <a
                        href={app.catalogUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline font-medium truncate max-w-[200px]"
                      >
                        {app.catalogUrl}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>Submitted:</span>
                    <span>{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {app.status === 'pending' && (
                <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => {
                      const reason = window.prompt('Optional rejection reason:', 'Catalog requirements not met');
                      if (reason !== null) {
                        rejectMutation.mutate({ uid: app.uid, reason });
                      }
                    }}
                    disabled={rejectMutation.isPending || approveMutation.isPending}
                    className="px-4 py-2 bg-surface-alt hover:bg-rose-50 hover:text-rose-700 text-text-secondary text-xs font-semibold rounded-full border border-border transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(app.uid)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-full shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {approveMutation.isPending ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <span>✓ Approve Store</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
