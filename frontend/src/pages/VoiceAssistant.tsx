import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useVoiceOrderSession } from '../hooks/useVoiceOrderSession';
import type { VoiceCandidate } from '../stores/voiceOrderStore';

const LANGUAGES = [
  { code: 'en-IN', name: 'English', flag: '🇬🇧' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ta-IN', name: 'Tamil', flag: '🇮🇳' },
  { code: 'te-IN', name: 'Telugu', flag: '🇮🇳' },
  { code: 'kn-IN', name: 'Kannada', flag: '🇮🇳' },
  { code: 'ml-IN', name: 'Malayalam', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'Marathi', flag: '🇮🇳' },
  { code: 'bn-IN', name: 'Bengali', flag: '🇮🇳' },
  { code: 'gu-IN', name: 'Gujarati', flag: '🇮🇳' },
];

export default function VoiceAssistant() {
  const {
    sessionId,
    state,
    candidates,
    lastOrder,
    captionText,
    isProcessing,
    isRecording,
    parsedIntent,
    policyRejection,
    clarificationNeeded,
    transcriptHistory,
    error,
    showTextFallback,
    startRecording,
    stopRecording,
    sendTextInput,
    reset,
    language,
    setLanguage,
  } = useVoiceOrderSession();

  const [textInput, setTextInput] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (captionText) {
      setAudioPlaying(true);
      const timer = setTimeout(() => setAudioPlaying(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [captionText]);

  const { data: voiceStatus } = useQuery({
    queryKey: ['voice-status'],
    queryFn: () => axios.get('/api/voice/status').then(r => r.data),
  });

  useEffect(() => {
    if (state === 'COMPLETED' && lastOrder) {
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
    }
  }, [state, lastOrder, queryClient]);

  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim()) return;
    await sendTextInput(textInput);
    setTextInput('');
  }, [textInput, sendTextInput]);

  const isAvailable = voiceStatus?.available;
  const isCompleted = state === 'COMPLETED';
  const isFailed = state === 'FAILED';
  const hasCandidates = candidates.length > 0;
  const latestTranscript = transcriptHistory[transcriptHistory.length - 1] || '';

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 animate-fadeIn">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
          <span>🎙️</span>
          <span>VOICE AI ASSISTANT</span>
          {sessionId && (
            <span className="text-[9px] opacity-60">• Live Session</span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-light text-text tracking-tight mb-2">
          Shop with Your Voice
        </h1>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Speak in your preferred language. Say what you want — food, shopping, anything — and complete checkout entirely by voice.
        </p>
      </div>

      {/* Language Selector */}
      <div className="flex justify-center mb-8">
        <div className="flex flex-wrap gap-1.5 justify-center">
          {LANGUAGES.map(({ code, name, flag }) => (
            <button
              key={code}
              onClick={() => setLanguage(code)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                language === code
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white border border-border text-text-secondary hover:border-primary/40'
              }`}
            >
              {flag} {name}
            </button>
          ))}
        </div>
      </div>

      {/* Microphone Button */}
      <div className="flex flex-col items-center gap-6 mb-10">
        {!isAvailable && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 max-w-sm text-center">
            <strong>Voice engine not configured.</strong> Please configure voice services in <code className="bg-amber-100 px-1 rounded">.env</code> to enable voice.
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-800 max-w-sm text-center animate-fadeIn">
            <strong>Error:</strong> {error}
          </div>
        )}

        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing || isCompleted}
          className={`w-28 h-28 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
            isRecording
              ? 'bg-danger text-white animate-pulse scale-110 shadow-danger/30'
              : isProcessing
              ? 'bg-zinc-300 text-zinc-500'
              : isCompleted
              ? 'bg-emerald-500 text-white shadow-emerald-500/30'
              : 'bg-primary text-white hover:bg-primary-hover hover:scale-105 shadow-primary/20'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isProcessing ? (
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 100 8v4a8 8 0 01-8-8z" />
            </svg>
          ) : isCompleted ? (
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
              {isRecording ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
              )}
            </svg>
          )}
        </button>

        <p className="text-xs text-text-secondary">
          {isRecording
            ? 'Recording... tap to stop'
            : isProcessing
            ? 'Processing voice & matching catalog...'
            : isCompleted
            ? 'Order completed! Tap below to start new order.'
            : 'Tap to start speaking'}
        </p>

        {/* Waveform animation while recording */}
        {isRecording && (
          <div className="flex items-center gap-0.5 h-8">
            {Array.from({ length: 20 }).map((_, i) => {
              const baseHeights = [40, 75, 95, 60, 30, 85, 50, 100, 70, 45, 90, 65, 35, 80, 55, 90, 40, 75, 60, 30];
              return (
                <div
                  key={i}
                  className="w-1 bg-danger rounded-full"
                  style={{
                    height: `${baseHeights[i % baseHeights.length]}%`,
                    animation: `waveform 0.5s ease-in-out ${i * 0.05}s infinite alternate`,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Reset button after completion */}
        {(isCompleted || isFailed) && (
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-all cursor-pointer"
          >
            🎙️ New Voice Order
          </button>
        )}
      </div>

      {/* Caption Overlay — synced with TTS */}
      {captionText && (
        <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-5 mb-6 animate-fadeIn shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center">
              <span className="text-xs">🤖</span>
            </div>
            <span className="text-xs font-medium text-white/60">AI Assistant</span>
            {audioPlaying && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary animate-pulse">
                🔊 Speaking...
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{captionText}</p>
        </div>
      )}

      {/* Transcript */}
      {latestTranscript && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-5 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🗣️</span>
            <h3 className="font-semibold text-text text-sm">Your Voice Input</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {LANGUAGES.find(l => l.code === language)?.name || language}
            </span>
          </div>
          <p className="text-sm text-text leading-relaxed italic">"{latestTranscript}"</p>
          {parsedIntent && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[10px] uppercase font-semibold text-text-secondary tracking-wider mb-1.5">Parsed Intent</p>
              <div className="flex flex-wrap gap-1.5">
                {parsedIntent.category && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    📁 {parsedIntent.category}
                  </span>
                )}
                {parsedIntent.max_price && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                    💰 ≤ ₹{parsedIntent.max_price.toLocaleString()}
                  </span>
                )}
                {parsedIntent.dietary_tags?.map((tag: string, i: number) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
                    🥗 {tag.replace(/_/g, ' ')}
                  </span>
                ))}
                {parsedIntent.raw_keywords?.map((kw: string, i: number) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-medium">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Text Input Fallback (when STT fails) */}
      {showTextFallback && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⌨️</span>
            <h3 className="font-semibold text-text text-sm">Type Your Request</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium">STT Fallback</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
              placeholder="e.g. show me a biryani under 700 rupees..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
            <button
              onClick={handleTextSubmit}
              disabled={isProcessing || !textInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-all cursor-pointer disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Policy Rejection */}
      {policyRejection && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚠️</span>
            <h3 className="font-semibold text-rose-900 text-sm">Policy Check Failed</h3>
          </div>
          <p className="text-sm text-rose-800 leading-relaxed">{policyRejection}</p>
        </div>
      )}

      {/* Candidate Cards */}
      {hasCandidates && !isCompleted && (
        <div className="space-y-3 animate-fadeIn mb-6">
          <h3 className="font-semibold text-text text-sm flex items-center gap-2">
            <span>🛍️</span>
            Matching Products ({candidates.length})
            {clarificationNeeded && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium ml-2">
                Say which one you want
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {candidates.map((c: VoiceCandidate, i: number) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-border hover:border-primary/30 shadow-sm p-4 transition-all hover:shadow-md group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-text group-hover:text-primary transition-colors leading-snug">
                      {c.name}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">{c.merchant_name}</p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      📦 {c.delivery_days}-day delivery • {c.category}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-text">₹{c.price?.toLocaleString()}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${c.match_score >= 60 ? 'bg-emerald-500' : c.match_score >= 30 ? 'bg-amber-500' : 'bg-zinc-400'}`} />
                      <span className="text-[10px] font-medium text-text-secondary">{c.match_score}% match</span>
                    </div>
                    {c.merchant_trust_score > 0 && (
                      <span className="text-[9px] text-text-secondary">⭐ {c.merchant_trust_score.toFixed(0)} trust</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => sendTextInput(`order the ${c.name}`)}
                  disabled={isProcessing}
                  className="w-full mt-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-all cursor-pointer disabled:opacity-40"
                >
                  🛒 Order This
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-text-secondary text-center mt-2">
            💡 Say <em>"order the [item name]"</em> or tap an Order button to checkout via voice
          </p>
        </div>
      )}

      {/* Order Confirmation Card */}
      {isCompleted && lastOrder && (
        <div className="animate-fadeIn">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-6 text-center shadow-lg">
            {/* Checkmark animation */}
            <div className="w-16 h-16 rounded-full bg-emerald-500 mx-auto mb-4 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-scaleIn">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-emerald-900 mb-1">Order Placed Successfully!</h3>
            <p className="text-sm text-emerald-800 mb-4">{lastOrder.product_name}</p>

            <div className="flex items-center justify-center gap-6 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-700/70 font-semibold">Debited</p>
                <p className="text-xl font-bold text-emerald-900">₹{lastOrder.amount?.toLocaleString()}</p>
              </div>
              <div className="w-px h-10 bg-emerald-300" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-700/70 font-semibold">Status</p>
                <p className="text-sm font-bold text-emerald-700">✅ {lastOrder.status}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-emerald-700/80 mb-5">
              <span>🏪 {lastOrder.merchant_name}</span>
              <span>•</span>
              <span>Order #{lastOrder.order_id}</span>
              <span>•</span>
              <span>Paid via Razorpay Test Mode</span>
            </div>

            {/* Direct Navigation Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-emerald-200">
              <Link
                to="/shop/orders"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>📦 View in My Orders</span>
              </Link>
              <Link
                to={`/shop/receipt/${lastOrder.order_id}`}
                className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>🧾 View Receipt</span>
              </Link>
              <button
                onClick={reset}
                className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                <span>🎙️ New Voice Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state hint */}
      {!latestTranscript && !isRecording && !isProcessing && !isCompleted && (
        <div className="text-center py-8 text-text-secondary text-sm space-y-2">
          <p>🎯 Try saying:</p>
          <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
            {[
              'Show me a biryani under 700 rupees',
              'I want a high protein dinner',
              'Find me running shoes under 5000',
              'Order a pizza',
            ].map((eg, i) => (
              <button
                key={i}
                onClick={() => sendTextInput(eg)}
                className="text-[11px] px-3 py-1.5 rounded-full bg-surface-alt text-text-secondary hover:bg-primary/10 hover:text-primary transition-all cursor-pointer"
              >
                "{eg}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Waveform + Animation CSS */}
      <style>{`
        @keyframes waveform {
          from { height: 15%; }
          to { height: 85%; }
        }
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scaleIn {
          animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
}
