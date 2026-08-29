import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchMerchants } from '../api/client';
import { MerchantCard, SearchBar, Spinner, Fintech3DIllustration } from '../components';

export default function Landing() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: merchants, isLoading } = useQuery({ queryKey: ['merchants'], queryFn: fetchMerchants });

  const filtered = merchants?.filter((m: any) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSearchSubmit = () => {
    if (search.trim()) {
      navigate(`/shop?q=${encodeURIComponent(search.trim())}`);
    } else {
      navigate('/shop');
    }
  };

  const handleChipClick = (term: string) => {
    navigate(`/shop?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="w-full">
      {/* ─── Hero Section with Blue Gradient & 3D Isometric Visual ─── */}
      <section className="relative bg-gradient-to-b from-[#EEF6FF] via-[#F8FBFF] to-[#FFFFFF] border-b border-border/60 pt-10 pb-14 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28 px-4 sm:px-6 overflow-hidden">
        {/* Subtle Decorative Ambient Background Blobs */}
        <div className="absolute top-0 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-10 w-52 sm:w-72 h-52 sm:h-72 bg-cyan-400/5 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Editorial Headings, Supporting Text & Search/CTA */}
            <div className="lg:col-span-6 text-left">
              {/* Subtle Platform Tag */}
              <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-white/90 border border-[#2F6BFF]/20 text-primary text-[11px] sm:text-xs font-semibold shadow-2xs mb-4 sm:mb-6">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span>Autonomous Commerce Infrastructure</span>
              </div>

              {/* Oversized Lightweight Editorial Heading */}
              <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-light text-text tracking-tight leading-[1.14] sm:leading-[1.08] mb-4 sm:mb-6">
                Make any merchant <br className="hidden sm:inline" />
                <span className="font-normal text-primary">AI-ready</span> in minutes.
              </h1>

              {/* Short Supporting Text */}
              <p className="text-sm sm:text-base lg:text-lg text-text-secondary font-normal leading-relaxed mb-6 sm:mb-8 max-w-xl">
                Normalize unstructured catalogs into machine-readable manifests, compute verifiable trust scores, and enable AI buyer agents to discover, negotiate, and settle with deterministic policy bounds.
              </p>

              {/* Large Rounded Search/CTA Component */}
              <div className="mb-4 sm:mb-5 max-w-xl">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  onSubmit={handleSearchSubmit}
                  placeholder="Ask AI: e.g. black running shoes under ₹5000"
                />
              </div>

              {/* Quick Intent Query Chips */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-text-secondary mb-6 sm:mb-8">
                <span className="text-text-tertiary text-[11px] sm:text-xs">Quick prompts:</span>
                {[
                  'running shoes under ₹5000',
                  'wireless earbuds with 2-day delivery',
                  'cotton polo shirt',
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-light-blue border border-border text-text-secondary hover:text-primary transition-colors text-[10px] sm:text-[11px]"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Key Trust Signals */}
              <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-6 pt-4 border-t border-border/60 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5 font-medium text-text text-[11px] sm:text-xs">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  AI-Normalized Catalogs
                </span>
                <span className="flex items-center gap-1.5 font-medium text-text text-[11px] sm:text-xs">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Trust Scoring
                </span>
                <span className="flex items-center gap-1.5 font-medium text-text text-[11px] sm:text-xs">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Policy-Bounded Payments
                </span>
              </div>
            </div>

            {/* Right Column: Decorative Soft 3D Isometric Illustration */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              <Fintech3DIllustration />
            </div>

          </div>
        </div>
      </section>

      {/* ─── AI-Ready Merchants Card Grid Section ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-border">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              Active Network
            </div>
            <h2 className="text-2xl sm:text-3xl font-light text-text tracking-tight">
              AI-Ready Merchants
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm mt-1 max-w-md">
              Verified merchants with standardized manifests and automated agent checkout.
            </p>
          </div>

          <button
            onClick={() => navigate('/merchant/new')}
            className="self-start sm:self-auto px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>+ Onboard Merchant</span>
          </button>
        </div>

        {isLoading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filtered?.map((m: any) => (
              <MerchantCard
                key={m.id}
                merchant={m}
                onClick={() => navigate(`/merchant/${m.id}/dashboard`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Architectural Pillars (Developer-Grade SaaS Aesthetic) ─── */}
      <section className="bg-surface-alt border-y border-border py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Deterministic Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-light text-text tracking-tight mt-2 mb-3">
              How AgentReady Guarantees Safe Autonomous Commerce
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Every stage between buyer intent, negotiation, and payment is protected by deterministic Python policies and tamper-evident audit trails.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                step: '01',
                title: 'Catalog Normalization',
                desc: 'Raw CSVs or product lists are extracted into standardized schema with field-level confidence scores.',
                tag: 'AI Parser',
              },
              {
                step: '02',
                title: 'Trust Scoring',
                desc: 'Multi-variable scoring evaluates manifest completeness, price consistency, and fulfillment track record.',
                tag: '0 - 100 Score',
              },
              {
                step: '03',
                title: 'Policy Engine Gate',
                desc: 'Strict non-LLM Python validator enforces merchant discount caps, minimum order value, and price floors.',
                tag: 'Zero Hallucination',
              },
              {
                step: '04',
                title: 'Razorpay Settlement',
                desc: 'Approved agent transactions generate secure test-mode Razorpay payment orders with complete audit logs.',
                tag: 'Test Mode API',
              },
            ].map((col) => (
              <div
                key={col.step}
                className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <span className="text-xs font-mono font-semibold text-text-tertiary">
                      {col.step}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-light-blue text-primary text-[10px] font-semibold">
                      {col.tag}
                    </span>
                  </div>
                  <h3 className="font-semibold text-text text-base mb-1.5 sm:mb-2">
                    {col.title}
                  </h3>
                  <p className="text-text-secondary text-xs leading-relaxed">
                    {col.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
