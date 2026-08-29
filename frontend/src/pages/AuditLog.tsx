import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs, fetchMerchants } from '../api/client';
import { Spinner, EmptyState } from '../components';
import { formatLocalTime, formatLocalDateTime } from '../utils/date';


export default function AuditLog() {
  const [merchantFilter, setMerchantFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: merchants } = useQuery({ queryKey: ['merchants'], queryFn: fetchMerchants });
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', merchantFilter, statusFilter],
    queryFn: () => fetchAuditLogs(
      merchantFilter ? Number(merchantFilter) : undefined,
      statusFilter || undefined,
    ),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-border">


        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            System Records
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-text tracking-tight">
            Autonomous Audit Trail
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-1">
            Tamper-evident log of every LLM proposal, policy gate verification, and settlement.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <select
            value={merchantFilter}
            onChange={e => setMerchantFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-border bg-white text-xs text-text focus:outline-none focus:border-primary shadow-2xs"
          >
            <option value="">All Merchants</option>
            {merchants?.map((m: any) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-border bg-white text-xs text-text focus:outline-none focus:border-primary shadow-2xs"
          >
            <option value="">All Decisions</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="blocked">Blocked</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !logs?.length ? (
        <EmptyState
          icon="📋"
          title="No audit entries recorded"
          description="Decisions will append here synchronously before any transaction executes."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead>
                <tr className="border-b border-border bg-surface-alt text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Decision</th>
                  <th className="px-5 py-3">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {logs.map((log: any) => (
                  <AuditRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);

  const decisionStyles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    blocked:  'bg-rose-50 text-rose-700 border-rose-200',
    info:     'bg-light-blue text-primary border-[#2F6BFF]/20',
  };

  const actorBadges: Record<string, { label: string; bg: string }> = {
    llm:    { label: '🤖 LLM Model', bg: 'bg-purple-50 text-purple-700' },
    policy: { label: '🛡️ Policy Gate', bg: 'bg-blue-50 text-blue-700' },
    system: { label: '⚙️ Core Engine', bg: 'bg-zinc-100 text-zinc-700' },
    buyer:  { label: '🛒 Buyer Agent', bg: 'bg-emerald-50 text-emerald-700' },
  };

  const actor = actorBadges[log.actor] || { label: log.actor, bg: 'bg-zinc-100 text-zinc-600' };

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="hover:bg-surface-alt/70 transition-colors cursor-pointer"
      >
        <td className="px-5 py-3.5 text-text-secondary font-mono text-[11px] whitespace-nowrap" title={formatLocalDateTime(log.timestamp)}>
          {formatLocalTime(log.timestamp)}
        </td>

        <td className="px-5 py-3.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${actor.bg}`}>
            {actor.label}
          </span>
        </td>
        <td className="px-5 py-3.5 font-mono text-text font-medium">
          {log.action}
        </td>
        <td className="px-5 py-3.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase border ${decisionStyles[log.decision] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
            {log.decision}
          </span>
        </td>
        <td className="px-5 py-3.5 text-text-secondary max-w-sm truncate">
          {log.reason || '—'}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={5} className="px-5 py-4 bg-surface-alt border-y border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-text-secondary uppercase text-[10px] tracking-wider">
                  Input Payload
                </span>
                <pre className="mt-1.5 p-3 bg-white rounded-xl border border-border overflow-x-auto text-[11px] font-mono text-text">
                  {JSON.stringify(log.input_data, null, 2)}
                </pre>
              </div>
              <div>
                <span className="font-semibold text-text-secondary uppercase text-[10px] tracking-wider">
                  Decision Output
                </span>
                <pre className="mt-1.5 p-3 bg-white rounded-xl border border-border overflow-x-auto text-[11px] font-mono text-text">
                  {JSON.stringify(log.output_data, null, 2)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
