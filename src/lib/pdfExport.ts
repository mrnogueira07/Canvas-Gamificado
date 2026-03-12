/**
 * pdfExport.ts - V3 (Estabilização de Layout + Suporte de Cor)
 * ─────────────────────────────────────────────────────────────────────────────
 * Estratégia: Snapshot de Layout & Cor (Full Computed Bake)
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

// ─── Exportação de PDF ────────────────────────────────────────────────────────
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

    // 2. RENDERIZAÇÃO
    const canvas = await html2canvas(input as HTMLElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      imageTimeout: 35000,
      onclone: (clonedDoc) => {
        // Limpa folhas de estilo residuais que podem ter oklch no clone
        // Mantemos apenas fontes aqui se necessário, mas o "bake" já resolveu o layout
        Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"], style')).forEach(el => {
          if (!el.textContent?.includes('@font-face')) {
            el.remove();
          }
        });
        
        const el = clonedDoc.getElementById(elementId);
        if (el) {
          el.style.width = '1200px'; // Força largura fixa para consistência no PDF
          el.style.height = 'auto';
          el.style.overflow = 'visible';
        }
      }
    });

    // 3. RESTAURAÇÃO
    restoreMap.forEach((original, node) => {
      if (original) node.setAttribute('style', original);
      else node.removeAttribute('style');
    });

    // 4. CONSTRUÇÃO DO PDF (Folha Única)
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Calculamos o tamanho da folha A4 em mm
    const a4Width = 210;
    const a4Height = 297;
    
    // Proporção do canvas para o PDF
    const canvasAspectRatio = canvas.height / canvas.width;
    
    // Calculamos a altura final baseada na largura da página A4
    const finalPdfHeight = a4Width * canvasAspectRatio;

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [a4Width, Math.max(a4Height, finalPdfHeight)]
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, a4Width, finalPdfHeight, undefined, 'FAST');

    return { 
      blob: pdf.output('blob'), 
      fileName: `${title.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`, 
      pdf 
    };

  } catch (error: any) {
    console.error('[PDF Export Error]', error);
    alert('Erro ao gerar PDF: ' + error.message);
    return null;
  }
}
