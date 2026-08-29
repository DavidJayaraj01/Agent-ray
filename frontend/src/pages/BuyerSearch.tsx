import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { parseIntent, matchProducts, fetchManifest, fetchMerchants } from '../api/client';
import { ProductCard, SearchBar, Spinner, EmptyState } from '../components';

export default function BuyerSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const merchantParam = searchParams.get('merchant');
  const merchantId = merchantParam ? parseInt(merchantParam, 10) : null;
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<any>(null);
  const [parsedIntent, setParsedIntent] = useState<any>(null);

  // Fetch all merchants for name resolution
  const { data: merchants } = useQuery({
    queryKey: ['merchants'],
    queryFn: fetchMerchants,
  });

  const selectedMerchant = merchants?.find((m: any) => m.id === merchantId);

  // Fetch store manifest products if arriving from "View Store"
  const { data: manifestData, isLoading: manifestLoading } = useQuery({
    queryKey: ['merchantManifest', merchantId],
    queryFn: () => (merchantId ? fetchManifest(merchantId) : null),
    enabled: !!merchantId && !results,
  });

  const searchMut = useMutation({
    mutationFn: async (q: string) => {
      const intent = await parseIntent(q);
      setParsedIntent(intent);
      const matches = await matchProducts(intent.parsed_constraints, intent.id);
      return matches;
    },
    onSuccess: (data) => setResults(data),
  });

  const handleSearch = () => {
    if (!query.trim()) return;
    searchMut.mutate(query.trim());
  };

  // Auto-search if query param exists on initial load
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      searchMut.mutate(q);
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="w-full">
      {/* ─── Search Hero with Blue Gradient ─── */}
      <section className="bg-gradient-to-b from-[#EEF6FF] via-[#F8FBFF] to-[#FFFFFF] border-b border-border/60 pt-8 pb-12 sm:pt-12 sm:pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#2F6BFF]/20 text-primary text-[11px] sm:text-xs font-semibold shadow-2xs mb-3 sm:mb-4">
            <span>🤖 AI Buyer Agent Search</span>
          </div>

          <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-light text-text tracking-tight mb-2 sm:mb-3">
            {selectedMerchant ? `${selectedMerchant.name} Storefront` : 'Autonomous Product Discovery'}
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm md:text-base font-normal max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed">
            {selectedMerchant
              ? `Explore AI-normalized items from ${selectedMerchant.name} with real-time policy-bounded negotiations.`
              : 'State your requirement in natural language. Our semantic matcher evaluates catalog manifests across merchants.'}
          </p>

          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={handleSearch}
            placeholder={
              selectedMerchant
                ? `Search within ${selectedMerchant.name}...`
                : 'e.g. black running shoes under ₹5,000, arrive tomorrow'
            }
          />
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">


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
        {(searchMut.isPending || manifestLoading) && <Spinner />}

        {/* ─── Match Search Results ─── */}
        {results && !searchMut.isPending && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4 sm:mb-6 pb-3 border-b border-border">
              <h2 className="text-lg sm:text-xl font-light text-text tracking-tight">
                {results.total} {results.total === 1 ? 'match' : 'matches'} discovered
              </h2>
              <span className="text-[11px] sm:text-xs text-text-secondary">
                Ranked by agent compatibility
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
                title="No matching products found"
                description="Try loosening your constraints or searching for broader categories."
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


        {/* Initial Empty State (When no merchant selected & no query) */}
        {!results && !searchMut.isPending && !merchantId && (
          <EmptyState
            icon="⚡"
            title="Search for products using natural language"
            description='Describe attributes, price caps, or delivery urgency: e.g. "Biryani feast for 2" or "Nike Pegasus running shoes"'
          />
        )}
      </div>
    </div>
  );
}
