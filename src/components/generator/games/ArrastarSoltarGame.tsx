/**
 * Jogo Arrastar e Soltar (Drag & Drop) — preview interativo.
 *
 * Canvas HTML5 que renderiza 5 formas geométricas e suas respectivas
 * "zonas de encaixe" abaixo. O aluno arrasta cada peça até a silhueta
 * correta. Usado como mockup do mecanismo do jogo final.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Move, Check } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Shape {
  id: string;
  type: "square" | "circle" | "triangle" | "hexagon" | "trapezoid";
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
  locked?: boolean;
}

// ─── Conjunto inicial de formas ──────────────────────────────────────────────
const INITIAL_SHAPES: Shape[] = [
  { id: "sq", type: "square", x: 60, y: 60, size: 70, color: "#6366f1", label: "Quadrado" },
  { id: "ci", type: "circle", x: 220, y: 70, size: 70, color: "#f43f5e", label: "Círculo" },
  { id: "tr", type: "triangle", x: 370, y: 55, size: 80, color: "#10b981", label: "Triângulo" },
  { id: "hx", type: "hexagon", x: 520, y: 60, size: 70, color: "#f59e0b", label: "Hexágono" },
  { id: "tp", type: "trapezoid", x: 670, y: 70, size: 75, color: "#8b5cf6", label: "Trapézio" },
];

/**
 * Polyfill simples de retângulo arredondado em Canvas2D
 * (alguns navegadores não tinham roundRect nativo até pouco tempo).
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Desenha uma forma no contexto, com sombra mais forte quando ativa */
function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  isActive: boolean,
) {
  const { type, x, y, size, color } = shape;
  ctx.save();
  ctx.shadowColor = isActive ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.12)";
  ctx.shadowBlur = isActive ? 24 : 10;
  ctx.shadowOffsetY = isActive ? 8 : 3;
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 3;

  const halfSize = size / 2;

  ctx.beginPath();
  if (type === "square") {
    drawRoundedRect(ctx, x - halfSize, y - halfSize, size, size, 14);
  } else if (type === "circle") {
    ctx.arc(x, y, halfSize, 0, Math.PI * 2);
  } else if (type === "triangle") {
    ctx.moveTo(x, y - halfSize);
    ctx.lineTo(x + halfSize, y + halfSize);
    ctx.lineTo(x - halfSize, y + halfSize);
    ctx.closePath();
  } else if (type === "hexagon") {
    for (let k = 0; k < 6; k++) {
      const angle = (Math.PI / 3) * k - Math.PI / 6;
      const px = x + halfSize * Math.cos(angle);
      const py = y + halfSize * Math.sin(angle);
      if (k === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
  } else if (type === "trapezoid") {
    const top = size * 0.55;
    ctx.moveTo(x - top / 2, y - halfSize * 0.7);
    ctx.lineTo(x + top / 2, y - halfSize * 0.7);
    ctx.lineTo(x + halfSize, y + halfSize * 0.7);
    ctx.lineTo(x - halfSize, y + halfSize * 0.7);
    ctx.closePath();
  }

  ctx.fill();
  ctx.stroke();

  // Etiqueta
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `bold ${Math.round(size * 0.17)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(shape.label, x, type === "triangle" ? y + halfSize * 0.25 : y);

  ctx.restore();
}

/** Teste de clique em uma forma (círculo usa distância euclidiana; demais AABB). */
function hitTest(shape: Shape, mx: number, my: number): boolean {
  const { type, x, y, size } = shape;
  const halfSize = size / 2;
  if (type === "circle") {
    return Math.hypot(mx - x, my - y) <= halfSize;
  }
  return (
    mx >= x - halfSize &&
    mx <= x + halfSize &&
    my >= y - halfSize &&
    my <= y + halfSize
  );
}

// ─── Componente Canvas ───────────────────────────────────────────────────────
export const ArrastarSoltarCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<Shape[]>(INITIAL_SHAPES);
  const shapesRef = useRef<Shape[]>(INITIAL_SHAPES);
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Mantém o ref em sincronia com o estado para uso dentro dos listeners
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  /** Desenha cenário completo: fundo, zonas de encaixe, grid e formas */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fundo
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 20);
    ctx.fill();

    // Drop Zones (silhuetas pontilhadas abaixo de cada forma original)
    INITIAL_SHAPES.forEach((s) => {
      const dropX = s.x;
      const dropY = s.y + 160; // deslocamento vertical

      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(241, 245, 249, 0.5)";

      const size = s.size;
      const halfSize = size / 2;

      ctx.beginPath();
      if (s.type === "square") {
        drawRoundedRect(
          ctx,
          dropX - halfSize,
          dropY - halfSize,
          size,
          size,
          14,
        );
      } else if (s.type === "circle") {
        ctx.arc(dropX, dropY, halfSize, 0, Math.PI * 2);
      } else if (s.type === "triangle") {
        ctx.moveTo(dropX, dropY - halfSize);
        ctx.lineTo(dropX + halfSize, dropY + halfSize);
        ctx.lineTo(dropX - halfSize, dropY + halfSize);
        ctx.closePath();
      } else if (s.type === "hexagon") {
        for (let k = 0; k < 6; k++) {
          const angle = (Math.PI / 3) * k - Math.PI / 6;
          const px = dropX + halfSize * Math.cos(angle);
          const py = dropY + halfSize * Math.sin(angle);
          if (k === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
      } else if (s.type === "trapezoid") {
        const top = size * 0.55;
        ctx.moveTo(dropX - top / 2, dropY - halfSize * 0.7);
        ctx.lineTo(dropX + top / 2, dropY - halfSize * 0.7);
        ctx.lineTo(dropX + halfSize, dropY + halfSize * 0.7);
        ctx.lineTo(dropX - halfSize, dropY + halfSize * 0.7);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Rótulo da zona
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 8px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ENCAIXE", dropX, dropY);
    });

    // Grid leve de fundo
    ctx.strokeStyle = "rgba(148,163,184,0.1)";
    ctx.lineWidth = 1;
    for (let gx = 40; gx < canvas.width; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, canvas.height);
      ctx.stroke();
    }
    for (let gy = 40; gy < canvas.height; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(canvas.width, gy);
      ctx.stroke();
    }

    // Formas não-ativas primeiro, depois a ativa em cima
    const activeId = dragRef.current?.id;
    shapesRef.current
      .filter((s) => s.id !== activeId)
      .forEach((s) => drawShape(ctx, s, false));
    if (activeId) {
      const active = shapesRef.current.find((s) => s.id === activeId);
      if (active) drawShape(ctx, active, true);
    }
  }, []);

  useEffect(() => {
    draw();
  }, [shapes, draw]);

  /** Converte coordenadas do mouse/touch em coordenadas internas do canvas */
  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const { x, y } = getPos(e, canvas);
      // Hit test do topo para baixo (item visualmente em cima tem prioridade)
      const hit = [...shapesRef.current]
        .reverse()
        .find((s) => hitTest(s, x, y));
      if (!hit || hit.locked) return;
      dragRef.current = { id: hit.id, offsetX: x - hit.x, offsetY: y - hit.y };
      // Move o item arrastado para o topo da ordem de desenho
      setShapes((prev) => {
        const rest = prev.filter((s) => s.id !== hit.id);
        const found = prev.find((s) => s.id === hit.id)!;
        return [...rest, found];
      });
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const { x, y } = getPos(e, canvas);
      const { id, offsetX, offsetY } = dragRef.current;
      setShapes((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, x: x - offsetX, y: y - offsetY } : s,
        ),
      );
    };

    const onUp = () => {
      if (dragRef.current) {
        const { id } = dragRef.current;
        const initial = INITIAL_SHAPES.find(s => s.id === id);
        if (initial) {
          const dropX = initial.x;
          const dropY = initial.y + 160;
          
          setShapes((prev) => {
             return prev.map(s => {
                if (s.id === id) {
                   const dist = Math.hypot(s.x - dropX, s.y - dropY);
                   if (dist < 40) {
                      return { ...s, x: dropX, y: dropY, locked: true };
                   }
                }
                return s;
             });
          });
        }
      }
      dragRef.current = null;
      draw();
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("touchstart", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [draw]);

  const handleReset = () => {
    setShapes(INITIAL_SHAPES);
    shapesRef.current = INITIAL_SHAPES;
  };

  // Expõe um método para exportação como PNG no PDF
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    (canvas as HTMLCanvasElement & { __getExportDataURL?: () => string }).__getExportDataURL = () => canvas.toDataURL("image/png");
  });

  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden print:break-inside-avoid"
      id="drag-drop-canvas-section"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-violet-50/50 border-violet-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Move className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-violet-200 font-black text-lg">3</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[12.1px]">
              Canvas Drag &amp; Drop
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">
            Arraste para revelar as questões
          </span>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-violet-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-violet-600 transition-all active:scale-95 cursor-pointer"
          >
            Resetar
          </button>
        </div>
      </div>
      <div className="p-8 relative">
        <div className="flex gap-3 mb-4">
          {INITIAL_SHAPES.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ background: s.color }}
              />
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width={800}
          height={320}
          className="w-full rounded-2xl border border-slate-100 cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
        />
        <p className="text-[11px] text-slate-300 font-black uppercase tracking-widest text-center mt-4">
          Arraste os objetos para as zonas de encaixe para revelar os desafios
          pedagógicos.
        </p>
        
        {shapes.every(s => s.locked) && (
           <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
             <div className="bg-white p-6 rounded-2xl shadow-xl border border-emerald-200 flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                   <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest mb-2">Parabéns!</h3>
                <p className="text-sm font-medium text-slate-500 mb-6 text-center">Você encaixou todas as formas corretamente.</p>
                <button
                   onClick={handleReset}
                   className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 cursor-pointer"
                >
                   Jogar Novamente
                </button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};
