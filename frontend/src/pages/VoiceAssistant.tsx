import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';

const LANGUAGES = [
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
  { code: 'en-IN', name: 'English', flag: '🇬🇧' },
  { code: 'ta-IN', name: 'Tamil', flag: '🇮🇳' },
  { code: 'te-IN', name: 'Telugu', flag: '🇮🇳' },
  { code: 'kn-IN', name: 'Kannada', flag: '🇮🇳' },
  { code: 'ml-IN', name: 'Malayalam', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'Marathi', flag: '🇮🇳' },
  { code: 'bn-IN', name: 'Bengali', flag: '🇮🇳' },
  { code: 'gu-IN', name: 'Gujarati', flag: '🇮🇳' },
];

export default function VoiceAssistant() {
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('hi-IN');
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState<any>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { data: voiceStatus } = useQuery({
    queryKey: ['voice-status'],
    queryFn: () => axios.get('/api/voice/status').then(r => r.data),
  });

  const converseMut = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('language_code', language);
      const resp = await axios.post('/api/voice/converse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return resp.data;
    },
    onSuccess: (data) => {
      setTranscript(data.transcript);
      setResults(data);
      // Auto-play TTS response
      if (data.tts_audio_base64) {
        playAudio(data.tts_audio_base64);
      }
    },
  });

  const playAudio = useCallback((base64Audio: string) => {
    try {
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      setAudioPlaying(true);
      audio.onended = () => setAudioPlaying(false);
      audio.onerror = () => setAudioPlaying(false);
      audio.play().catch(() => setAudioPlaying(false));
    } catch {
      setAudioPlaying(false);
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        converseMut.mutate(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert('Microphone access is required for voice assistant.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const isAvailable = voiceStatus?.available;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
          <span>🎙️</span>
          <span>SARVAM AI VOICE ASSISTANT</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-light text-text tracking-tight mb-2">
          Shop with Your Voice
        </h1>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Speak in any Indian language. Our AI understands Hindi, Tamil, Telugu, and 7 more languages — powered by Sarvam AI.
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
            <strong>Sarvam AI not configured.</strong> Add your <code className="bg-amber-100 px-1 rounded">SARVAM_API_KEY</code> to <code className="bg-amber-100 px-1 rounded">.env</code> to enable voice.
          </div>
        )}

        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isAvailable || converseMut.isPending}
          className={`w-28 h-28 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
            isRecording
              ? 'bg-danger text-white animate-pulse scale-110 shadow-danger/30'
              : converseMut.isPending
              ? 'bg-zinc-300 text-zinc-500'
              : 'bg-primary text-white hover:bg-primary-hover hover:scale-105 shadow-primary/20'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {converseMut.isPending ? (
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 100 8v4a8 8 0 01-8-8z" />
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
          {isRecording ? 'Recording... tap to stop' : converseMut.isPending ? 'Processing with Sarvam AI...' : 'Tap to start speaking'}
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
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-5 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🗣️</span>
            <h3 className="font-semibold text-text text-sm">Your Voice Input</h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {LANGUAGES.find(l => l.code === language)?.name || language}
            </span>
          </div>
          <p className="text-sm text-text leading-relaxed italic">"{transcript}"</p>
          {results?.parsed_intent && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[10px] uppercase font-semibold text-text-secondary tracking-wider mb-1.5">Parsed Intent</p>
              <div className="flex flex-wrap gap-1.5">
                {results.parsed_intent.category && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    📁 {results.parsed_intent.category}
                  </span>
                )}
                {results.parsed_intent.budget && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                    💰 ≤ ₹{results.parsed_intent.budget.toLocaleString()}
                  </span>
                )}
                {results.parsed_intent.brand && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                    🏷️ {results.parsed_intent.brand}
                  </span>
                )}
                {results.parsed_intent.keywords?.map((kw: string, i: number) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-medium">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Response */}
      {results?.response_text && (
        <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <h3 className="font-semibold text-text text-sm">AI Response</h3>
            </div>
            {results.tts_audio_base64 && (
              <button
                onClick={() => playAudio(results.tts_audio_base64)}
                disabled={audioPlaying}
                className="text-xs px-2.5 py-1 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                {audioPlaying ? '🔊 Playing...' : '🔊 Play'}
              </button>
            )}
          </div>
          <p className="text-sm text-text leading-relaxed">{results.response_text}</p>
        </div>
      )}

      {/* Product Results */}
      {results?.match_results?.length > 0 && (
        <div className="space-y-3 animate-fadeIn">
          <h3 className="font-semibold text-text text-sm flex items-center gap-2">
            <span>🛍️</span>
            Matching Products ({results.match_results.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.match_results.map((r: any, i: number) => (
              <Link
                key={i}
                to={`/shop/negotiate/${r.product.id}`}
                className="bg-white rounded-xl border border-border hover:border-primary/30 shadow-sm p-4 transition-all hover:shadow-md group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-text group-hover:text-primary transition-colors leading-snug">
                      {r.product.name}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">{r.merchant_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-text">₹{r.product.price?.toLocaleString()}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${r.match_score >= 60 ? 'bg-emerald-500' : r.match_score >= 30 ? 'bg-amber-500' : 'bg-zinc-400'}`} />
                      <span className="text-[10px] font-medium text-text-secondary">{r.match_score}% match</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.match_reasons?.slice(0, 3).map((reason: string, j: number) => (
                    <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt text-text-secondary">
                      {reason}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {results && results.match_results?.length === 0 && (
        <div className="text-center py-8 text-text-secondary text-sm">
          No products matched. Try saying something like "I need a phone under 30000" or "show me running shoes."
        </div>
      )}

      {/* Waveform CSS */}
      <style>{`
        @keyframes waveform {
          from { height: 15%; }
          to { height: 85%; }
        }
      `}</style>
    </div>
  );
}
