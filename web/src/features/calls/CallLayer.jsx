import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { t } from '../../lib/i18n.js';
import { uid } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { call, listenIncoming, answerCall, declineCall, hangUp, toggleMute, toggleCamera } from '../../data/calls.js';

function Media({ stream, muted, class: cls }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream, stream?.getTracks().length]);
  return <video ref={ref} class={cls} autoPlay playsInline muted={muted} />;
}

function useTimer(since) {
  const [, tick] = useState(0);
  useEffect(() => { if (!since) return undefined; const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, [since]);
  if (!since) return '';
  const s = Math.floor((Date.now() - since) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Btn({ icon, label, onClick, tone, on }) {
  return (
    <button type="button" class={`call-btn${on ? ' is-on' : ''}`} style={tone ? { '--tone': tone } : undefined} onClick={onClick} aria-label={label} aria-pressed={on === undefined ? undefined : !!on}>
      <span class="call-btn-ico"><Icon name={icon} size={26} /></span><span class="call-btn-label">{label}</span>
    </button>
  );
}

/** Full-screen call UI: incoming ring, calling, connected (voice or video), ended. */
export function CallLayer() {
  useEffect(() => listenIncoming(), [uid.value]);
  const c = call.value;
  const timer = useTimer(c?.status === 'active' ? c.startedAt : 0);
  useEffect(() => {
    if (c?.status !== 'incoming') return undefined;
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    const prev = document.title;
    document.title = `📞 ${c.peer.name}`;
    return () => { document.title = prev; };
  }, [c?.status, c?.id]);
  if (!c) return null;
  const video = c.type === 'video';
  const status = c.status === 'incoming' ? t(video ? 'call.incomingVideo' : 'call.incoming')
    : c.status === 'ringing' ? t('call.ringing')
    : c.status === 'connecting' ? t('call.connecting')
    : c.status === 'active' ? timer
    : t(`call.end.${c.reason || 'ended'}`);
  const answer = () => answerCall().catch(() => { toast.error(t('call.noDevice')); declineCall(); });
  const showRemoteVideo = video && c.remoteStream && c.status !== 'ended';
  return createPortal(
    <div class={`call-layer${showRemoteVideo ? ' has-video' : ''}`} role="dialog" aria-modal="true" aria-label={t('call.title')}>
      {showRemoteVideo && <Media stream={c.remoteStream} class="call-remote" />}
      {!video && c.remoteStream && <Media stream={c.remoteStream} class="call-audio-sink" />}
      {video && c.localStream && !c.cameraOff && <Media stream={c.localStream} muted class="call-local" />}
      <div class="call-info">
        {!showRemoteVideo && <div class={`call-avatar${c.status === 'incoming' || c.status === 'ringing' ? ' is-ringing' : ''}`}><Avatar src={c.peer.avatar} name={c.peer.name || ''} size={128} /></div>}
        <h2 class="call-name">{c.peer.name}</h2>
        <p class="call-status">{status}</p>
      </div>
      <div class="call-controls">
        {c.status === 'incoming' ? (
          <>
            <Btn icon="phone-disconnect" label={t('call.decline')} tone="#ef4444" onClick={declineCall} />
            <Btn icon={video ? 'video-camera' : 'phone'} label={t('call.answer')} tone="#22c55e" onClick={answer} />
          </>
        ) : c.status !== 'ended' ? (
          <>
            <Btn icon={c.muted ? 'microphone-slash' : 'microphone'} label={t(c.muted ? 'call.unmute' : 'call.mute')} on={c.muted} onClick={toggleMute} />
            {video && <Btn icon={c.cameraOff ? 'video-camera-slash' : 'video-camera'} label={t(c.cameraOff ? 'call.cameraOn' : 'call.cameraOff')} on={c.cameraOff} onClick={toggleCamera} />}
            <Btn icon="phone-disconnect" label={t('call.hangUp')} tone="#ef4444" onClick={() => hangUp('ended')} />
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
