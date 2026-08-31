import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { parseIntent, matchProducts, fetchManifest, fetchMerchants, fetchProducts } from '../api/client';
import { ProductCard, SearchBar, Spinner, EmptyState, MerchantLogo } from '../components';

const CATEGORIES = [
  { id: 'All', label: 'All Categories', icon: '✨', tagline: 'Unified Multi-Source Marketplace' },
  { id: 'Food Delivery & Quick Commerce', label: 'Food Delivery & Quick Commerce', icon: '🍔', tagline: 'Zomato, Swiggy & Zepto — Fast Food, Groceries & Beverages' },
  { id: 'E-commerce & Retail', label: 'E-commerce & Retail', icon: '🛍️', tagline: 'Meesho, Amazon, Flipkart, Nykaa & SpiceJet — Fashion, Tech & Lifestyle' },
  { id: 'Tech & Services', label: 'Tech & Services', icon: '💻', tagline: 'Meta, Urban Company & Coursera — Pro Services, Cloud & Learning' },
];

const CATEGORY_PROMPTS: Record<string, Array<{ text: string; label: string }>> = {
  'All': [
    { text: 'Nike Air Zoom Pegasus running shoes under ₹9,000', label: '👟 Running Shoes' },
    { text: 'Royal Awadhi Dum Biryani Feast for 2', label: '🍲 Awadhi Biryani' },
    { text: 'Apple iPad 10th Gen Liquid Retina 64GB', label: '📱 Apple iPad' },
    { text: 'Complete Home Deep Cleaning 3 BHK Villa', label: '🧹 3BHK Deep Clean' },
    { text: 'Sony WH-1000XM5 wireless noise cancelling headphones', label: '🎧 Sony Headphones' },
  ],
  'Food Delivery & Quick Commerce': [
    { text: 'Royal Awadhi Dum Biryani Feast', label: '🍲 Biryani Feast' },
    { text: 'Authentic Wood-Fired Margherita Gourmet Pizza', label: '🍕 Gourmet Pizza' },
    { text: 'Grade A Ratnagiri Alphonso Mangoes 3kg box', label: '🥭 Alphonso Mangoes' },
    { text: 'Nescafe Gold Rich Craft Coffee Jar', label: '☕ Nescafe Gold' },
    { text: 'Starbucks Signature Caramel Cold Brew 4 bottles', label: '🥤 Caramel Cold Brew' },
    { text: 'Amul Pure Desi Ghee 1L Tin with Cow Milk', label: '🥛 Amul Pure Ghee' },
  ],
  'E-commerce & Retail': [
    { text: 'Nike Air Zoom Pegasus 40 Men Road Running Shoes', label: '👟 Nike Pegasus 40' },
    { text: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones', label: '🎧 Sony XM5 Headphones' },
    { text: 'Georgette Floral Print Anarkali Flared Dress', label: '👗 Anarkali Dress' },
    { text: 'Apple iPad 10th Gen 10.9-inch Liquid Retina Display', label: '📱 Apple iPad 10th Gen' },
    { text: 'Estee Lauder Advanced Night Repair Recovery Complex', label: '✨ Estee Lauder Serum' },
    { text: 'Puma RS-X Reinvention Unisex Retro Sneakers', label: '👟 Puma Retro Sneakers' },
  ],
  'Tech & Services': [
    { text: 'Complete Home Deep Cleaning & Sanitization 3 BHK Villa', label: '🧹 3 BHK Deep Clean' },
    { text: 'Google Data Analytics Professional Certificate', label: '🎓 Google Data Certificate' },
    { text: 'Premium AC Foam Jet Master Servicing & Gas Leak Test', label: '❄️ AC Jet Servicing' },
    { text: 'DeepLearning.AI Generative AI & LLM Engineering MasterTrack', label: '🤖 GenAI MasterTrack' },
    { text: 'Salon Classic Keratin Hair Spa & Glow Facial for Women', label: '💆‍♀️ Salon at Home' },
    { text: 'Meta Verified Business Subscription Blue Badge', label: '🔷 Meta Verified' },
  ],
};

export default function BuyerSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const merchantParam = searchParams.get('merchant');
  const merchantId = merchantParam ? parseInt(merchantParam, 10) : null;
  const initialCategory = searchParams.get('category') || 'All';
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<any>(null);
  const [parsedIntent, setParsedIntent] = useState<any>(null);

  // Fetch all merchants for filtering and name resolution
  const { data: merchants } = useQuery({
    queryKey: ['merchants'],
    queryFn: fetchMerchants,
  });

  const selectedMerchant = merchants?.find((m: any) => m.id === merchantId);

  // Merchants belonging to currently active category
  const filteredCategoryMerchants = merchants?.filter((m: any) => {
    if (selectedCategory === 'All') return true;
    return m.category?.toLowerCase() === selectedCategory.toLowerCase();
  }) || [];

  // Fetch store manifest products if arriving with specific merchantId
  const { data: manifestData, isLoading: manifestLoading } = useQuery({
    queryKey: ['merchantManifest', merchantId],
    queryFn: () => (merchantId ? fetchManifest(merchantId) : null),
    enabled: !!merchantId && !results,
  });

  // Fetch categorized products feed when browsing categories without search
  const { data: feedProducts, isLoading: feedLoading } = useQuery({
    queryKey: ['productsFeed', selectedCategory, merchantId],
    queryFn: () =>
      fetchProducts({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        merchant_id: merchantId || undefined,
      }),
    enabled: !results,
  });

  const searchMut = useMutation({
    mutationFn: async (q: string) => {
      const intent = await parseIntent(q);
      setParsedIntent(intent);
      const constraints = {
        ...(intent.parsed_constraints || {}),
        merchant_id: merchantId || undefined,
        category: selectedCategory === 'All' ? undefined : selectedCategory,
      };
      const matches = await matchProducts(constraints, intent.id);
      return matches;
    },
    onSuccess: (data) => setResults(data),
  });

  const handleSearch = (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setQuery(q);
    searchMut.mutate(q.trim());
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    setResults(null);
    setParsedIntent(null);
    const newParams = new URLSearchParams(searchParams);
    if (catId === 'All') {
      newParams.delete('category');
    } else {
      newParams.set('category', catId);
    }
    setSearchParams(newParams);
  };

  const handleSelectMerchant = (mId: number | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (mId) {
      newParams.set('merchant', String(mId));
    } else {
      newParams.delete('merchant');
    }
    setSearchParams(newParams);
    setResults(null);
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults(null);
    setParsedIntent(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('q');
    setSearchParams(newParams);
  };

  // Auto-search if query param exists on initial load
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      searchMut.mutate(q);
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Current active prompts based on selected category
  const activePrompts = CATEGORY_PROMPTS[selectedCategory] || CATEGORY_PROMPTS['All'];
  const activeCategoryMeta = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];

  return (
    <div className="w-full">
      {/* ─── Search Hero with Blue Gradient ─── */}
      <section className="bg-gradient-to-b from-[#EEF6FF] via-[#F8FBFF] to-[#FFFFFF] border-b border-border/60 pt-8 pb-10 sm:pt-12 sm:pb-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#2F6BFF]/20 text-primary text-[11px] sm:text-xs font-semibold shadow-2xs mb-3 sm:mb-4">
            {selectedMerchant ? (
              <>
                <MerchantLogo
                  name={selectedMerchant.name}
                  category={selectedMerchant.category}
                  size="xs"
                  showShadow={false}
                />
                <span>{selectedMerchant.name} AI-Ready Storefront</span>
              </>
            ) : (
              <span>🤖 Multi-Source AI Buyer Discovery</span>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 mb-2 sm:mb-3 flex-wrap">
            {selectedMerchant && (
              <MerchantLogo
                name={selectedMerchant.name}
                category={selectedMerchant.category}
                size="lg"
                className="shadow-lg ring-2 ring-white/90"
              />
            )}
            <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-light text-text tracking-tight">
              {selectedMerchant
                ? `${selectedMerchant.name} Storefront`
                : 'Autonomous Product Discovery'}
            </h1>
          </div>
          <p className="text-text-secondary text-xs sm:text-sm md:text-base font-normal max-w-xl mx-auto mb-6 sm:mb-7 leading-relaxed">
            {selectedMerchant
              ? `Explore AI-normalized items from ${selectedMerchant.name} with real-time policy-bounded negotiations.`
              : 'Shop across Food Delivery, E-commerce & Tech Services in one unified AI checkout platform.'}
          </p>

          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={() => handleSearch()}
            placeholder={
              selectedMerchant
                ? `Search within ${selectedMerchant.name}...`
                : `Search ${selectedCategory === 'All' ? 'products across all stores' : selectedCategory}...`
            }
          />

          {/* ─── Category-Tailored Quick Search Prompts ─── */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">
              Try asking:
            </span>
            {activePrompts.slice(0, 4).map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSearch(p.text)}
                className="px-3 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-primary text-[11px] font-medium rounded-full border border-slate-200 shadow-2xs transition-all cursor-pointer hover:border-blue-300"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ─── 3D CATEGORY SELECTOR PILLS (Food, E-commerce, Tech) ─── */}
        <div className="mb-6 pb-6 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ecosystem Categories
              </h2>
              <p className="text-xs text-slate-400">
                {activeCategoryMeta.tagline}
              </p>
            </div>
            {results && (
              <button
                onClick={handleClearSearch}
                className="self-start sm:self-auto text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>✕ Clear search results</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-xs ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 transform -translate-y-0.5 ring-2 ring-blue-400/40'
                      : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* ─── Verified Source Platforms for Selected Category ─── */}
          {filteredCategoryMerchants.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-dashed border-slate-200 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Source Platforms:
              </span>
              <button
                onClick={() => handleSelectMerchant(null)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  !merchantId
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                ✨ All Platforms ({filteredCategoryMerchants.length})
              </button>

              {filteredCategoryMerchants.map((m: any) => {
                const isCurrentMerchant = merchantId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMerchant(m.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isCurrentMerchant
                        ? 'bg-blue-50 border-primary text-primary font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <MerchantLogo name={m.name} category={m.category} size="xs" showShadow={false} />
                    <span>{m.name.split(' ')[0]}</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded-md">
                      ★{m.trust_score?.toFixed(0) || 94}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Parsed Intent Diagnostic Card ─── */}
        {parsedIntent && (
          <div className="bg-white rounded-2xl border border-border p-4 sm:p-5 mb-6 sm:mb-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-light-blue text-primary flex items-center justify-center font-mono text-[10px]">
                  AI
                </span>
                Parsed Constraints
              </h3>
              <span className="text-[10px] sm:text-[11px] font-mono text-text-tertiary">
                Intent ID #{parsedIntent.id}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
              {Object.entries(parsedIntent.parsed_constraints || {}).map(
                ([key, val]: [string, any]) => {
                  if (val === null || (Array.isArray(val) && val.length === 0)) return null;
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 bg-light-blue rounded-full text-[11px] sm:text-xs text-text border border-[#2F6BFF]/10"
                    >
                      <span className="text-text-secondary capitalize">{key}:</span>
                      <span className="font-semibold text-primary">
                        {Array.isArray(val) ? val.join(', ') : String(val)}
                      </span>
                    </span>
                  );
                }
              )}
            </div>

            {parsedIntent.keywords?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40">
                <span className="text-[11px] text-text-secondary">Keywords:</span>
                {parsedIntent.keywords.map((k: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-surface-alt rounded-md text-[11px] text-text-secondary">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {(searchMut.isPending || manifestLoading || feedLoading) && <Spinner />}

        {/* ─── Match Search Results ─── */}
        {results && !searchMut.isPending && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4 sm:mb-6 pb-3 border-b border-border">
              <h2 className="text-lg sm:text-xl font-light text-text tracking-tight">
                {results.total} {results.total === 1 ? 'match' : 'matches'} discovered
              </h2>
              <span className="text-[11px] sm:text-xs text-text-secondary">
                Ranked by agent compatibility & verified platform policies
              </span>
            </div>

            {results.results?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {results.results.map((r: any) => (
                  <ProductCard
                    key={r.product.id}
                    product={r.product}
                    matchScore={r.match_score}
                    matchReasons={r.match_reasons}
                    merchantName={r.merchant_name}
                    onNegotiate={() => navigate(`/shop/negotiate/${r.product.id}`)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="🔍"
                title="No matching products found in this category"
                description="Try broadening your search query or switching to 'All Categories'."
              />
            )}
          </div>
        )}

        {/* ─── Storefront Manifest View (When arriving from View Store on Landing Page) ─── */}
        {!results && !searchMut.isPending && merchantId && manifestData?.products && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4 sm:mb-6 pb-3 border-b border-border">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-text tracking-tight">
                  {selectedMerchant?.name || 'Store'} Products ({manifestData.products.length})
                </h2>
                <p className="text-xs text-text-secondary">
                  Click any product to initiate AI negotiation and checkout
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {manifestData.products.map((prod: any) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  matchScore={0.98}
                  matchReasons={['Active in store catalog', 'Verified merchant policy']}
                  merchantName={selectedMerchant?.name || 'Verified Merchant'}
                  onNegotiate={() => navigate(`/shop/negotiate/${prod.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── Categorized Multi-Source Product Catalog Feed ─── */}
        {!results && !searchMut.isPending && !merchantId && feedProducts && feedProducts.length > 0 && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-5 pb-3 border-b border-border">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-text tracking-tight flex items-center gap-2">
                  <span>{activeCategoryMeta.icon}</span>
                  <span>{activeCategoryMeta.label} Catalog</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-50 text-primary rounded-full border border-blue-200/60">
                    {feedProducts.length} items available
                  </span>
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Live authentic products from verified Indian commerce platforms with autonomous negotiation bounds
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {feedProducts.map((prod: any) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  matchScore={96}
                  matchReasons={{
                    catalog: { match: true, detail: `${prod.merchant_name} verified catalog` },
                    policy: { match: true, detail: 'Deterministic policy-bounded negotiation' },
                  }}
                  merchantName={prod.merchant_name}
                  onNegotiate={() => navigate(`/shop/negotiate/${prod.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State Fallback */}
        {!results && !searchMut.isPending && !merchantId && (!feedProducts || feedProducts.length === 0) && !feedLoading && (
          <EmptyState
            icon="🛍️"
            title={`No products currently available in ${selectedCategory}`}
            description="Switch to another category or try searching across all stores."
          />
        )}
      </div>
    </div>
  );
}
