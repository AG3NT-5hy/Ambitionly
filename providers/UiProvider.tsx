import createContextHook from '@nkzw/create-context-hook';
import React, { useCallback, useMemo, useState } from 'react';
import Toast from '../components/Toast'

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export const [UiProvider, useUi] = createContextHook(() => {
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const msg = String(message ?? '').slice(0, 500);
    setToast({ visible: true, message: msg, type });
  }, []);

  const hideToast = useCallback(() => setToast((t) => (t ? { ...t, visible: false } : t)), []);

  const ui = useMemo(() => ({ showToast, hideToast, toast }), [showToast, hideToast, toast]);

  return ui;
});

export function UiLayer() {
  const { toast, hideToast } = useUi();
  return (
    <Toast
      message={toast?.message ?? ''}
      visible={toast?.visible ?? false}
      type={toast?.type}
      onHide={hideToast}
      testID="ui-toast"
    />
  );
}
