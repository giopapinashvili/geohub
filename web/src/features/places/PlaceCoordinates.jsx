import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { t } from '../../lib/i18n.js';
import { formatCoordinates } from '../../lib/coordinates.js';
import '../../styles/place-coordinates.css';

/** Copy the exact displayed pair. If clipboard permission fails, select it. */
export function PlaceCoordinates({ place, compact = false, showMissing = false }) {
  const text = formatCoordinates(place);
  const valueRef = useRef(null);
  const timerRef = useRef(null);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    setFeedback('');
    return () => clearTimeout(timerRef.current);
  }, [text]);

  const copy = async () => {
    clearTimeout(timerRef.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (valueRef.current?.textContent !== text) return;
      setFeedback(t('place.coordinatesCopied'));
    } catch {
      if (valueRef.current?.textContent !== text) return;
      // Keep a usable native text-selection fallback without claiming success.
      const range = document.createRange();
      range.selectNodeContents(valueRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setFeedback(t('place.coordinatesCopyFailed'));
    }
    timerRef.current = setTimeout(() => setFeedback(''), 6000);
  };

  if (!text) return showMissing ? <p class="place-coordinates-missing"><Icon name="crosshair" size={16} />{t('place.coordinatesMissing')}</p> : null;
  return (
    <div class={`place-coordinates${compact ? ' is-compact' : ''}`} data-testid="place-coordinates">
      <div class="place-coordinates-line">
        <Icon name="crosshair" size={17} />
        <div class="place-coordinates-text">
          {!compact && <span class="place-coordinates-label">{t('place.coordinates')}</span>}
          <span ref={valueRef} class="place-coordinates-value" dir="ltr">{text}</span>
        </div>
        <button type="button" class="place-coordinates-copy" onClick={copy} aria-label={t('place.coordinatesCopy')} title={t('place.coordinatesCopy')}><Icon name={feedback === t('place.coordinatesCopied') ? 'check' : 'copy'} size={17} /></button>
      </div>
      <span class="place-coordinates-feedback" role="status" aria-live="polite">{feedback}</span>
    </div>
  );
}
