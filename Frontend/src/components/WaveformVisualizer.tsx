import { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  active?: boolean;
  bars?: number;
  color?: 'cyan' | 'gold' | 'emerald';
  height?: number;
}

const colorMap = {
  cyan: '#06B6D4',
  gold: '#F59E0B',
  emerald: '#10B981',
};

export default function WaveformVisualizer({ active = true, bars = 24, color = 'cyan', height = 32 }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const barWidth = canvas.offsetWidth / bars;
    const gap = 2;
    const strokeColor = colorMap[color];

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, height);
      phaseRef.current += 0.08;

      for (let i = 0; i < bars; i++) {
        const phase = phaseRef.current + i * 0.3;
        const baseHeight = active
          ? (Math.sin(phase) * 0.4 + Math.sin(phase * 2.3) * 0.3 + 0.5) * height * 0.8
          : height * 0.08;
        const barHeight = Math.max(2, baseHeight);
        const x = i * barWidth + gap / 2;
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, strokeColor);
        gradient.addColorStop(1, `${strokeColor}40`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - gap, barHeight);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(rafRef.current);
  }, [active, bars, color, height]);

  return <canvas ref={canvasRef} style={{ width: '100%', height }} className="opacity-80" />;
}
