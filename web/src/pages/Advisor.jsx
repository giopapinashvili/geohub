import { useEffect, useRef, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { categoryOf, PLACE_CATEGORIES } from '../features/places/categories.js';
import { bizCategoryLabel } from '../features/business/categories.js';
import { formatCommercePrice } from '../lib/commerce.js';
import '../styles/advisor.css';

const MESSAGE_LIMIT = 2000;
const EXAMPLES = ['evening', 'food', 'family'];
const EXAMPLE_ICONS = ['compass', 'fork-knife', 'users'];

function textValue(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function internalLink(value, map = false) {
  if (typeof value !== 'string' || /[\\\s]/.test(value)) return null;
  return (map ? /^\/map(?:\?|$)/ : /^\/(?:place|business|events|marketplace)\/[^/?#]+(?:[?#]|$)/).test(value) ? value : null;
}

function imageLink(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' || (url.origin === window.location.origin && value.startsWith('/') && !value.startsWith('//')) ? url.href : null;
  } catch { return null; }
}

function SourceCard({ card }) {
  const path = internalLink(card.path);
  const mapPath = internalLink(card.mapPath, true);
  const name = textValue(card.name || card.title) || t('common.untitled');
  const image = imageLink(card.image);
  const address = textValue(card.address) || textValue(card.city);
  const price = Number.isSafeInteger(card.priceMinor) ? formatCommercePrice(card.priceMinor, card.currency || 'GEL') : textValue(card.priceRange);
  const hours = textValue(card.hours);
  const rawCategory = textValue(card.category);
  const category = !path?.startsWith('/business/') && PLACE_CATEGORIES.some((item) => item.id === rawCategory) ? categoryOf({ category: rawCategory }).label : bizCategoryLabel(rawCategory);
  return (
    <article class="advisor-source">
      <div class="advisor-source-photo">
        <Icon name="map-pin" size={30} />
        {image && <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}
      </div>
      <div class="advisor-source-body">
        {category && <span class="advisor-source-category">{category}</span>}
        <h3>{name}</h3>
        {address && <p class="advisor-source-address"><Icon name="map-pin" size={14} /><span>{address}</span></p>}
        {card.description && <p class="advisor-source-description">{textValue(card.description)}</p>}
        <div class="advisor-source-facts">
          <span><Icon name="wallet" size={15} />{price || t('advisor.priceUnknown')}</span>
          {hours && <span><Icon name="clock" size={15} />{hours}</span>}
        </div>
        <div class="advisor-source-actions">
          {path && <Button href={path} variant="soft" size="sm" target="_blank" rel="noopener noreferrer">{t('advisor.openPage')}</Button>}
          {mapPath && <Button href={mapPath} variant="secondary" size="sm" icon="map-trifold" target="_blank" rel="noopener noreferrer">{t('advisor.onMap')}</Button>}
        </div>
      </div>
    </article>
  );
}

export default function Advisor() {
  useTitle(t('advisor.title'));
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [coverage, setCoverage] = useState(null);
  const [remainingTurns, setRemainingTurns] = useState(null);
  const requestRef = useRef(null);
  const statusRequestRef = useRef(null);
  const composerRef = useRef(null);
  const conversationRef = useRef(null);
  const nextIdRef = useRef(0);

  async function checkStatus() {
    statusRequestRef.current?.abort();
    const controller = new AbortController();
    statusRequestRef.current = controller;
    setChecking(true);
    setConnectionError('');
    try {
      const response = await fetch('/__advisor/status', { signal: controller.signal, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('advisor.connectionError'));
      if (statusRequestRef.current !== controller) return;
      setStatus(data);
      setCoverage(data.coverage || null);
      if (Number.isFinite(data.remainingTurns)) setRemainingTurns(Math.max(0, data.remainingTurns));
    } catch (err) {
      if (statusRequestRef.current !== controller || controller.signal.aborted) return;
      setStatus(null);
      setConnectionError(err.message || t('advisor.connectionError'));
    } finally {
      if (statusRequestRef.current === controller) {
        statusRequestRef.current = null;
        setChecking(false);
      }
    }
  }

  useEffect(() => {
    checkStatus();
    return () => {
      statusRequestRef.current?.abort();
      statusRequestRef.current = null;
      requestRef.current?.controller.abort();
      requestRef.current = null;
    };
  }, []);

  function showLatest() {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTo({ top: conversation.scrollHeight, behavior: 'auto' });
  }

  function useExample(example) {
    setDraft(t(`advisor.example.${example}`));
    composerRef.current?.focus();
  }

  async function sendMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || message.length > MESSAGE_LIMIT || requestRef.current || !status?.ready || checking || remainingTurns === 0) return;
    const id = ++nextIdRef.current;
    const controller = new AbortController();
    requestRef.current = { id, controller, message };
    const history = messages.filter((item) => item.complete).slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, MESSAGE_LIMIT) }));
    setMessages((previous) => [...previous, { id, role: 'user', content: message, state: 'waiting' }]);
    setDraft('');
    setError('');
    setBusy(true);
    setAnnouncement(t('advisor.thinking'));
    requestAnimationFrame(showLatest);
    try {
      const response = await fetch('/__advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-GeoHub-Advisor': 'local-preview' },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (requestRef.current?.id !== id) return;
      if (Number.isFinite(data.remainingTurns)) setRemainingTurns(Math.max(0, data.remainingTurns));
      if (!response.ok) throw new Error(data.error || t('advisor.replyError'));
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error(t('advisor.replyError'));
      if (requestRef.current?.id !== id) return;
      const reply = { id: ++nextIdRef.current, role: 'assistant', content: data.reply, complete: true, cards: Array.isArray(data.cards) ? data.cards.filter((card) => card && typeof card === 'object').slice(0, 8) : [] };
      setMessages((previous) => [...previous.map((item) => item.id === id ? { ...item, complete: true, state: 'complete' } : item), reply]);
      setCoverage(data.coverage || null);
      setAnnouncement(t('advisor.answerReady'));
    } catch (err) {
      if (requestRef.current?.id !== id) return;
      setMessages((previous) => previous.map((item) => item.id === id ? { ...item, state: 'failed' } : item));
      setDraft((current) => current || message);
      setError(err.message || t('advisor.replyError'));
      setAnnouncement('');
    } finally {
      if (requestRef.current?.id === id) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  function stopReply() {
    const pending = requestRef.current;
    if (!pending) return;
    requestRef.current = null;
    pending.controller.abort();
    setMessages((previous) => previous.map((item) => item.id === pending.id ? { ...item, state: 'stopped' } : item));
    setDraft((current) => current || pending.message);
    setBusy(false);
    setAnnouncement(t('advisor.stopped'));
    composerRef.current?.focus();
    checkStatus();
  }

  function clearChat() {
    const hadPendingRequest = Boolean(requestRef.current);
    requestRef.current?.controller.abort();
    requestRef.current = null;
    setMessages([]);
    setDraft('');
    setBusy(false);
    setError('');
    setAnnouncement(t('advisor.cleared'));
    composerRef.current?.focus();
    if (hadPendingRequest) checkStatus();
  }

  const connected = status?.ready && !checking;
  const count = Number.isFinite(coverage?.loaded) ? coverage.loaded : null;
  const lastIsReply = messages.at(-1)?.role === 'assistant';

  return (
    <div class="advisor-page">
      <header class="advisor-header">
        <div class="advisor-heading">
          <span class="advisor-mark"><Icon name="sparkle" size={26} /></span>
          <div><div class="advisor-eyebrow">GeoHub <span>AI</span></div><h1>{t('advisor.title')}</h1></div>
        </div>
        <span class="advisor-private"><Icon name="shield-check" size={16} />{t('advisor.private')}</span>
      </header>

      <div class="advisor-layout">
        <section class="advisor-chat" aria-label={t('advisor.conversation')}>
          <div class="advisor-chat-top">
            <div class={`advisor-connection${connected ? ' is-connected' : ''}`}>
              <span class="advisor-status-dot" aria-hidden="true" />
              <span>{checking ? t('advisor.connecting') : connected ? t('advisor.connected') : t('advisor.disconnected')}</span>
            </div>
            <Button variant="ghost" size="sm" icon="trash" disabled={!messages.length && !draft} onClick={clearChat}>{t('advisor.clear')}</Button>
          </div>

          <div ref={conversationRef} class="advisor-conversation" role="log" aria-label={t('advisor.conversation')} aria-live="off" tabIndex={0}>
            {!messages.length ? (
              <div class="advisor-welcome">
                <div class="advisor-welcome-symbol" aria-hidden="true"><Icon name="compass" size={38} /></div>
                <span class="advisor-kicker">{t('advisor.kicker')}</span>
                <h2>{t('advisor.welcome')}</h2>
                <p>{t('advisor.intro')}</p>
                <div class="advisor-examples">
                  {EXAMPLES.map((example, index) => <button key={example} type="button" class="advisor-example" onClick={() => useExample(example)}><span class="advisor-example-icon"><Icon name={EXAMPLE_ICONS[index]} size={20} /></span><span>{t(`advisor.exampleLabel.${example}`)}</span><Icon name="arrow-up-right" size={16} /></button>)}
                </div>
              </div>
            ) : <div class="advisor-messages">{messages.map((message) => (
              <article key={message.id} class={`advisor-message advisor-message-${message.role}`}>
                <div class="advisor-message-author">{message.role === 'assistant' && <Icon name="sparkle" size={15} />}{t(message.role === 'user' ? 'advisor.you' : 'advisor.title')}</div>
                <div class="advisor-message-text">{message.content}</div>
                {message.state === 'stopped' && <p class="advisor-message-note">{t('advisor.stopped')}</p>}
                {message.state === 'failed' && <p class="advisor-message-note">{t('advisor.failed')}</p>}
                {message.cards?.length > 0 && <section class="advisor-sources" aria-label={t('advisor.sources')}><div class="advisor-sources-heading"><Icon name="map-pin" size={16} /><span>{t('advisor.sources')}</span><span class="advisor-sources-count">{message.cards.length}</span></div><div class="advisor-source-grid">{message.cards.map((card, index) => <SourceCard key={`${card.key || ''}-${index}`} card={card} />)}</div></section>}
              </article>
            ))}</div>}
          </div>

          <div class="advisor-feedback">
            <p class={`advisor-progress${busy ? ' is-busy' : ''}`} role="status" aria-live="polite" aria-atomic="true">{busy && <span class="advisor-thinking-dot" aria-hidden="true" />}{announcement}</p>
            {lastIsReply && !busy && <button type="button" class="advisor-jump" onClick={showLatest}>{t('advisor.viewReply')}<Icon name="caret-down" size={14} /></button>}
          </div>
          {error && <div class="advisor-error" role="alert"><Icon name="warning" size={18} /><span>{error}</span></div>}
          {connectionError && <div class="advisor-error" role="alert"><span>{connectionError}</span><Button variant="secondary" size="sm" onClick={checkStatus}>{t('common.retry')}</Button></div>}
          {!checking && !status?.ready && !connectionError && <div class="advisor-offline"><p>{textValue(status?.note) || t('advisor.connectionError')}</p><Button variant="secondary" size="sm" icon="arrow-clockwise" onClick={checkStatus}>{t('advisor.reconnect')}</Button></div>}

          <form class="advisor-composer" onSubmit={sendMessage}>
            <label for="advisor-message">{t('advisor.messageLabel')}</label>
            <textarea ref={composerRef} id="advisor-message" name="message" value={draft} onInput={(event) => setDraft(event.currentTarget.value)} rows={3} maxLength={MESSAGE_LIMIT} placeholder={t('advisor.placeholder')} aria-describedby="advisor-composer-hint" onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} />
            <div class="advisor-composer-bottom">
              <span id="advisor-composer-hint">{t('advisor.keyboardHint')} <span class="advisor-character-count">{draft.length}/{MESSAGE_LIMIT}</span></span>
              {busy ? <Button variant="secondary" icon="stop" onClick={stopReply}>{t('advisor.stop')}</Button> : <Button variant="primary" type="submit" iconRight="arrow-up" disabled={!connected || !draft.trim() || remainingTurns === 0}>{t('common.send')}</Button>}
            </div>
          </form>
          {remainingTurns === 0 && <p class="advisor-limit-note" role="status">{t('advisor.limitReached')}</p>}
          <p class="advisor-session-note"><Icon name="shield-check" size={13} />{t('advisor.sessionNote')}</p>
        </section>

        <aside class="advisor-context" aria-label={t('advisor.contextTitle')}>
          <section class="advisor-context-card">
            <span class="advisor-context-icon"><Icon name="map-trifold" size={24} /></span>
            <h2>{t('advisor.contextTitle')}</h2>
            <p>{t('advisor.contextText')}</p>
            <div class="advisor-data-label"><span class="advisor-data-dot" />{t('advisor.sourceLabel')}</div>
            {count !== null && <div class="advisor-data-count"><strong>{count}</strong><span>{t('advisor.loadedRecords')}</span></div>}
            <p class="advisor-data-note">{t('advisor.partialNote')}</p>
            <a class="advisor-map-link" href="/map" target="_blank" rel="noopener noreferrer">{t('advisor.browseMap')}<Icon name="arrow-up-right" size={17} /></a>
          </section>
          <section class="advisor-context-card advisor-how">
            <h2>{t('advisor.howTitle')}</h2>
            <ol><li><span>1</span>{t('advisor.howOne')}</li><li><span>2</span>{t('advisor.howTwo')}</li><li><span>3</span>{t('advisor.howThree')}</li></ol>
          </section>
          {remainingTurns !== null && <p class="advisor-turns"><strong>{remainingTurns}</strong><span>{t('advisor.remainingTurns')}</span></p>}
          <p class="advisor-provider-note">{t('advisor.providerNote')}</p>
        </aside>
      </div>
    </div>
  );
}
