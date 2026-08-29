export default function Fintech3DIllustration() {
  return (
    <div className="relative w-full max-w-xl mx-auto py-6 sm:py-10 px-2 sm:px-6 select-none overflow-hidden sm:overflow-visible" aria-hidden="true">
      {/* Soft Ambient Radial Glow */}
      <div className="absolute inset-0 bg-radial from-[#2F6BFF]/15 via-[#38BDF8]/10 to-transparent blur-3xl rounded-full transform scale-110 pointer-events-none" />

      {/* Main Perspective Stage Container with Responsive Scaling */}
      <div className="relative min-h-[300px] xs:min-h-[330px] sm:min-h-[380px] flex items-center justify-center">

        {/* Responsive Scaler Wrapper for smaller mobile devices */}
        <div className="relative z-10 flex flex-col items-center transform scale-[0.74] xs:scale-[0.84] sm:scale-95 md:scale-100 origin-center transition-transform">
          {/* 3D Isometric Card */}
          <div
            className="w-72 sm:w-84 h-44 sm:h-52 rounded-2xl p-6 text-white relative overflow-hidden shadow-2xl transition-all duration-700 hover:rotate-0"
            style={{
              background: 'linear-gradient(135deg, #1E40AF 0%, #2F6BFF 50%, #0F172A 100%)',
              boxShadow: '0 25px 50px -12px rgba(47, 107, 255, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.15)',
              transform: 'perspective(1000px) rotateX(12deg) rotateY(-14deg) rotateZ(4deg)',
            }}
          >
            {/* Glossy Sheen Overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                background: 'linear-gradient(105deg, rgba(255,255,255,0.4) 0%, transparent 60%)',
              }}
            />

            {/* Top Card Row: EMV Chip & Contactless */}
            <div className="flex items-center justify-between mb-8">
              {/* Gold Chip */}
              <div className="w-10 h-7 rounded-md bg-amber-300 border border-amber-500/40 relative shadow-inner overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 border-t border-amber-600/30" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-amber-600/40" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-amber-600/40" />
              </div>

              {/* Wifi Waves */}
              <svg className="w-6 h-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>

            {/* Card Numbers */}
            <div className="font-mono text-sm sm:text-base tracking-[0.25em] text-white/95 font-semibold mb-3 drop-shadow-sm">
              •••• 4892
            </div>

            {/* Bottom Card Row */}
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-widest text-blue-200/70 font-semibold">
                  Cardholder
                </div>
                <div className="text-xs font-semibold text-white tracking-wider">
                  AGENT READY COMMERCE
                </div>
              </div>

              {/* Holographic Concentric Rings */}
              <div className="flex items-center -space-x-2">
                <div className="w-7 h-7 rounded-full bg-rose-500/90 shadow-xs" />
                <div className="w-7 h-7 rounded-full bg-amber-400/90 shadow-xs" />
              </div>
            </div>
          </div>

          {/* Isometric Shadow Platform Under Card */}
          <div
            className="w-72 sm:w-80 h-10 -mt-2 rounded-full bg-[#2F6BFF]/15 blur-xl pointer-events-none"
          />
        </div>

        {/* ─── Floating Panel 1: Trust Metric (Top Left) ─── */}
        <div
          className="absolute -top-1 sm:-top-3 left-0 sm:left-2 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-border shadow-md p-2.5 sm:p-4 animate-float-reverse max-w-[150px] sm:max-w-[190px]"
          style={{ animationDuration: '7s' }}
        >
          <div className="flex items-center justify-between gap-2 sm:gap-3 mb-1 sm:mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-text">Trust</span>
            </div>
            <span className="text-[11px] sm:text-xs font-extrabold text-primary font-mono">98.4</span>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-text-secondary gap-1.5">
            <span>Verified</span>
            {/* Sparkline */}
            <svg className="w-8 sm:w-10 h-3 text-emerald-500" fill="none" viewBox="0 0 40 12" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 10l8-6 8 4 10-6 12 4" />
            </svg>
          </div>
        </div>

        {/* ─── Floating Panel 2: AI Transaction (Top Right) ─── */}
        <div
          className="absolute top-1 sm:top-2 right-0 sm:right-2 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-border shadow-md p-2.5 sm:p-4 animate-float-slow max-w-[160px] sm:max-w-[210px]"
          style={{ animationDuration: '6s' }}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-light-blue text-primary flex items-center justify-center text-[9px] sm:text-[10px] font-bold">
              ✓
            </div>
            <span className="text-[10px] sm:text-[11px] text-text-secondary font-medium">AI Checkout</span>
          </div>

          <div className="text-sm sm:text-lg font-bold text-text tracking-tight mb-1 sm:mb-1.5">
            ₹4,250.00
          </div>

          <div className="flex items-center justify-between gap-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[8px] sm:text-[9px]">
              ● AUTO-SETTLED
            </span>
            <span className="text-[8px] sm:text-[9px] text-text-tertiary">Razorpay</span>
          </div>
        </div>

        {/* ─── Floating Panel 3: Policy Guardrails (Bottom Right) ─── */}
        <div
          className="absolute -bottom-1 sm:-bottom-2 right-1 sm:right-8 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-border shadow-md px-3 py-2 sm:px-3.5 sm:py-2.5 animate-float-reverse max-w-[170px] sm:max-w-[220px]"
          style={{ animationDuration: '8s' }}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
            <span className="text-primary text-xs">🛡️</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-text truncate">Policy Engine</span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-text-secondary leading-tight truncate sm:whitespace-normal">
            10% Max Discount Bound
          </p>
        </div>

        {/* ─── Floating Metric Pill (Bottom Left) ─── */}
        <div
          className="absolute bottom-4 sm:bottom-6 left-1 sm:left-6 z-20 bg-white/95 backdrop-blur-md rounded-full border border-border shadow-xs px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 animate-float-slow"
          style={{ animationDuration: '9s' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-[9px] sm:text-[10px] font-semibold text-text">0% Hallucination</span>
        </div>

      </div>
    </div>
  );
}
