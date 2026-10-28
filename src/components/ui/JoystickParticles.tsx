import { useEffect, useRef, useState } from "react";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "../../lib/firebase";

export function JoystickParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [joystickUrl, setJoystickUrl] = useState<string | null>(null);

  useEffect(() => {
    // Tenta carregar Logos/joystick.png primeiro, usa joystick.png se falhar
    getDownloadURL(ref(storage, "Logos/joystick.png"))
      .then((url) => {
        setJoystickUrl(url);
      })
      .catch((error) => {
        console.warn("Could not load Logos/joystick.png, trying root joystick.png...", error);
        getDownloadURL(ref(storage, "joystick.png"))
          .then((url) => {
            setJoystickUrl(url);
          })
          .catch((err) => {
            console.error("Error loading joystick image from both locations:", err);
          });
      });
  }, []);

  useEffect(() => {
    if (!joystickUrl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    // NÃO defina crossOrigin para evitar bloqueios de CORS nos arquivos do Firebase Storage
    
    let animationFrameId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];
    
    const NUM_PARTICLES = 45; // Maior densidade para preencher mais a tela
    const MAX_DISTANCE = 150; // Distância máxima para desenhar as linhas de conexão

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener("resize", resize);
    resize();

    let isDrawingStarted = false;

    const startDrawing = () => {
      if (isDrawingStarted) return;
      isDrawingStarted = true;

      // Pré-renderiza a imagem invertida em um canvas oculto para ganho massivo de FPS
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = img.width;
      offscreenCanvas.height = img.height;
      const offCtx = offscreenCanvas.getContext('2d');
      if (offCtx) {
        offCtx.filter = "brightness(0) invert(1)";
        offCtx.drawImage(img, 0, 0);
      }
      const particleImage = offCtx ? offscreenCanvas : img;

      // Inicializa as partículas
      for (let i = 0; i < NUM_PARTICLES; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          size: Math.random() * 20 + 16, // Tamanho aumentado (entre 16px e 36px)
          opacity: Math.random() * 0.25 + 0.15, // Opacidade e brilho aumentados
        });
      }

      const draw = () => {
        if (!canvasRef.current) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Atualiza e desenha as conexões (Linhas)
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < MAX_DISTANCE) {
              // Suaviza a linha de conexão de acordo com a distância
              const lineOpacity = (1 - distance / MAX_DISTANCE) * 0.35; // Brilho da linha aumentado
              ctx.beginPath();
              ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
              ctx.lineWidth = 1;
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }

        // Desenha as partículas (Joysticks)
        particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;

          // Bate nas bordas e volta de forma contínua
          if (p.x < -50) p.x = canvas.width + 50;
          if (p.x > canvas.width + 50) p.x = -50;
          if (p.y < -50) p.y = canvas.height + 50;
          if (p.y > canvas.height + 50) p.y = -50;

          ctx.globalAlpha = p.opacity;
          // O desenho direto sem save/restore/translate é extremamente rápido
          ctx.drawImage(particleImage, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        });

        animationFrameId = requestAnimationFrame(draw);
      };

      draw();
    };

    img.onload = startDrawing;
    img.src = joystickUrl;

    // Dispara a animação caso a imagem já esteja no cache do navegador
    if (img.complete) {
      startDrawing();
    }

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [joystickUrl]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
    />
  );
}
