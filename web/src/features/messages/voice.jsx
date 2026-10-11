// Voice messages: recording in the composer and a compact player in bubbles.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { t } from '../../lib/i18n.js';

export const VOICE_MAX_SECONDS = 120;

export const clock = (s) => {
  const v = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export const canRecordVoice = () =>
  typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined';

function pickMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    try { if (window.MediaRecorder.isTypeSupported?.(m)) return m; } catch { /* ignore */ }
  }
  return '';
}

/**
 * Microphone recording with MediaRecorder.
 * start() asks for the microphone; stop() resolves { blob, duration, type };
 * cancel() throws the recording away. Stops on its own at VOICE_MAX_SECONDS.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef(null);

  const cleanup = () => {
    const r = rec.current;
    if (!r) return;
    clearInterval(r.timer);
    r.stream.getTracks().forEach((track) => track.stop());
    rec.current = null;
    setRecording(false);
    setSeconds(0);
  };

  useEffect(() => () => {
    const r = rec.current;
    if (r) { r.resolve = null; try { r.recorder.stop(); } catch { /* ignore */ } cleanup(); }
  }, []);

  const start = async () => {
    if (rec.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = pickMime();
    let recorder;
    try { recorder = new window.MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined); }
    catch (e) { stream.getTracks().forEach((track) => track.stop()); throw e; }
    const r = { recorder, stream, chunks: [], started: Date.now(), timer: null, resolve: null };
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || 'audio/webm';
      const blob = new Blob(r.chunks, { type });
      const duration = (Date.now() - r.started) / 1000;
      const done = r.resolve;
      cleanup();
      done?.({ blob, duration, type });
    };
    recorder.start(250);
    r.timer = setInterval(() => setSeconds(Math.floor((Date.now() - r.started) / 1000)), 250);
    rec.current = r;
    setRecording(true);
  };

  const stop = () => new Promise((resolve) => {
    const r = rec.current;
    if (!r) { resolve(null); return; }
    r.resolve = resolve;
    try { r.recorder.stop(); } catch { cleanup(); resolve(null); }
  });

  const cancel = () => {
    const r = rec.current;
    if (!r) return;
    r.resolve = null;
    try { r.recorder.stop(); } catch { cleanup(); }
  };

  return { recording, seconds, start, stop, cancel };
}

/** Cloudinary keeps the recorded file as-is; an .mp3 rendition plays in every browser (Safari too). */
export function playableAudio(url) {
  return /res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(url || '')
    ? url.replace(/\.(webm|weba|ogg|oga|opus|m4a|mp4|wav)(\?.*)?$/i, '.mp3')
    : url;
}

/** Compact voice/audio player for a message bubble. */
export function VoiceNote({ url, duration = 0, mine = false }) {
  const audio = useRef(null);
  const [src, setSrc] = useState(() => playableAudio(url));
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [len, setLen] = useState(Number(duration) || 0);

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      // Only one voice message plays at a time.
      document.querySelectorAll('audio.voice-audio').forEach((x) => { if (x !== a) x.pause(); });
      a.play().catch(() => { if (src !== url) setSrc(url); });
    } else a.pause();
  };
  const seek = (e) => {
    const a = audio.current;
    if (!a || !len) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.min(len, Math.max(0, ((e.clientX - r.left) / r.width) * len));
  };
  const pct = len ? Math.min(100, (pos / len) * 100) : 0;

  return (
    <div class={`voice-note${mine ? ' is-mine' : ''}`}>
      <button type="button" class="voice-play" onClick={toggle} aria-label={t(playing ? 'messages.pauseVoice' : 'messages.playVoice')}>
        <Icon name={playing ? 'pause-fill' : 'play-fill'} size={16} />
      </button>
      <div class="voice-track" onClick={seek} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <span class="voice-time">{clock(playing || pos ? pos : len)}</span>
      <audio ref={audio} class="voice-audio" src={src} preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setLen(d); }}
        onError={() => { if (src !== url) setSrc(url); }} />
    </div>
  );
}
