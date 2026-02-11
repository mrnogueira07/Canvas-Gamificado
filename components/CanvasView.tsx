
import React, { useRef } from 'react';
import { 
  ArrowLeft, 
  Download, 
  BookOpen, 
  Gamepad2, 
  Clapperboard, 
  Library
} from 'lucide-react';
import { ScriptItem } from '../types';
import { Button } from './Button';

interface CanvasViewProps {
  script: ScriptItem;
  onBack: () => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({ script, onBack }) => {
  const content = script.generatedContent;
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Conteúdo não disponível</h2>
          <Button onClick={onBack}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#0f172a] font-sans pb-20 print:bg-white print:pb-0">
      
      {/* Top Navigation Bar - Hidden on Print */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 px-6 h-16 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white truncate max-w-md">
            {script.title}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:inline-block">Modo Visualização</span>
          <Button 
            variant="secondary" 
            onClick={handlePrint}
            icon={<Download size={16} />}
            className="text-xs"
          >
            Exportar PDF
          </Button>
        </div>
      </nav>

      {/* Main Document Container */}
      <div className="max-w-4xl mx-auto mt-8 px-4 sm:px-6 print:m-0 print:p-0 print:max-w-none print:w-full">
        
        {/* Paper Sheet Effect */}
        <div ref={printRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 md:p-12 min-h-[1000px] print:shadow-none print:border-none print:bg-white print:text-black print:dark:bg-white print:dark:text-black">
          
          {/* Header do Documento */}
          <div className="text-center mb-12 border-b border-gray-100 dark:border-gray-700 pb-8 print:border-gray-300">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-3 print:text-black">
              {script.title}
            </h1>
            <div className="flex items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">
              <span>{content.curriculum.year_bimester}</span>
              <span>•</span>
              <span>{content.curriculum.subject}</span>
              <span>•</span>
              <span>{content.curriculum.area}</span>
            </div>
          </div>

          <div className="space-y-8">

            {/* CARD 1: RELAÇÃO COM O CURRÍCULO */}
            <SectionCard 
              number={1} 
              icon={<BookOpen size={18} />} 
              title="RELAÇÃO COM O CURRÍCULO"
            >
              <div className="grid grid-cols-1 gap-6">
                <Field label="ÁREA:" value={content.curriculum.area} />
                <Field label="ANO E BIMESTRE:" value={content.curriculum.year_bimester} />
                <Field label="DISCIPLINA:" value={content.curriculum.subject} />
                <Field label="TEMA:" value={content.curriculum.theme} />
                
                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700 print:border-gray-200 print:bg-gray-50">
                   <Field label="HABILIDADES DA BNCC:" value={content.curriculum.bncc_codes} className="font-bold text-indigo-700 dark:text-indigo-400 print:text-black" />
                   <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed print:text-gray-800">
                     <span className="font-bold text-xs text-gray-500 uppercase block mb-1">DESCRIÇÃO DAS HABILIDADES:</span>
                     {content.curriculum.bncc_description}
                   </div>
                </div>

                <Field label="REFERÊNCIA BIBLIOGRÁFICA:" value={content.curriculum.bibliography} />
              </div>
            </SectionCard>

            {/* CARD 2: ESTILO DO JOGO */}
            <SectionCard 
              number={2} 
              icon={<Gamepad2 size={18} />} 
              title="ESTILO DO JOGO"
            >
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="GÊNERO DO JOGO:" value={content.style.genre} />
                  <Field label="PÚBLICO ALVO:" value={content.style.target_audience} />
                </div>
                <Field label="NARRATIVA DO JOGO (RESUMO):" value={content.style.narrative_intro} />
              </div>
            </SectionCard>

            {/* CARD 3: NARRATIVA DO JOGO */}
            <SectionCard 
              number={3} 
              icon={<Clapperboard size={18} />} 
              title="NARRATIVA DETALHADA"
            >
              <div className="space-y-6">
                <Field label="SINOPSE E ENREDO:" value={content.narrative.synopsis} />
                <Field label="PERSONAGENS:" value={content.narrative.characters} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">FLUXO DE JOGO:</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed text-justify print:text-black">
                      {content.narrative.flow}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">CHEFES, INIMIGOS E OBSTÁCULOS:</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed text-justify print:text-black">
                      {content.narrative.enemies}
                    </p>
                  </div>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/30 print:bg-gray-50 print:border-gray-200">
                  <Field label="MECÂNICAS E TAREFAS:" value={content.narrative.mechanics} />
                </div>
              </div>
            </SectionCard>

            {/* CARD 4: CONTEÚDO PROGRAMÁTICO */}
            <SectionCard 
              number={4} 
              icon={<Library size={18} />} 
              title="CONTEÚDO PROGRAMÁTICO & FEEDBACK"
            >
              <div className="space-y-6">
                 <Field label="INTRODUÇÃO DO JOGO (BOAS VINDAS):" value={content.content.intro} />
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 dark:border-gray-700 pt-6 print:border-gray-300">
                    <div>
                       <label className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-1 block print:text-black">INFORMAÇÃO DE VITÓRIA:</label>
                       <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed print:text-black">
                         {content.content.victory_condition}
                       </p>
                    </div>
                    <div>
                       <label className="text-xs font-bold text-red-500 dark:text-red-400 uppercase mb-1 block print:text-black">INFORMAÇÃO DE DERROTA:</label>
                       <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed print:text-black">
                         {content.content.defeat_condition}
                       </p>
                    </div>
                 </div>
              </div>
            </SectionCard>

          </div>
        </div>
        
        {/* Footer text */}
        <div className="text-center mt-8 text-xs text-gray-400 print:hidden">
          Gerado por EduCanvas Pro • Documento confidencial para uso pedagógico.
        </div>
      </div>
    </div>
  );
};

// --- Subcomponents for the layout ---

const SectionCard = ({ number, icon, title, children }: { number: number, icon: React.ReactNode, title: string, children: React.ReactNode }) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 print:shadow-none print:border print:border-gray-300 print:break-inside-avoid print:mb-4">
    <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 print:bg-gray-100 print:border-gray-300">
      <div className="w-8 h-8 rounded-lg bg-[#4f46e5] text-white flex items-center justify-center shadow-sm print:bg-black print:text-white">
        {icon}
      </div>
      <div className="flex items-center gap-3">
        <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold print:bg-gray-200 print:text-black">
          {number}
        </span>
        <h2 className="text-sm font-bold text-gray-700 dark:text-white uppercase tracking-wide print:text-black">
          {title}
        </h2>
      </div>
    </div>
    <div className="p-6 md:p-8 bg-white dark:bg-gray-800 print:bg-white">
      {children}
    </div>
  </div>
);

const Field = ({ label, value, className = "" }: { label: string, value: string, className?: string }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide print:text-gray-600">
      {label}
    </label>
    <p className={`text-sm text-gray-800 dark:text-gray-200 leading-relaxed print:text-black ${className}`}>
      {value}
    </p>
  </div>
);
