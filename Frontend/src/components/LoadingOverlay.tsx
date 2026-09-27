import { useState, useEffect } from 'react';
import { subscribeTransmissionStatus } from '../services/api';

export default function LoadingOverlay() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    return subscribeTransmissionStatus(setStatus);
  }, []);

  if (!status) return null;

  return (
    <div
      role="alert"
      aria-busy="true"
      aria-live="assertive"
      className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 select-none cursor-wait"
      tabIndex={-1}
    >
      <div className="max-w-md w-full rounded-xl bg-white border border-slate-200 p-8 shadow-2xl flex flex-col items-center text-center space-y-4">
        {/* Institutional Dual-Ring Deep Teal Spinner */}
        <div className="relative w-14 h-14 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-3 border-slate-200 border-t-drdo animate-spin" />
          <div
            className="w-8 h-8 rounded-full border-2 border-slate-100 border-b-drdo-light animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.2s' }}
          />
        </div>

        <div className="space-y-1.5">
          <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider bg-drdo-50 text-drdo border border-drdo-200 uppercase">
            RAC Technical Assessment Engine
          </span>
          <p className="text-base font-semibold text-slate-900 tracking-tight">
            {status}
          </p>
          <p className="text-xs text-slate-500">
            Please wait while the institutional screening pipeline processes your request.
          </p>
        </div>
      </div>
    </div>
  );
}
