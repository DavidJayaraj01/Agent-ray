import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { parseIntent, matchProducts } from '../api/client';
import { ProductCard, SearchBar, Spinner, EmptyState } from '../components';

export default function BuyerSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<any>(null);
  const [parsedIntent, setParsedIntent] = useState<any>(null);

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
  }, []);

  return (
    <div className="w-full">
      {/* ─── Search Hero with Blue Gradient ─── */}
      <section className="bg-gradient-to-b from-[#EEF6FF] via-[#F8FBFF] to-[#FFFFFF] border-b border-border/60 pt-8 pb-12 sm:pt-12 sm:pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#2F6BFF]/20 text-primary text-[11px] sm:text-xs font-semibold shadow-2xs mb-3 sm:mb-4">
            <span>🤖 AI Buyer Agent Search</span>
          </div>

          <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-light text-text tracking-tight mb-2 sm:mb-3">
            Autonomous Product Discovery
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm md:text-base font-normal max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed">
            State your requirement in natural language. Our semantic matcher evaluates catalog manifests across merchants.
          </p>

          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={handleSearch}
            placeholder="e.g. black running shoes under ₹5,000, arrive tomorrow"
          />
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
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

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {Object.entries(parsedIntent.parsed_constraints || {}).map(([key, val]: [string, any]) => {
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
              })}
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {searchMut.isPending && <Spinner />}

        {/* ─── Match Results ─── */}
        {results && !searchMut.isPending && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4 sm:mb-6 pb-3 border-b border-border">
              <h2 className="text-lg sm:text-xl font-light text-text tracking-tight">
                {results.total} {results.total === 1 ? 'match' : 'matches'} discovered
              </h2>
              <span className="text-[11px] sm:text-xs text-text-secondary">Ranked by agent compatibility</span>
            </div>

            {results.results?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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

        {/* Initial Empty State */}
        {!results && !searchMut.isPending && (
          <EmptyState
            icon="⚡"
            title="Search for products using natural language"
            description='Describe attributes, price caps, or delivery urgency: e.g. "Mechanical keyboard with brown switches under ₹4,000"'
          />
        )}
      </div>
    </div>
  );
}
