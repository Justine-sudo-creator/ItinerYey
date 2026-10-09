'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, Cpu, Database, ImagePlus, Loader2, MessageCircle, ScanLine, Send, Wifi, WifiOff, X,
} from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { JourneyItinerary } from '@/components/planner/JourneyItinerary';
import type { RoutingResult } from '@/types/routing';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssistantStatus {
  ollama: boolean;
  chatModel: string;
  visionModel: string;
  chatModelReady: boolean;
  visionModelReady: boolean;
  offlineMode: boolean;
  snapshot: { generatedAt: string; source: string; routes: number; segments: number } | null;
}

interface PlaceRef { query: string; name: string }

interface AssistantResponse {
  success: boolean;
  reply?: string;
  error?: string;
  origin?: PlaceRef;
  destination?: PlaceRef;
  route?: RoutingResult;
  ai?: { used: boolean; model: string; error: string | null; timings: Record<string, number> };
}

interface ChatEntry {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  data?: AssistantResponse;
  elapsedMs?: number;
}

interface ScanMatch {
  routeId: string;
  signboard: string | null;
  transportType: string;
  origin: string;
  destination: string;
  totalFare: number;
  stopCount: number;
  firstStop: string | null;
  lastStop: string | null;
  score: number;
  passesThrough: { stopName: string; stopsAway: number; fareFromStart: number } | null;
}

interface ScanResponse {
  success: boolean;
  error?: string;
  read?: { text: string; places: string[]; vehicle: string | null };
  matches?: ScanMatch[];
  destination?: string | null;
  linkable?: boolean;
  ai?: { model: string; visionMs: number; matchMs: number };
}

const SUGGESTIONS = [
  'Paano pumunta sa SM North galing Cubao?',
  'From Baclaran to Monumento',
  'Galing Recto papuntang Katipunan, magkano?',
  'How do I get to Megamall from Shaw?',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

/** Downscale to keep on-device vision inference fast. */
function resizeToDataUrl(source: CanvasImageSource, width: number, height: number, max = 1024): string {
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(resizeToDataUrl(img, img.naturalWidth, img.naturalHeight));
    img.onerror = reject;
    img.src = src;
  });
}

function secs(ms?: number) {
  return ms == null ? '' : `${(ms / 1000).toFixed(1)}s`;
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function StatusPill({ ok, icon, label }: { ok: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md border
      ${ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
      {icon}
      {label}
    </span>
  );
}

function StatusBar({ status, online }: { status: AssistantStatus | null; online: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <StatusPill
        ok
        icon={online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        label={online ? 'Online — not needed' : 'No internet — still working'}
      />
      {status ? (
        <>
          <StatusPill
            ok={status.ollama && status.chatModelReady}
            icon={<Cpu className="w-3.5 h-3.5" />}
            label={status.ollama ? `Local LLM: ${status.chatModel}` : 'Ollama not running'}
          />
          <StatusPill
            ok={status.ollama && status.visionModelReady}
            icon={<ScanLine className="w-3.5 h-3.5" />}
            label={`Local vision: ${status.visionModel}`}
          />
          <StatusPill
            ok={!!status.snapshot}
            icon={<Database className="w-3.5 h-3.5" />}
            label={status.snapshot
              ? `On-device routes: ${status.snapshot.routes.toLocaleString()} (${status.snapshot.segments.toLocaleString()} segments)`
              : 'Offline route index missing'}
          />
        </>
      ) : (
        <span className="text-xs text-secondary font-medium inline-flex items-center gap-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking local AI…
        </span>
      )}
    </div>
  );
}

// ─── Ask (chat) tab ───────────────────────────────────────────────────────────

function AskTab() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries, busy]);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    setEntries(e => [...e, { id: nextId.current++, role: 'user', text: q }]);
    const started = performance.now();
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const data: AssistantResponse = await res.json();
      setEntries(e => [...e, {
        id: nextId.current++,
        role: 'assistant',
        text: data.reply ?? data.error ?? 'Something went wrong.',
        data,
        elapsedMs: performance.now() - started,
      }]);
    } catch {
      setEntries(e => [...e, {
        id: nextId.current++, role: 'assistant',
        text: 'Could not reach the local ItinerYey server. Is `npm run dev` still running?',
      }]);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return (
    <div className="flex flex-col gap-4">
      {entries.length === 0 && (
        <div className="bg-soft-beige rounded-xl p-5 border border-border-dark">
          <p className="text-sm font-bold text-primary mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="text-xs font-bold px-3 py-2 rounded-lg bg-white border border-border-dark hover:border-accent-coral hover:text-accent-coral transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {entries.map(entry => entry.role === 'user' ? (
        <div key={entry.id} className="self-end max-w-[85%] bg-primary text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm font-medium">
          {entry.text}
        </div>
      ) : (
        <div key={entry.id} className="self-start w-full flex flex-col gap-3">
          <div className="max-w-[95%] bg-surface border border-border-dark shadow-hard rounded-2xl rounded-bl-sm px-4 py-3">
            {entry.data?.origin && entry.data?.destination && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary/80 mb-2">
                {entry.data.origin.name} → {entry.data.destination.name}
              </p>
            )}
            <p className="text-sm text-primary font-medium whitespace-pre-line leading-relaxed">{entry.text}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] font-bold text-secondary">
              {entry.data?.ai && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                  <Cpu className="w-3 h-3" />
                  {entry.data.ai.used ? `${entry.data.ai.model} on this device` : 'Planner only (local AI offline)'}
                </span>
              )}
              {entry.elapsedMs != null && <span>Answered in {secs(entry.elapsedMs)}</span>}
              {entry.data?.route?.dataSource && (
                <span>· Route data: {entry.data.route.dataSource === 'offline' ? 'on-device index' : 'live'}</span>
              )}
              <span>· 0 bytes sent to the cloud</span>
            </div>
          </div>
          {entry.data?.route && (
            <details className="w-full" open>
              <summary className="cursor-pointer text-xs font-bold text-secondary mb-2">Step-by-step itinerary (from the A* planner)</summary>
              <JourneyItinerary
                totalTimeMinutes={entry.data.route.totalTimeMinutes}
                totalFare={entry.data.route.totalFare}
                legs={entry.data.route.legs}
                destinationName={entry.data.destination?.name}
              />
            </details>
          )}
        </div>
      ))}

      {busy && (
        <div className="self-start inline-flex items-center gap-2 text-sm font-bold text-secondary bg-surface border border-border-dark rounded-2xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin text-accent-coral" />
          Thinking on-device…
        </div>
      )}
      <div ref={bottomRef} />

      <form
        onSubmit={e => { e.preventDefault(); ask(input); }}
        className="sticky bottom-4 flex gap-2 bg-surface border-2 border-border-dark rounded-xl shadow-hard p-2"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Hal. Paano pumunta sa Quiapo galing Cubao?"
          className="flex-1 min-w-0 px-3 py-2 text-sm font-medium bg-transparent outline-none"
          disabled={busy}
        />
        <PrimaryButton type="submit" disabled={busy || !input.trim()} className="flex items-center gap-2 py-2 px-4 disabled:opacity-50">
          <Send className="w-4 h-4" />
          Ask
        </PrimaryButton>
      </form>
    </div>
  );
}

// ─── Scan tab ─────────────────────────────────────────────────────────────────

function ScanTab() {
  const [image, setImage] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraError('Camera not available — upload a photo instead.');
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setImage(resizeToDataUrl(v, v.videoWidth, v.videoHeight));
    setResult(null);
    stopCamera();
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    loadImageAsDataUrl(url).then(d => { setImage(d); setResult(null); }).finally(() => URL.revokeObjectURL(url));
  };

  const useSample = async () => {
    setImage(await loadImageAsDataUrl('/demo/sample-signboard.jpg'));
    setDestination(d => d || 'Cubao');
    setResult(null);
  };

  const scan = async () => {
    if (!image || busy) return;
    setBusy(true);
    setResult(null);
    const started = performance.now();
    try {
      const res = await fetch('/api/scan-signboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, destination }),
      });
      setResult(await res.json());
    } catch {
      setResult({ success: false, error: 'Could not reach the local ItinerYey server.' });
    } finally {
      setElapsedMs(performance.now() - started);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface border-2 border-border-dark rounded-xl shadow-hard p-5 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-bold px-4 py-2.5 rounded-lg border-2 border-border-dark bg-white hover:bg-soft-beige">
            <ImagePlus className="w-4 h-4" />
            Upload photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          </label>
          {cameraOn ? (
            <SecondaryButton onClick={stopCamera} className="flex items-center gap-2 py-2.5 px-4">
              <X className="w-4 h-4" /> Close camera
            </SecondaryButton>
          ) : (
            <SecondaryButton onClick={startCamera} className="flex items-center gap-2 py-2.5 px-4">
              <Camera className="w-4 h-4" /> Use camera
            </SecondaryButton>
          )}
          <SecondaryButton onClick={useSample} className="flex items-center gap-2 py-2.5 px-4">
            Try sample signboard
          </SecondaryButton>
        </div>
        {cameraError && <p className="text-xs font-bold text-red-600">{cameraError}</p>}

        {cameraOn && (
          <div className="flex flex-col gap-2">
            <video ref={videoRef} playsInline muted className="w-full max-h-80 object-contain rounded-lg bg-black" />
            <PrimaryButton onClick={capture} className="self-start flex items-center gap-2 py-2 px-4">
              <Camera className="w-4 h-4" /> Capture
            </PrimaryButton>
          </div>
        )}

        {image && !cameraOn && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="Signboard to scan" className="w-full max-h-72 object-contain rounded-lg bg-soft-beige border border-border-dark" />
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Saan ka bababa? (optional, e.g. Cubao)"
            className="flex-1 min-w-0 px-3 py-2.5 text-sm font-medium rounded-lg border-2 border-border-dark bg-white outline-none focus:border-accent-coral"
          />
          <PrimaryButton onClick={scan} disabled={!image || busy} className="flex items-center justify-center gap-2 py-2.5 px-5 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            {busy ? 'Reading on-device…' : 'Scan signboard'}
          </PrimaryButton>
        </div>
      </div>

      {result && !result.success && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm font-bold text-red-700">{result.error}</div>
      )}

      {result?.success && result.read && (
        <div className="flex flex-col gap-3">
          <div className="bg-soft-beige border border-border-dark rounded-xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-secondary mb-1">
              Read on-device by {result.ai?.model} in {secs(elapsedMs ?? undefined)}
            </p>
            <p className="text-lg font-black text-primary">{result.read.text || '—'}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.read.vehicle && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">{result.read.vehicle}</span>
              )}
              {result.read.places.map(p => (
                <span key={p} className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-border-dark">{p}</span>
              ))}
            </div>
          </div>

          {result.matches && result.matches.length > 0 ? (
            result.matches.map(m => (
              <div key={m.routeId} className="bg-surface border border-border-dark rounded-xl shadow-hard p-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded border bg-amber-100 text-amber-800 border-amber-300">
                    {m.transportType}
                  </span>
                  <span className="font-black text-primary">{m.signboard ?? `${m.origin} – ${m.destination}`}</span>
                  <span className="ml-auto font-black text-sm px-3 py-1 rounded-md border bg-accent-coral/10 text-accent-coral border-accent-coral/20">
                    up to ₱{m.totalFare}
                  </span>
                </div>
                <p className="text-xs font-medium text-secondary">
                  {m.stopCount} stops · {m.firstStop} → {m.lastStop}
                </p>
                {result.destination && (
                  m.passesThrough ? (
                    <p className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      Oo! Dadaan ito sa {m.passesThrough.stopName} — stop #{m.passesThrough.stopsAway}, about ₱{m.passesThrough.fareFromStart} from the terminal.
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-secondary bg-soft-beige border border-border-dark rounded-lg px-3 py-2">
                      Hindi ko makita ang &quot;{result.destination}&quot; sa ruta nito.
                    </p>
                  )
                )}
                {result.linkable && (
                  <a href={`/route/${m.routeId}`} className="text-xs font-bold text-accent-coral hover:underline self-start">View full route →</a>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm font-bold text-secondary">No matching route in the on-device index yet. Be the first to add it!</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function OfflineAssistant() {
  const [tab, setTab] = useState<'ask' | 'scan'>('ask');
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const online = useOnline();

  useEffect(() => {
    fetch('/api/assistant').then(r => r.json()).then(setStatus).catch(() => setStatus(null));
  }, []);

  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-2 px-4 py-2.5 text-sm font-black rounded-lg border-2 transition-colors
     ${active ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-border-dark hover:bg-soft-beige'}`;

  return (
    <div className="flex flex-col w-full">
      <StatusBar status={status} online={online} />
      <div className="flex gap-2 mb-5">
        <button type="button" className={tabCls(tab === 'ask')} onClick={() => setTab('ask')}>
          <MessageCircle className="w-4 h-4" /> Tanong (Ask)
        </button>
        <button type="button" className={tabCls(tab === 'scan')} onClick={() => setTab('scan')}>
          <ScanLine className="w-4 h-4" /> Scan signboard
        </button>
      </div>
      <div className={tab === 'ask' ? '' : 'hidden'}><AskTab /></div>
      <div className={tab === 'scan' ? '' : 'hidden'}><ScanTab /></div>
    </div>
  );
}
