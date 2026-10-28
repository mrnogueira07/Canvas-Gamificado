/**
 * pdfExport.ts - V3 (Estabilizacao de Layout + Suporte de Cor)
 * ─────────────────────────────────────────────────────────────────────────────
 * Estrategia: Snapshot de Layout & Cor (Full Computed Bake)
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ─── Propriedades essenciais que definem o layout e visual ───────────────────
const ESSENTIAL_LAYOUT_PROPS = [
  'display', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'justify-content', 'align-items', 'gap', 'grid-template-columns', 'grid-template-rows',
  'position', 'top', 'right', 'bottom', 'left', 'z-index',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'box-sizing', 'border-radius', 'border-width', 'border-style', 'border-color',
  'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
  'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
  'box-shadow', 'opacity', 'visibility',
  'font-family', 'font-size', 'font-weight', 'line-height', 'text-align', 'text-transform', 'text-decoration', 'color'
];

// ─── Conversor de Cores Modernas ──────────────────────────────────────────────
let _tmpCanvas: HTMLCanvasElement | null = null;
let _tmpCtx: CanvasRenderingContext2D | null = null;
const _colorCache = new Map<string, string>();

function modernColorToRgb(color: string): string {
  if (!color || (!color.includes('oklch') && !color.includes('oklab'))) return color;
  const cached = _colorCache.get(color);
  if (cached) return cached;

  let result = '#64748b';
  try {
    if (!_tmpCanvas) {
      _tmpCanvas = document.createElement('canvas');
      _tmpCanvas.width = 1; _tmpCanvas.height = 1;
      _tmpCtx = _tmpCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (_tmpCtx) {
      _tmpCtx.clearRect(0, 0, 1, 1);
      _tmpCtx.fillStyle = color.trim();
      _tmpCtx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = _tmpCtx.getImageData(0, 0, 1, 1).data;
      result = a === 0 ? 'transparent' : (a < 255 ? `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})` : `rgb(${r}, ${g}, ${b})`);
    }
  } catch {
    result = '#64748b';
  }
  _colorCache.set(color, result);
  return result;
}

function resolveModernColorsInValue(val: string): string {
  if (!val || (!val.includes('oklch') && !val.includes('oklab'))) return val;
  const regex = /(?:oklch|oklab)\s*\((?:[^()]+|\((?:[^()]+|\([^()]*\))*\))*\)/g;
  return val.replace(regex, (m) => modernColorToRgb(m));
}

// ─── Exportacao de PDF ────────────────────────────────────────────────────────
export async function generatePDFBlob(elementId: string, title: string) {
  const input = document.getElementById(elementId);
  if (!input) return null;

  try {
    window.scrollTo(0, 0);
    _colorCache.clear();

    // 1. FASE DE CONGELAMENTO (BAKE)
    // Captura o estilo computado de cada elemento e converte em estilos inline fixos.
    const restoreMap = new Map<HTMLElement, string>();
    const allNodes = Array.from(input.querySelectorAll<HTMLElement>('*'));
    allNodes.push(input as HTMLElement);

    allNodes.forEach((node) => {
      const computed = window.getComputedStyle(node);
      const originalStyle = node.getAttribute('style') || '';
      restoreMap.set(node, originalStyle);

      // Copia propriedades essenciais de layout para o estilo inline
      ESSENTIAL_LAYOUT_PROPS.forEach(prop => {
        const value = computed.getPropertyValue(prop);
        if (value) {
          node.style.setProperty(prop, resolveModernColorsInValue(value), 'important');
        }
      });
    });

    // 2. RENDERIZACAO
    const canvas = await html2canvas(input as HTMLElement, {
      scale: 2.5, // Leve aumento de qualidade para textos mais nitidos
      useCORS: true,
      backgroundColor: '#f8fafc', // Fundo slate-50 combinando com o PDF para blending perfeito das bordas arredondadas
      imageTimeout: 35000,
      onclone: (clonedDoc) => {
        // Limpa folhas de estilo residuais que podem ter oklch no clone
        // Mantemos apenas fontes aqui se necessario, mas o "bake" ja resolveu o layout
        Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"], style')).forEach(el => {
          if (!el.textContent?.includes('@font-face')) {
            el.remove();
          }
        });
        
        // Oculta os elementos marcados para nao serem exportados no clone
        Array.from(clonedDoc.querySelectorAll('.export-hide')).forEach(el => {
          (el as HTMLElement).style.display = 'none';
        });

        // Define opacidade total para os elementos com a classe export-full-opacity
        Array.from(clonedDoc.querySelectorAll('.export-full-opacity')).forEach(el => {
          (el as HTMLElement).style.opacity = '1';
        });

        const el = clonedDoc.getElementById(elementId);
        if (el) {
          el.style.width = '1200px'; // Forca largura fixa para consistencia no PDF
          el.style.height = 'auto';
          el.style.overflow = 'visible';
          el.style.margin = '0';
          el.style.transform = 'none'; // Previne problemas de escala
        }
      }
    });

    // 3. RESTAURACAO
    restoreMap.forEach((original, node) => {
      if (original) node.setAttribute('style', original);
      else node.removeAttribute('style');
    });

    // 4. CONSTRUCAO DO PDF (Layout Elegante e Centralizado)
    const imgData = canvas.toDataURL('image/jpeg', 0.98); // Qualidade maxima para evitar artefatos
    
    // Dimensoes A4 em mm
    const a4Width = 210;
    
    // Margens elegantes (em mm)
    const marginX = 15;
    const marginY = 20; // Margem vertical ligeiramente maior para o footer
    
    // Largura util para o conteudo
    const contentWidth = a4Width - (marginX * 2);
    
    // Proporcao do canvas gerado
    const canvasAspectRatio = canvas.height / canvas.width;
    
    // Altura do conteudo baseada na largura util e na proporcao
    const contentHeight = contentWidth * canvasAspectRatio;

    // Altura final da pagina englobando conteudo + margens superiores e inferiores
    const finalPageHeight = contentHeight + (marginY * 2);

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [a4Width, finalPageHeight]
    });

    // Fundo da pagina com um cinza muito suave (Tailwind slate-50) para dar contraste
    pdf.setFillColor(248, 250, 252);
    pdf.rect(0, 0, a4Width, finalPageHeight, 'F');

    // Adiciona a imagem perfeitamente centralizada e com margens
    pdf.addImage(imgData, 'JPEG', marginX, marginY, contentWidth, contentHeight, undefined, 'FAST');

    // Adiciona um Footer elegante e centralizado
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(148, 163, 184); // slate-400
    
    const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const footerText = `${title.toUpperCase()}   •   GERADO EM ${dateStr.toUpperCase()}`;
    
    pdf.text(footerText, a4Width / 2, finalPageHeight - 8, { align: 'center' });

    return { 
      blob: pdf.output('blob'), 
      fileName: `${title.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`, 
      pdf 
    };

  } catch (error: unknown) {
    console.error('[PDF Export Error]', error);
    alert('Erro ao gerar PDF: ' + (error instanceof Error ? error.message : String(error)));
    return null;
  }
}
