import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createMerchant, generateManifest, computeTrustScore } from '../api/client';
import { useUIStore } from '../stores/uiStore';

const STEPS = ['Store Details', 'Upload Catalog', 'AI Manifest Generation'];

export default function MerchantOnboarding() {
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', category: 'General', raw_catalog_text: '' });
  const [merchantId, setMerchantId] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ label: string; done: boolean; count?: string }[]>([]);

  const createMut = useMutation<any, Error, { name: string; category: string; raw_catalog_text?: string }>({
    mutationFn: (data) => createMerchant(data),
  });
  const manifestMut = useMutation<any, Error, number>({
    mutationFn: (id) => generateManifest(id),
  });
  const trustMut = useMutation<any, Error, number>({
    mutationFn: (id) => computeTrustScore(id),
  });


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setForm({ ...form, raw_catalog_text: ev.target?.result as string });
      reader.readAsText(file);
    }
  };

  const handleSubmit = async () => {
    if (step === 0) {
      if (!form.name.trim()) return addToast('Please enter a merchant name', 'error');
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!form.raw_catalog_text.trim()) return addToast('Please upload or paste a catalog', 'error');
      setStep(2);

      // Start processing
      setProgress([
        { label: 'Registering merchant profile', done: false },
        { label: 'Extracting & normalizing catalog data', done: false },
        { label: 'Computing trust baseline & policy verification', done: false },
      ]);

      try {
        // Step 1: Create merchant
        const merchant = await createMut.mutateAsync(form);
        setMerchantId(merchant.id);
        setProgress(p => p.map((s, i) => i === 0 ? { ...s, done: true } : s));

        // Step 2: Generate manifest
        await new Promise(r => setTimeout(r, 600));
        const result = await manifestMut.mutateAsync(merchant.id);
        const norm = result.products?.length ?? 0;
        const flagged = result.manifest?.flagged_count ?? 0;
        setProgress(p => p.map((s, i) => i === 1 ? {
          ...s, done: true,
          count: `${norm} items normalized, ${flagged} flagged for inspection`
        } : s));

        // Step 3: Trust score
        await new Promise(r => setTimeout(r, 500));
        const trust = await trustMut.mutateAsync(merchant.id);
        setProgress(p => p.map((s, i) => i === 2 ? {
          ...s, done: true,
          count: `Trust score: ${trust.overall}/100`
        } : s));

        addToast('Merchant onboarded successfully!', 'success');
      } catch (err: any) {
        addToast(err?.response?.data?.detail || 'Processing failed', 'error');
      }
    }
  };

  return (
    <div className="w-full max-w-[1300px] mx-auto px-4 sm:px-8 lg:px-12 py-10 animate-fadeIn">
      {/* Header */}

      <div className="text-center max-w-lg mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-light-blue border border-[#2F6BFF]/20 text-primary text-xs font-semibold shadow-2xs mb-3">
          <span>Catalog Normalization Engine</span>
        </div>
        <h1 className="text-3xl font-light text-text tracking-tight mb-2">
          List Your Store on AgentReady
        </h1>
        <p className="text-text-secondary text-xs sm:text-sm">
          Convert messy product inventories into machine-negotiable agent manifests.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              i < step ? 'bg-emerald-500 text-white' :
              i === step ? 'bg-primary text-white shadow-xs' :
              'bg-surface-alt text-text-tertiary border border-border'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs ${i === step ? 'font-semibold text-text' : 'text-text-secondary'} hidden sm:inline`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 sm:w-12 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>      {/* Form Container */}
      <div className="bg-white rounded-2xl border border-border shadow-xs p-4 sm:p-8">
        {/* Step 1: Store Details */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">Store Information</h2>
              <p className="text-text-secondary text-xs">Specify store identity and product category.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Merchant / Brand Name
              </label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Acme Tech Gear"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:border-primary shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Domain Category
              </label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text focus:outline-none focus:border-primary shadow-2xs"
              >
                {[
                  'General',
                  'Sports & Fitness',
                  'Fashion & Ethnic Wear',
                  'Electronics & Gadgets',
                  'Home & Living',
                  'Books & Media',
                ].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Upload Catalog */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">Upload Product Inventory</h2>
              <p className="text-text-secondary text-xs">Supply a raw CSV file or paste messy catalog text below.</p>
            </div>

            {/* CSV Dropzone */}
            <div className="border border-dashed border-border rounded-xl p-6 text-center bg-surface-alt/40 hover:bg-surface-alt transition-colors">
              <svg className="w-8 h-8 mx-auto text-primary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <label className="cursor-pointer text-primary font-medium text-xs hover:underline">
                Upload CSV file
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
              <p className="text-[11px] text-text-secondary mt-1">Accepts CSV, TSV, or raw delimited lists</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Or Paste Raw Data
              </label>
              <textarea
                value={form.raw_catalog_text}
                onChange={e => setForm({ ...form, raw_catalog_text: e.target.value })}
                placeholder={`name,price,stock,category,delivery_days\nRunning Shoes,2999,50,Footwear,3\nWireless Headphones,1499,30,Electronics,2`}
                rows={6}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-xs font-mono text-text placeholder:text-text-tertiary focus:outline-none focus:border-primary shadow-2xs"
              />
            </div>
          </div>
        )}

        {/* Step 3: Normalization Progress */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">Catalog Normalization Progress</h2>
              <p className="text-text-secondary text-xs">Deterministic Python engine and trust scorer executing pipeline.</p>
            </div>

            <div className="space-y-4">
              {progress.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 bg-surface-alt rounded-xl border border-border">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    p.done ? 'bg-emerald-500 text-white' : 'bg-primary/20 text-primary animate-spin'
                  }`}>
                    {p.done ? '✓' : '⟳'}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs ${p.done ? 'text-text font-semibold' : 'text-text-secondary'}`}>{p.label}</p>
                    {p.count && <p className="text-[11px] text-text-secondary mt-0.5 font-mono">{p.count}</p>}
                  </div>
                </div>
              ))}
            </div>

            {progress.every(p => p.done) && merchantId && (
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => navigate(`/merchant/${merchantId}/manifest`)}
                  className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  Inspect Manifest
                </button>
                <button
                  onClick={() => navigate(`/merchant/${merchantId}/dashboard`)}
                  className="flex-1 py-2.5 px-4 bg-white hover:bg-surface-alt text-text border border-border rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                >
                  View Merchant Dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        {step < 2 && (
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-border">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : navigate('/')}
              className="px-5 py-2.5 text-xs font-medium text-text-secondary border border-border rounded-xl hover:bg-surface-alt transition-colors shadow-2xs cursor-pointer text-center"
            >
              {step > 0 ? '← Back' : 'Cancel'}
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer text-center"
            >
              {step === 1 ? 'Start AI Normalization' : 'Next Step →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
