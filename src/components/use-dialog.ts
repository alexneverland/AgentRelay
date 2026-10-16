// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
'use client';
import { useEffect, useRef } from 'react';

export function useDialog(onClose: () => void, busy = false) {
  const panel = useRef<HTMLElement>(null);
  const state = useRef({ onClose, busy });
  useEffect(() => {
    state.current = { onClose, busy };
  }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const target = panel.current;
    const selector =
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]';
    target?.querySelector<HTMLElement>(selector)?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !state.current.busy) {
        e.preventDefault();
        state.current.onClose();
        return;
      }
      if (e.key !== 'Tab' || !target) return;
      const elements = [...target.querySelectorAll<HTMLElement>(selector)];
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, []);
  return panel;
}
