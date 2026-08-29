export { default as Fintech3DIllustration } from './Fintech3DIllustration';

// ─── Trust Badge ───────────────────────────────────────────
export function TrustBadge({ score }: { score: number }) {
  const isHigh = score >= 80;
  const isMid = score >= 50;
  
  const bg = isHigh ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
             isMid  ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-rose-50 text-rose-700 border-rose-200';

  const icon = isHigh ? '✓' : isMid ? '⚠' : '✕';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${bg} transition-colors`}>
      <span>{icon}</span>
      <span>Trust {score.toFixed(0)}</span>
    </span>
  );
}

// ─── Merchant Card ─────────────────────────────────────────
export function MerchantCard({ merchant, onClick }: { merchant: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs hover:shadow-sm hover:border-[#2F6BFF]/40 transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-light-blue border border-[#2F6BFF]/10 flex items-center justify-center text-primary font-bold text-base sm:text-lg">
            {merchant.name.charAt(0)}
          </div>
          <TrustBadge score={merchant.trust_score} />
        </div>

        <h3 className="font-semibold text-text text-base sm:text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">
          {merchant.name}
        </h3>
        <p className="text-text-secondary text-xs sm:text-sm mb-4 leading-relaxed line-clamp-2">
          {merchant.category} · Catalog AI-Verified
        </p>
      </div>

      <div className="pt-3 sm:pt-4 border-t border-border/60 flex items-center justify-between">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-medium ${
          merchant.status === 'active' 
            ? 'bg-emerald-50 text-emerald-700' 
            : 'bg-amber-50 text-amber-700'
        }`}>
          {merchant.status === 'active' ? '● Active' : '○ Pending'}
        </span>

        <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-primary group-hover:underline">
          View Merchant
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// ─── Product Card ──────────────────────────────────────────
export function ProductCard({
  product,
  matchScore,
  matchReasons,
  merchantName,
  onNegotiate,
}: {
  product: any;
  matchScore?: number;
  matchReasons?: any;
  merchantName?: string;
  onNegotiate?: () => void;
}) {
  const imageUrl = product.variants?.image_url || product.image_url;
  const sourceUrl = product.variants?.source_url || product.source_url;
  const rating = product.variants?.rating || product.rating;
  const platform = product.variants?.platform || 
    (merchantName?.includes("Meesho") ? "Meesho" : 
     merchantName?.includes("Amazon") ? "Amazon" : 
     merchantName?.includes("Flipkart") ? "Flipkart" : null);

  return (
    <div className="bg-white rounded-2xl border border-border shadow-xs hover:shadow-sm p-4 sm:p-6 transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Optional Authentic Product Image with Fallback */}
        {imageUrl && (
          <div className="relative w-full h-44 sm:h-48 mb-4 rounded-xl overflow-hidden bg-surface-alt border border-border/50 flex items-center justify-center">
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-2 hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                // If image fails to load, gracefully hide image container
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {platform && (
              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-md shadow-xs border border-border/60">
                {platform}
              </span>
            )}
          </div>
        )}

        <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 bg-light-blue text-primary text-[11px] sm:text-xs font-medium rounded-full border border-[#2F6BFF]/10">
              {product.category || 'Product'}
            </span>
            {merchantName?.includes("Meesho") && (
              <span className="px-2 py-0.5 bg-pink-50 text-pink-700 text-[10px] font-bold rounded-full border border-pink-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                Meesho Verified
              </span>
            )}
            {merchantName?.includes("Amazon") && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Amazon Prime
              </span>
            )}
            {merchantName?.includes("Flipkart") && (
              <span className="px-2 py-0.5 bg-sky-50 text-sky-700 text-[10px] font-bold rounded-full border border-sky-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Flipkart Assured
              </span>
            )}
            {rating && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200 flex items-center gap-1">
                <span>⭐</span> {Number(rating).toFixed(1)}
              </span>
            )}
          </div>

          {matchScore !== undefined && (
            <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-primary bg-light-blue px-2.5 py-0.5 rounded-full shrink-0">
              {matchScore.toFixed(0)}% match
            </span>
          )}
        </div>

        <h3 className="font-semibold text-text text-sm sm:text-base mb-1.5 line-clamp-2 leading-snug">
          {product.name}
        </h3>

        <div className="flex items-center justify-between flex-wrap gap-1 mb-3">
          {merchantName && (
            <p className="text-xs text-text-secondary flex items-center gap-1">
              <span>By</span>
              <span className="font-medium text-text">{merchantName}</span>
            </p>
          )}

          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              <span>View on {platform || 'Store'}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>

        <div className="mb-3 sm:mb-4">
          <span className="text-xl sm:text-2xl font-bold text-text tracking-tight">
            ₹{Number(product.price).toLocaleString('en-IN')}
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 sm:gap-3 mb-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {product.stock} in stock
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {product.delivery_days}-day delivery
          </span>
        </div>

        {matchReasons && (
          <div className="bg-surface-alt rounded-xl p-3 mb-4 space-y-1.5 border border-border/50">
            {Object.entries(matchReasons).map(([key, val]: [string, any]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className={val.match ? 'text-emerald-600' : 'text-rose-500'}>
                  {val.match ? '✓' : '✕'}
                </span>
                <span className="text-text-secondary capitalize">{key}: {val.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {onNegotiate && (
        <button
          onClick={onNegotiate}
          className="w-full py-2.5 sm:py-3 px-4 bg-primary hover:bg-primary-hover active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-medium transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Negotiate & Buy</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Large Rounded Search Bar ──────────────────────────────
export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        <div className="absolute left-3.5 sm:left-5 pointer-events-none text-text-secondary">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder={placeholder || "Search products or describe buyer intent..."}
          className="w-full pl-9 sm:pl-12 pr-20 sm:pr-32 py-3.5 sm:py-4 bg-white rounded-full border border-border shadow-xs text-sm sm:text-base text-text placeholder:text-text-secondary/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
        <button
          onClick={onSubmit}
          className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-1.5 shadow-xs cursor-pointer"
        >
          <span>Find</span>
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Trust Breakdown Bar ───────────────────────────────────
export function TrustBreakdownBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-text-secondary">{label}</span>
        <span className="font-semibold text-text">{value.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2 bg-surface-alt rounded-full overflow-hidden border border-border/40">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

// ─── Spinner ───────────────────────────────────────────────
export function Spinner() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────
export function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="text-center py-16 px-4 bg-white rounded-2xl border border-border border-dashed">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-text text-base mb-1">{title}</h3>
      <p className="text-text-secondary text-sm max-w-sm mx-auto">{description}</p>
    </div>
  );
}
