import React, { useMemo, useRef, useState, useId } from "react";
import type { GeneratorFormData } from "../../types";
import {
  Upload,
  FileText,
  X,
  RefreshCw,
  ChevronDown,
  FolderDown,
  Save,
  Dices,
  Gamepad2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { model } from "../../lib/gemini";
import { motion, AnimatePresence } from "framer-motion";

// ── Custom Select Component ──────────────────────────────────────────────────
interface SelectOption { label: string; value: string; }
interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  label, value, onChange, options, placeholder = "Selecione...", disabled = false,
}) => {
  const id = useId();
  const selected = options.find((o) => o.value === value || o.label === value);
  return (
    <div className="generator-select-field">
      <label htmlFor={id} className="generator-field-label">{label}</label>
      <div className="generator-select-control">
        <select
          id={id}
          value={selected ? selected.value || selected.label : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={!selected ? "is-placeholder" : ""}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((option) => (
            <option key={option.value || option.label} value={option.value || option.label}>{option.label}</option>
          ))}
        </select>
        <ChevronDown size={15} aria-hidden="true" className="generator-select-chevron" />
      </div>
    </div>
  );
};

// ── Main Sidebar ─────────────────────────────────────────────────────────────
interface GeneratorSidebarProps {
  formData: GeneratorFormData;
  setFormData: React.Dispatch<React.SetStateAction<GeneratorFormData>>;
  onGenerate: () => void;
  isGenerating: boolean;
  onPdfChange: (base64: string | null, fileName: string | null) => void;
  pdfFileName: string | null;
  hasPdf: boolean;
  pdfBase64?: string | null;
  pdfTextContent?: string | null;
  viewOnly?: boolean;
  onRecreate?: () => void;
  isExtractingBncc?: boolean;
  onBack?: () => void;
  hasGeneratedContent?: boolean;
  onExportPdf?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  isViewMode?: boolean;
  isDirty?: boolean;
  hasSavedProject?: boolean;
  hasParamChanges?: boolean;
}

const GAME_TYPES = [
  "Jogo de Plataforma 2D",
  "Jogo de Tiro ao Alvo",
  "Roleta",
  "Memoria",
  "Quebra-Cabeca",
  "Sliding Puzzle",
  "Tabuleiro",
  "Arrastar e Soltar",
  "Esmaga Palavras",
  "Quiz",
  "Jogo da Velha",
];

const SUBJECTS_BY_LEVEL: Record<string, string[]> = {
  "Ensino Fundamental 1": ["Matemática", "Português", "História", "Geografia", "Ciências", "Artes", "Ensino Religioso"],
  "Ensino Fundamental 2": ["Matemática", "Língua Portuguesa", "História", "Geografia", "Ciências", "Artes", "Ensino Religioso", "Língua Inglesa"],
  "Ensino Médio": ["Matemática", "Língua Portuguesa", "História", "Geografia", "Química", "Física", "Biologia", "Artes", "Filosofia", "Sociologia", "Língua Inglesa", "Língua Espanhola"],
};

const YEARS_BY_LEVEL: Record<string, string[]> = {
  "Ensino Fundamental 1": ["1º Ano", "2º Ano", "3º Ano", "4º Ano", "5º Ano"],
  "Ensino Fundamental 2": ["6º Ano", "7º Ano", "8º Ano", "9º Ano"],
  "Ensino Médio": ["1ª Série", "2ª Série", "3ª Série"],
};

const QUARTERS = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"];
const LEVELS = ["Ensino Fundamental 1", "Ensino Fundamental 2", "Ensino Médio"];

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  Matemática: [
    "Arquiteto de Castelos: erga muralhas de defesa fortificadas calculando proporções e equações geométricas para resistir a ataques de dragões!",
    "Alquimista do Deserto: combine frações e proporções místicas de elixires para curar a caravana perdida e abrir o portal de runas antigas.",
    "Detetive de Coordenadas: localize esconderijos secretos no plano cartesiano decifrando as pistas de um lendário ladrão de relíquias históricas."
  ],
  Matematica: [
    "Arquiteto de Castelos: erga muralhas de defesa fortificadas calculando proporções e equações geométricas para resistir a ataques de dragões!",
    "Alquimista do Deserto: combine frações e proporções místicas de elixires para curar a caravana perdida e abrir o portal de runas antigas.",
    "Detetive de Coordenadas: localize esconderijos secretos no plano cartesiano decifrando as pistas de um lendário ladrão de relíquias históricas."
  ],
  Português: [
    "Escriba das Terras Altas: redija decretos imperiais de paz, corrigindo conectivos e concordâncias para selar o pacto entre reinos rivais.",
    "Sobrevivente na Floresta de Runas: use grafia e acentuação corretas para traduzir monólitos e desativar armadilhas em um templo proibido.",
    "Bardo Diplomata: componha crônicas e poemas com rimas ricas e figuras de linguagem precisas para pacificar os clãs em guerra no reino."
  ],
  Portugues: [
    "Escriba das Terras Altas: redija decretos imperiais de paz, corrigindo conectivos e concordâncias para selar o pacto entre reinos rivais.",
    "Sobrevivente na Floresta de Runas: use grafia e acentuação corretas para traduzir monólitos e desativar armadilhas em um templo proibido.",
    "Bardo Diplomata: componha crônicas e poemas com rimas ricas e figuras de linguagem precisas para pacificar os clãs em guerra no reino."
  ],
  "Língua Portuguesa": [
    "Escriba das Terras Altas: redija decretos imperiais de paz, corrigindo conectivos e concordâncias para selar o pacto entre reinos rivais.",
    "Sobrevivente na Floresta de Runas: use grafia e acentuação corretas para traduzir monólitos e desativar armadilhas em um templo proibido.",
    "Bardo Diplomata: componha crônicas e poemas com rimas ricas e figuras de linguagem precisas para pacificar os clãs em guerra no reino."
  ],
  História: [
    "Guardião Temporal: conserte fraturas no tempo ajudando figuras históricas com decisões reais da época para evitar o colapso da nossa realidade.",
    "Arqueólogo de Relíquias: desvende enigmas de civilizações antigas decifrando inscrições de governantes e revoluções passadas."
  ],
  Geografia: [
    "Piloto de Dirigível: navegue por rotas de entrega perigosas analisando mapas de relevos, fusos horários e biomas sob tempestades extremas.",
    "Cartógrafo de Fronteiras: desvende conspirações territoriais mapeando recursos naturais e limites geopolíticos em um arquipélago esquecido."
  ],
  Ciências: [
    "Micro-Navegador: pilote um nanorobô pelas artérias humanas combatendo ameaças microscópicas através da identificação de órgãos e defesas do corpo.",
    "Alquimista Botânico: catalogue e crie mutações de plantas exóticas combinando conceitos de fotossíntese e ecossistemas em uma estufa flutuante."
  ],
  Física: [
    "Engenheiro de Gravidade: estabilize um reator de antimatéria manipulando leis do movimento, forças e energia cinética antes que o tempo acabe."
  ],
  Química: [
    "Defensor Atômico: neutralize vazamentos tóxicos na cidade realizando balanceamento químico de substâncias e reações moleculares de forma exata."
  ],
  Biologia: [
    "Engenheiro Genético: isole cepas bacterianas e construa defesas biológicas manipulando sequências de DNA e funções de organelas celulares."
  ],
  "Língua Inglesa": [
    "Agente Duplo Decifrador: intercepte e traduza transmissões em inglês de espiões rivais usando vocabulário e tempos verbais corretos."
  ],
  Artes: [
    "Restaurador de Relíquias: recupere obras de arte históricas identificando movimentos estéticos e técnicas de pintura em uma galeria misteriosa."
  ]
};

export const GeneratorSidebar: React.FC<GeneratorSidebarProps> = ({
  formData,
  setFormData,
  onGenerate,
  isGenerating,
  onPdfChange,
  pdfFileName,
  hasPdf,
  pdfBase64 = null,
  pdfTextContent = null,
  viewOnly = false,
  onRecreate,
  isExtractingBncc = false,
  hasGeneratedContent = false,
  onExportPdf,
  onSave,
  isSaving = false,
  isViewMode = false,
  isDirty = false,
  hasSavedProject = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleOpenPdf = () => {
    if (!pdfBase64) return;
    try {
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const fileExt = pdfFileName?.toLowerCase().split('.').pop() || '';
      
      let mimeType = 'application/pdf';
      if (fileExt === 'docx') {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (fileExt === 'doc') {
        mimeType = 'application/msword';
      }

      if (fileExt === 'pdf') {
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const fileURL = URL.createObjectURL(blob);
        window.open(fileURL, "_blank");
      } else {
        const blob = new Blob([byteArray], { type: mimeType });
        const fileURL = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = fileURL;
        a.download = pdfFileName || "documento_referencia";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(fileURL);
      }
    } catch (e) {
      console.error("Erro ao abrir documento:", e);
      alert("Não foi possível abrir o documento.");
    }
  };

  const handleChange = <K extends keyof GeneratorFormData>(field: K, value: GeneratorFormData[K]) => {
    setFormData((prev) => {
      const updates: Partial<GeneratorFormData> = { [field]: value };
      if (field === "gradeLevel") { updates.subject = ""; updates.year = ""; }
      if (field === "gameType" && value === "Quiz") updates.withQuiz = true;
      return { ...prev, ...updates };
    });
  };

  const currentSubjects = useMemo(() => SUBJECTS_BY_LEVEL[formData.gradeLevel] || [], [formData.gradeLevel]);
  const currentYears = useMemo(() => YEARS_BY_LEVEL[formData.gradeLevel] || [], [formData.gradeLevel]);

  const handleSuggestContext = async () => {
    if (isSuggesting) return;

    const hasPdfFile = !!pdfBase64;

    if (!hasPdfFile && !formData.subject) {
      const fallbackCreative = [
        "Mago Elemental: domine magias da natureza e resolva enigmas em um reino fantástico para restaurar a Árvore da Vida.",
        "Guardião das Estrelas: pilote sua nave e resolva desafios de lógica e conhecimentos para salvar constelações da escuridão eterna.",
        "Explorador Submarino: pilote um submarino de alta tecnologia e analise pistas biológicas e físicas para catalogar espécies misteriosas."
      ];
      handleChange("additionalContext", fallbackCreative[Math.floor(Math.random() * fallbackCreative.length)]);
      return;
    }

    try {
      setIsSuggesting(true);

      let prompt = "";
      if (hasPdfFile) {
        prompt = `Como um Especialista em Game Design Educacional de alto nível, analise o conteúdo do PDF em anexo e crie uma "IDEIA ou CONTEXTO" extremamente criativa, imersiva e inovadora para um jogo educativo.

REGRAS DE OURO:
- NUNCA use frases clichês ou genéricas como "Aprenda sobre...", "Explore os conceitos...", "Um jogo educativo sobre...", "Neste jogo divertido...", "O objetivo é ensinar...".
- Crie um cenário/narrativa de jogo vivo, muito diversificado e excitante (ex: Roguelike espacial, Cozy Game de fazenda alquímica, Fantasia medieval com magos e guerreiros, Detetive noir sobrenatural, Defesa de torre celular contra vírus, RPG de sobrevivência steampunk, Explorador arqueológico de ruínas perdidas, Corrida futurista de gravidade zero). Evite clichês repetitivos de hackers; traga diversidade de gêneros de jogos (como aventura, RPG, estratégia, simulador, ficção científica ou fantasia).
- Conecte o conteúdo específico do PDF de forma orgânica e intrigante a essa ambientação de jogo.
- A sugestão deve ser uma narrativa curta, direta ao ponto e cheia de personalidade (máximo 180 caracteres).
- Retorne APENAS o texto da ideia em português, sem aspas, explicações ou introduções.

Parâmetros conhecidos:
- Nível: ${formData.gradeLevel || "(não informado)"}
- Série: ${formData.year || "(não informado)"}
- Matéria: ${formData.subject || "(não informado)"}
- Período: ${formData.quarter || "(não informado)"}`;
      } else {
        prompt = `Como um Especialista em Game Design Educacional de alto nível, crie uma "IDEIA ou CONTEXTO" extremamente criativa, imersiva e inovadora para um jogo educativo baseado nos parâmetros fornecidos.

REGRAS DE OURO:
- NUNCA use frases clichês ou genéricas como "Aprenda sobre...", "Explore os conceitos...", "Um jogo educativo sobre...", "Neste jogo divertido...", "O objetivo é ensinar...".
- Crie um cenário/narrativa de jogo vivo, muito diversificado e excitante (ex: Roguelike espacial, Cozy Game de fazenda alquímica, Fantasia medieval com magos e guerreiros, Detetive noir sobrenatural, Defesa de torre celular contra vírus, RPG de sobrevivência steampunk, Explorador arqueológico de ruínas perdidas, Corrida futurista de gravidade zero). Evite clichês repetitivos de hackers; traga diversidade de gêneros de jogos (como aventura, RPG, estratégia, simulador, ficção científica ou fantasia).
- Conecte a matéria (${formData.subject}) e o ano/série (${formData.year}) de forma orgânica e intrigante a essa ambientação de jogo.
- A sugestão deve ser uma narrativa curta, direta ao ponto e cheia de personalidade (máximo 180 caracteres).
- Retorne APENAS o texto da ideia em português, sem aspas, explicações ou introduções.

Parâmetros:
- Nível: ${formData.gradeLevel}
- Série: ${formData.year}
- Matéria: ${formData.subject}
- Período: ${formData.quarter}`;
      }

      let result;
      const isPdf = pdfFileName?.toLowerCase().endsWith(".pdf");
      if (hasPdfFile && isPdf) {
        const parts = [
          { text: prompt },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
        ];
        result = await model.generateContent({
          contents: [{ role: "user", parts }],
        });
      } else if (hasPdfFile && pdfTextContent) {
        const parts = [
          { text: prompt },
          { text: `\n\nTexto extraído do documento de referência:\n${pdfTextContent}` }
        ];
        result = await model.generateContent({
          contents: [{ role: "user", parts }],
        });
      } else {
        result = await model.generateContent(prompt);
      }

      const text = await result.response.text();
      if (text) handleChange("additionalContext", text.trim());
    } catch (error) {
      console.error("Erro ao sugerir contexto:", error);
      if (hasPdfFile) {
        handleChange("additionalContext", "Decifrar os mistérios e dados do material através de uma aventura de ficção científica interativa.");
      } else {
        const normalizedSubject = formData.subject.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const list = CONTEXT_SUGGESTIONS[formData.subject] || CONTEXT_SUGGESTIONS[normalizedSubject] || [];
        if (list.length > 0) {
          handleChange("additionalContext", list[Math.floor(Math.random() * list.length)]);
        } else {
          handleChange("additionalContext", "Explorar o universo de " + formData.subject + " como um agente interdimensional resolvendo enigmas.");
        }
      }
    } finally {
      setIsSuggesting(false);
    }
  };

  const processFile = (file: File) => {
    setPdfError(null);
    const fileExt = file.name.toLowerCase().split('.').pop() || '';
    const allowedExtensions = ['pdf', 'docx', 'doc'];
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!allowedExtensions.includes(fileExt) && !allowedMimeTypes.includes(file.type)) {
      setPdfError("Apenas arquivos PDF ou Word (.docx, .doc) são aceitos.");
      return;
    }
    if (fileExt === 'doc') {
      setPdfError("Para arquivos Word, salve como .docx (Word moderno). O formato .doc não é suportado.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPdfError("O arquivo deve ter no máximo 15 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      onPdfChange(base64, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const removePdf = () => { onPdfChange(null, null); setPdfError(null); };

  const hasContext = (formData.additionalContext || "").trim().length > 0;
  const missingFields: string[] = [];
  if (!formData.gradeLevel) missingFields.push("Nível de Ensino");
  if (!formData.subject) missingFields.push("Matéria");
  if (!formData.year) missingFields.push("Ano/Série");
  if (!formData.quarter) missingFields.push("Bimestre");
  if (!formData.gameType) missingFields.push("Tipo de Jogo");
  if (!hasPdf && !hasContext) missingFields.push("Ideia ou Contexto");
  const isFormReady = missingFields.length === 0;
  const isSaveDisabled = isSaving || isGenerating || ((isViewMode || hasSavedProject) && !isDirty);

  // Status de cada passo para feedback educacional
  const step1Complete = !!(formData.gradeLevel && formData.subject && formData.year && formData.quarter);
  const step2Complete = !!formData.gameType;
  const step3Complete = !!(hasPdf || hasContext);

  return (
    <motion.div
      initial={{ x: -350, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="generator-settings"
    >
      {/* ── 1. HEADER COM BADGE E DESIGN IMAGEM 2 ── */}
      <div className="generator-settings-header">
        <div className="generator-header-brand-row">
          <div className="generator-settings-icon">
            <Gamepad2 size={19} />
          </div>

          <div className="generator-header-titles">
            <h2>Configure seu jogo</h2>
          </div>
        </div>

      </div>

      {/* ── 3. FORMULÁRIO EM CARDS ESTRUTURADOS ── */}
      <div className="generator-settings-fields custom-scrollbar">

        {/* CARD 01: Contexto Pedagógico */}
        <section className={`generator-step-card ${step1Complete ? "is-done" : ""}`} aria-labelledby="step-01-title">
          <div className="generator-card-header">
            <div className="generator-card-badge">
              {step1Complete ? <CheckCircle2 size={13} className="generator-complete-icon" /> : <span>01</span>}
            </div>
            <div className="generator-card-header-text">
              <h3 id="step-01-title">Contexto Pedagógico</h3>
            </div>
          </div>

          <div className="generator-card-body">
            <CustomSelect
              label="Nível de Ensino"
              value={formData.gradeLevel}
              onChange={(v) => handleChange("gradeLevel", v)}
              options={LEVELS.map((l) => ({ label: l, value: l }))}
              placeholder="Escolha o nível..."
              disabled={viewOnly || isGenerating}
            />

            <CustomSelect
              label="Matéria / Componente"
              value={formData.subject}
              onChange={(v) => handleChange("subject", v)}
              options={currentSubjects.map((s) => ({ label: s, value: s }))}
              placeholder={formData.gradeLevel ? "Selecione a matéria..." : "Escolha o nível primeiro"}
              disabled={!formData.gradeLevel || viewOnly || isGenerating}
            />

            <div className="generator-field-pair">
              <CustomSelect
                label="Ano / Série"
                value={formData.year}
                onChange={(v) => handleChange("year", v)}
                options={currentYears.map((y) => ({ label: y, value: y }))}
                placeholder={formData.gradeLevel ? "Ano/Série..." : "Nível..."}
                disabled={!formData.gradeLevel || viewOnly || isGenerating}
              />

              <CustomSelect
                label="Bimestre"
                value={formData.quarter}
                onChange={(v) => handleChange("quarter", v)}
                options={QUARTERS.map((q) => ({ label: q, value: q }))}
                placeholder="Bimestre..."
                disabled={viewOnly || isGenerating}
              />
            </div>
          </div>
        </section>

        {/* CARD 02: Experiência do Jogo */}
        <section className={`generator-step-card ${step2Complete ? "is-done" : ""}`} aria-labelledby="step-02-title">
          <div className="generator-card-header">
            <div className="generator-card-badge">
              {step2Complete ? <CheckCircle2 size={13} className="generator-complete-icon" /> : <span>02</span>}
            </div>
            <div className="generator-card-header-text">
              <h3 id="step-02-title">Experiência do Jogo</h3>
            </div>
          </div>

          <div className="generator-card-body">
            <CustomSelect
              label="Tipo de Jogo"
              value={formData.gameType}
              onChange={(v) => handleChange("gameType", v)}
              options={GAME_TYPES.map((g) => ({ label: g, value: g }))}
              placeholder="Selecione o tipo de jogo..."
              disabled={viewOnly || isGenerating}
            />
          </div>
        </section>

        {/* CARD 03: Conteúdo e Inspiração */}
        <section className={`generator-step-card ${step3Complete ? "is-done" : ""}`} aria-labelledby="step-03-title">
          <div className="generator-card-header">
            <div className="generator-card-badge">
              {step3Complete ? <CheckCircle2 size={13} className="generator-complete-icon" /> : <span>03</span>}
            </div>
            <div className="generator-card-header-text">
              <h3 id="step-03-title">Conteúdo & Inspiração</h3>
            </div>
          </div>

          <div className="generator-card-body">
            {/* Upload de Apostila */}
            {(pdfFileName || !viewOnly) && (
              <div className="generator-upload-field">
                <div className="generator-upload-header">
                  <label className="generator-field-label">Material de referência</label>
                  {!hasPdf && !viewOnly && (
                    <span className="generator-optional-badge">Opcional</span>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {pdfFileName ? (
                    <motion.div
                      key="pdf-loaded"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`generator-file-card ${viewOnly && pdfBase64 ? "is-clickable" : ""}`}
                      onClick={viewOnly && pdfBase64 ? handleOpenPdf : undefined}
                    >
                      <div className="generator-file-icon">
                        {isExtractingBncc ? <RefreshCw size={18} className="animate-spin" /> : <FileText size={18} />}
                      </div>
                      <div className="generator-file-info">
                        <span className="generator-file-name" title={pdfFileName}>{pdfFileName}</span>
                        {isExtractingBncc ? (
                          <span className="generator-file-status is-extracting">
                            <RefreshCw size={11} className="animate-spin" /> Analisando roteiro...
                          </span>
                        ) : formData.bnccSkill ? (
                          <span className="generator-file-status is-ready">✓ BNCC: {formData.bnccSkill}</span>
                        ) : (
                          <span className="generator-file-status is-ready">
                            {viewOnly && pdfBase64 ? "✓ Documento (Clique p/ abrir)" : "✓ Documento Carregado"}
                          </span>
                        )}
                      </div>
                      {!viewOnly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isGenerating && !isExtractingBncc) removePdf();
                          }}
                          disabled={isGenerating || isExtractingBncc}
                          aria-label="Remover material de referência"
                          className="generator-file-remove-btn"
                          title="Remover arquivo"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pdf-dropzone"
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
                      onClick={() => !isGenerating && fileInputRef.current?.click()}
                      role="button"
                      tabIndex={isGenerating ? -1 : 0}
                      aria-label="Selecionar material de referência em PDF ou Word"
                      aria-disabled={isGenerating}
                      onKeyDown={(event) => {
                        if (!isGenerating && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`generator-upload-dropzone ${isDragging ? "is-dragover" : ""}`}
                    >
                      <div className="generator-upload-dropzone-icon">
                        <Upload size={18} />
                      </div>
                      <strong className="generator-upload-title">Clique ou arraste sua apostila</strong>
                      <span className="generator-upload-subtitle">PDF ou Word (DOCX) · até 15 MB</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {pdfError && <p className="generator-pdf-error">{pdfError}</p>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,.doc,.docx"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            )}

            {/* Ideia ou Contexto com Botão Mágico */}
            <div className="generator-context-field">
              <div className="generator-context-header">
                <label className="generator-field-label" htmlFor="game-context">
                  Ideia ou contexto
                </label>
                <button
                  type="button"
                  onClick={() => !isGenerating && !isSuggesting && !(viewOnly || hasGeneratedContent) && handleSuggestContext()}
                  disabled={viewOnly || hasGeneratedContent || isGenerating || isSuggesting}
                  className="generator-ai-suggest-btn"
                  title="Sugerir uma narrativa criativa com Inteligência Artificial"
                >
                  {isSuggesting ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Criando...</span>
                    </>
                  ) : (
                    <>
                      <Dices size={12} />
                      <span>Sugerir com IA</span>
                    </>
                  )}
                </button>
              </div>

              <div className="generator-context-control">
                <textarea
                  id="game-context"
                  className="generator-context-textarea custom-scrollbar"
                  placeholder={pdfFileName ? "Orientações adicionais para aprofundar no PDF..." : "Descreva a ideia (ex: Alquimista dominando reações químicas)..."}
                  value={formData.additionalContext}
                  disabled={viewOnly || isGenerating || isSuggesting}
                  onChange={(e) => handleChange("additionalContext", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      if (isFormReady && !isGenerating) onGenerate();
                    }
                  }}
                />
              </div>
              <p className="generator-field-help">
                {pdfFileName
                  ? "Dica: Você pode orientar o foco do jogo no conteúdo da apostila."
                  : "Descreva a dinâmica da aula ou use a IA para gerar uma narrativa imersiva."}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── 4. CARD WIDGET FLUTUANTE DE AÇÃO (ESTILO IMAGEM 2) ── */}
      <div className="generator-settings-actions">
        {hasGeneratedContent && (
          <div className="generator-action-secondary-grid">
            <button
              onClick={(e) => {
                e.preventDefault();
                onExportPdf?.();
              }}
              disabled={isGenerating}
              className="generator-action-secondary-btn"
              title="Baixar roteiro em formato PDF"
            >
              <FolderDown size={15} />
              <span>Exportar PDF</span>
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                if (!isSaveDisabled) onSave?.();
              }}
              disabled={isSaveDisabled}
              className={`generator-action-secondary-btn generator-action-save-btn ${isSaveDisabled ? "is-disabled" : ""}`}
              title="Salvar alterações do projeto"
            >
              {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{isSaving ? "Salvando..." : "Salvar"}</span>
            </button>
          </div>
        )}

        <div className="generator-sidebar-action-card">
          {!isFormReady && (
            <div className="generator-status-pending">
              <span className="generator-status-pending-text">Faltam parâmetros:</span>
              <div className="generator-missing-chips">
                {missingFields.slice(0, 3).map((f) => (
                  <span key={f} className="generator-missing-chip">{f}</span>
                ))}
                {missingFields.length > 3 && (
                  <span className="generator-missing-chip">+{missingFields.length - 3}</span>
                )}
              </div>
            </div>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              if (viewOnly) { onRecreate?.(); return; }
              if (!isFormReady || isGenerating || isSuggesting || isExtractingBncc) return;
              onGenerate();
            }}
            disabled={isGenerating || isSuggesting || isExtractingBncc || (!viewOnly && !isFormReady)}
            className={`generator-generate-button ${
              isGenerating || isSuggesting || isExtractingBncc ? "is-loading" : ""
            } ${!viewOnly && !isFormReady ? "is-disabled" : "is-active"}`}
            title={!isFormReady ? "Preencha todos os campos obrigatórios acima" : "Clique ou aperte Ctrl+Enter para gerar o canvas com IA"}
          >
            {isGenerating || isSuggesting || isExtractingBncc ? (
              <>
                <RefreshCw size={17} className="animate-spin" />
                <span>
                  {isExtractingBncc ? "Analisando roteiro..." : isGenerating ? "Criando Game Canvas..." : "Criando sugestão..."}
                </span>
              </>
            ) : (
              <>
                <Sparkles size={17} className="generator-btn-sparkle" />
                <span>{(viewOnly || hasGeneratedContent) ? "Recriar Canvas com IA" : "Gerar Canvas com IA"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
