'use client';

import Script from 'next/script';
import { useEffect } from 'react';

export function SiteEnhancements() {
  useEffect(() => {
    const sheet = document.getElementById('sheet');
    const opener = document.querySelector<HTMLElement>('[data-sheet-open]');
    if (!sheet || !opener) return;
    let previousFocus: HTMLElement | null = null;
    let focusFrame = 0;
    function focusAfterOpening(attempt = 0) {
      if (!sheet?.classList.contains('is-open')) return;
      const first = controls()[0];
      first?.focus({ preventScroll: true });
      if (document.activeElement !== first && attempt < 60) {
        focusFrame = requestAnimationFrame(() => focusAfterOpening(attempt + 1));
      }
    }
    const controls = () => Array.from(sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'))
      .filter(element => element.getClientRects().length > 0);

    function close() {
      cancelAnimationFrame(focusFrame);
      sheet!.classList.remove('is-open');
      sheet!.style.removeProperty('visibility');
      document.body.classList.remove('is-locked');
      opener!.setAttribute('aria-expanded', 'false');
      previousFocus?.focus();
    }
    function open() {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : opener;
      sheet!.classList.add('is-open');
      // Make focusability deterministic rather than racing a CSS visibility transition.
      sheet!.style.visibility = 'visible';
      document.body.classList.add('is-locked');
      opener!.setAttribute('aria-expanded', 'true');
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => focusAfterOpening());
    }
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-sheet-open]')) open();
      else if (target.closest('[data-sheet-close], #sheet a[href]')) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!sheet!.classList.contains('is-open')) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !sheet!.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sheet!.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('is-locked');
    };
  }, []);
  return <Script src="/site.js" strategy="afterInteractive" />;
}
