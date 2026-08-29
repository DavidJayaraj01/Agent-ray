export { default as Fintech3DIllustration } from './Fintech3DIllustration';

// ─── 3D Trust Badge ───────────────────────────────────────────
export function TrustBadge({ score }: { score: number }) {
  const isHigh = score >= 80;
  const isMid = score >= 50;

  const bg = isHigh
    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border-emerald-300 shadow-xs shadow-emerald-500/10'
    : isMid
    ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border-amber-300 shadow-xs shadow-amber-500/10'
    : 'bg-gradient-to-r from-rose-50 to-red-50 text-rose-800 border-rose-300 shadow-xs shadow-rose-500/10';

  const dot = isHigh ? 'bg-emerald-500' : isMid ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${bg} backdrop-blur-md transition-all`}
    >
      <span className={`w-2 h-2 rounded-full ${dot} animate-pulse`} />
      <span>Trust {score.toFixed(0)}/100</span>
    </span>
  );
}

// ─── 3D Merchant Card ─────────────────────────────────────────
export function MerchantCard({ merchant, onClick }: { merchant: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group card-3d card-3d-hover rounded-3xl p-6 cursor-pointer flex flex-col justify-between relative overflow-hidden"
    >
      {/* Top Specular Edge Highlight */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100/80 border border-blue-200/60 shadow-md shadow-blue-500/10 flex items-center justify-center text-primary font-black text-xl group-hover:scale-105 transition-transform duration-300">
            {merchant.name.charAt(0)}
          </div>
          <TrustBadge score={merchant.trust_score} />
        </div>

        <h3 className="font-extrabold text-slate-900 text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">
          {merchant.name}
        </h3>
        <p className="text-slate-500 text-xs mb-4 leading-relaxed line-clamp-2">
          {merchant.category} · AI Manifest Active
        </p>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            merchant.status === 'active'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${merchant.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {merchant.status === 'active' ? 'Active' : 'Pending'}
        </span>

        <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
          View Store
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// ─── 3D Product Card ──────────────────────────────────────────
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
  const platform =
    product.variants?.platform ||
    (merchantName?.includes('Meesho')
      ? 'Meesho'
      : merchantName?.includes('Amazon')
      ? 'Amazon'
      : merchantName?.includes('Flipkart')
      ? 'Flipkart'
      : null);

  return (
    <div className="group card-3d card-3d-hover rounded-3xl p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
      <div>
        {/* Authentic Product Image with 3D Depth */}
        {imageUrl && (
          <div className="relative w-full h-44 sm:h-52 mb-4 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/80 shadow-inner flex items-center justify-center group-hover:border-blue-300 transition-colors">
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {platform && (
              <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-white/90 backdrop-blur-md shadow-sm border border-slate-200">
                {platform}
              </span>
            )}
          </div>
        )}

        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 bg-blue-50 text-primary text-[10px] sm:text-[11px] font-bold rounded-full border border-blue-200/60">
              {product.category || 'Product'}
            </span>
            {merchantName?.includes('Meesho') && (
              <span className="px-2 py-0.5 bg-pink-50 text-pink-700 text-[10px] font-bold rounded-full border border-pink-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                Meesho Verified
              </span>
            )}
            {merchantName?.includes('Amazon') && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Amazon Prime
              </span>
            )}
            {merchantName?.includes('Flipkart') && (
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
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-0.5 rounded-full shadow-xs shrink-0">
              {matchScore.toFixed(0)}% match
            </span>
          )}
        </div>

        <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-1.5 line-clamp-2 leading-snug">
          {product.name}
        </h3>

        <div className="flex items-center justify-between flex-wrap gap-1 mb-3">
          {merchantName && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span>By</span>
              <span className="font-semibold text-slate-700">{merchantName}</span>
            </p>
          )}

          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-bold"
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
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            ₹{Number(product.price).toLocaleString('en-IN')}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 mb-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {product.stock} in stock
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {product.delivery_days}-day delivery
          </span>
        </div>

        {matchReasons && (
          <div className="bg-slate-50/80 rounded-2xl p-3 mb-4 space-y-1.5 border border-slate-200/80 text-xs">
            {Object.entries(matchReasons).map(([key, val]: [string, any]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={val.match ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                  {val.match ? '✓' : '✕'}
                </span>
                <span className="text-slate-600 capitalize">
                  {key}: <span className="text-slate-800 font-medium">{val.detail}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {onNegotiate && (
        <button
          onClick={onNegotiate}
          className="btn-3d-primary w-full py-3 px-4 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          <span>Negotiate & Buy</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── 3D Large Search Bar ──────────────────────────────────────
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
        <div className="absolute left-4 sm:left-5 pointer-events-none text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder={placeholder || 'Search products or describe buyer intent...'}
          className="w-full pl-12 sm:pl-14 pr-24 sm:pr-32 py-4 sm:py-4.5 bg-white/95 backdrop-blur-md rounded-full border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-primary transition-all"
        />
        <button
          onClick={onSubmit}
          className="btn-3d-primary absolute right-2 top-1/2 -translate-y-1/2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <span>Find</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── 3D Trust Breakdown Bar ───────────────────────────────────
export function TrustBreakdownBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3.5">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="font-bold text-slate-900">{value.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-700 shadow-xs"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

// ─── 3D Spinner ───────────────────────────────────────────────
export function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center p-12 gap-3">
      <div className="w-9 h-9 border-3 border-blue-200 border-t-primary rounded-full animate-spin shadow-sm" />
      <span className="text-xs font-bold text-slate-400">Loading AgentReady...</span>
    </div>
  );
}

// ─── 3D Empty State ───────────────────────────────────────────
export function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="card-3d text-center py-16 px-6 rounded-3xl border border-dashed border-slate-300">
      <div className="text-4xl mb-3 animate-bounce">{icon}</div>
      <h3 className="font-extrabold text-slate-900 text-lg mb-1">{title}</h3>
      <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">{description}</p>
    </div>
  );
}
