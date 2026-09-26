import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef, useState, useCallback } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { useClickOutside, useEscape, useBodyLock, bp } from '../lib/hooks.js';

/**
 * Popover anchored to its trigger. On phones it becomes a bottom sheet.
 * `trigger(props)` must spread `props` onto a button.
 * `children` may be a function receiving `close`.
 */
export function Popover({ trigger, children, align = 'end', width = 280, sheetOnMobile = true, label }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const pop = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  const sheet = sheetOnMobile && bp.value === 'sm';

  useClickOutside(pop, (e) => { if (!btn.current?.contains(e.target)) close(); }, open);
  useEscape(() => { close(); btn.current?.focus(); }, open);
  useBodyLock(open && sheet);

  useLayoutEffect(() => {
    if (!open || sheet || !btn.current) return;
    const place = () => {
      const r = btn.current.getBoundingClientRect();
      const w = Math.min(width, window.innerWidth - 16);
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      const below = window.innerHeight - r.bottom;
      const top = below < 260 && r.top > below ? null : r.bottom + 6;
      setPos({ left, top, bottom: top == null ? window.innerHeight - r.top + 6 : null, width: w, maxH: (top == null ? r.top : below) - 16 });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, sheet, width, align]);

  const triggerProps = {
    ref: btn,
    'aria-haspopup': 'menu',
    'aria-expanded': open ? 'true' : 'false',
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); },
  };

  return (
    <>
      {trigger(triggerProps, open)}
      {open && createPortal(
        sheet ? (
          <div class="sheet-layer" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div ref={pop} class="sheet" role="dialog" aria-label={label}>
              <div class="sheet-grip" aria-hidden="true" />
              {typeof children === 'function' ? children(close) : children}
            </div>
          </div>
        ) : pos && (
          <div
            ref={pop}
            class="popover"
            style={{ left: pos.left, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined, width: pos.width, maxHeight: Math.max(200, pos.maxH) }}
          >
            {typeof children === 'function' ? children(close) : children}
          </div>
        ),
        document.body,
      )}
    </>
  );
}

/** Action menu built on Popover. items: [{ icon, label, onClick, href, danger, hidden, sub }] */
export function Menu({ trigger, items, align = 'end', width = 280, label }) {
  const visible = items.filter((i) => i && !i.hidden);
  return (
    <Popover trigger={trigger} align={align} width={width} label={label}>
      {(close) => (
        <div class="menu" role="menu" onKeyDown={(e) => {
          const els = Array.from(e.currentTarget.querySelectorAll('.menu-item'));
          const i = els.indexOf(document.activeElement);
          if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
        }}>
          {visible.map((it, idx) => it.divider ? <div key={idx} class="menu-divider" role="separator" /> : (
            it.href ? (
              <a key={idx} role="menuitem" class={`menu-item${it.danger ? ' is-danger' : ''}`} href={it.href} onClick={close}>
                {it.icon && <span class="menu-icon"><Icon name={it.icon} size={20} /></span>}
                <span class="menu-text"><span class="menu-label">{it.label}</span>{it.sub && <span class="menu-sub">{it.sub}</span>}</span>
              </a>
            ) : (
              <button key={idx} type="button" role="menuitem" class={`menu-item${it.danger ? ' is-danger' : ''}`} onClick={() => { close(); it.onClick?.(); }}>
                {it.icon && <span class="menu-icon"><Icon name={it.icon} size={20} /></span>}
                <span class="menu-text"><span class="menu-label">{it.label}</span>{it.sub && <span class="menu-sub">{it.sub}</span>}</span>
              </button>
            )
          ))}
        </div>
      )}
    </Popover>
  );
}
