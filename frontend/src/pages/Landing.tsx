import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchMerchants } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { MerchantCard, Spinner, Fintech3DIllustration } from '../components';
import rayLogo from '../assets/ray-logo.png';

const CATEGORIES = [
  'All',
  'Food Delivery & Quick Commerce',
  'E-commerce & Retail',
  'Tech & Services',
];

export default function Landing() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const { data: merchants, isLoading } = useQuery({
    queryKey: ['merchants'],
    queryFn: fetchMerchants,
  });

  const filteredMerchants = merchants?.filter((m: any) => {
    if (selectedCategory === 'All') return true;
    return m.category?.toLowerCase() === selectedCategory.toLowerCase();
  });

  const handleMerchantClick = (merchant: any) => {
    const targetPath = `/shop?merchant=${merchant.id}`;
    if (!user) {
      navigate('/login', { state: { from: { pathname: targetPath } } });
    } else {
      navigate(targetPath);
    }
  };

  const handleGetStartedClick = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/shop' } } });
    } else {
      navigate('/shop');
    }
  };

  return (
    <div className="w-full">
      {/* ─── Hero Section with Blue Gradient & 3D Isometric Visual ─── */}
      <section className="relative bg-gradient-to-b from-[#EEF6FF] via-[#F8FBFF] to-[#FFFFFF] border-b border-border/60 pt-10 pb-14 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28 px-4 sm:px-6 overflow-hidden">
        {/* Subtle Decorative Ambient Background Blobs */}
        <div className="absolute top-0 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-10 w-52 sm:w-72 h-52 sm:h-72 bg-cyan-400/5 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-8 items-center">


            {/* Left Column: Editorial Headings, Supporting Text & Clean CTAs */}
            <div className="lg:col-span-6 text-left">
              {/* Subtle Platform Tag */}
              <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-white/90 border border-[#2F6BFF]/20 text-primary text-[11px] sm:text-xs font-semibold shadow-2xs mb-4 sm:mb-6">
                <img
                  src={rayLogo}
                  alt="Logo"
                  className="w-4 h-4 rounded-full object-cover shadow-2xs shrink-0"
                />
                <span>Autonomous Commerce Infrastructure</span>
              </div>

              {/* Oversized Lightweight Editorial Heading */}
              <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-light text-text tracking-tight leading-[1.14] sm:leading-[1.08] mb-4 sm:mb-6">
                Make any merchant <br className="hidden sm:inline" />
                <span className="font-normal text-primary">AI-ready</span> in minutes.
              </h1>

              {/* Short Supporting Text */}
              <p className="text-sm sm:text-base lg:text-lg text-text-secondary font-normal leading-relaxed mb-6 sm:mb-8 max-w-xl">
                Normalize unstructured catalogs into machine-readable manifests, compute verifiable
                trust scores, and enable AI buyer agents to discover, negotiate, and settle with
                deterministic policy bounds.
              </p>

              {/* Clean Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 mb-8">
                <button
                  onClick={handleGetStartedClick}
                  className="btn-3d-primary inline-flex items-center justify-center px-6 py-3 rounded-2xl text-white text-sm font-bold shadow-lg cursor-pointer"
                >
                  <span>Get Started ⚡</span>
                </button>
                <a
                  href="#merchants-section"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold border border-slate-200 shadow-xs transition-all"
                >
                  <span>View Enterprise Merchants ↓</span>
                </a>
              </div>

              {/* Key Trust Signals */}
              <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-6 pt-4 border-t border-border/60 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5 font-medium text-text text-[11px] sm:text-xs">
                  <svg
                    className="w-4 h-4 text-emerald-600 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  AI-Normalized Catalogs
                </span>
                <span className="flex items-center gap-1.5 font-medium text-text text-[11px] sm:text-xs">
                  <svg
                    className="w-4 h-4 text-emerald-600 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Trust Scoring
                </span>
                <span className="flex items-center gap-1.5 font-medium text-text text-[11px] sm:text-xs">
                  <svg
                    className="w-4 h-4 text-emerald-600 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Policy-Bounded Payments
                </span>
              </div>
            </div>

            {/* Right Column: 3D Fintech Visual Component */}
            <div className="lg:col-span-6 flex justify-center lg:justify-end">
              <Fintech3DIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Active Network / AI-Ready Merchants Section ─── */}
      <section id="merchants-section" className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 pb-4 border-b border-border text-left">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-primary font-bold mb-1">
              Razorpay Enterprise Network
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-text">AI-Ready Merchants</h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
              Verified enterprise companies with standardized manifests and automated agent discovery
            </p>
          </div>
          <div className="mt-3 sm:mt-0 text-xs text-text-tertiary font-mono">
            {filteredMerchants?.length || 0} active merchants
          </div>
        </div>

        {/* ─── Category Filter Pills ─── */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 transform -translate-y-0.5'
                  : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat === 'Food Delivery & Quick Commerce' && '🍔 '}
              {cat === 'E-commerce & Retail' && '🛍️ '}
              {cat === 'Tech & Services' && '💻 '}
              {cat}
            </button>
          ))}
        </div>

        {/* Dynamic State Grid */}
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Spinner />
          </div>
        ) : !filteredMerchants || filteredMerchants.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-border">
            <p className="text-text-secondary text-sm">No merchants found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMerchants.map((merchant: any) => (
              <MerchantCard
                key={merchant.id}
                merchant={merchant}
                onClick={() => handleMerchantClick(merchant)}
              />
            ))}
          </div>
        )}
      </section>


    </div>
  );
}
