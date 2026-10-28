import { useState, useRef, useEffect } from "react";
import { Upload, FileText, X, LoaderCircle, Sparkles, AlertCircle } from "lucide-react";

export interface StudioResendModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFileName?: string;
  currentContentLength?: number;
  line?: string;
  onSubmit: (data: { file?: File; text?: string; updateBriefing: boolean }) => Promise<void>;
}

export function StudioResendModal(props: StudioResendModalProps) {
  if (!props.isOpen) return null;
  return <StudioResendModalDialog {...props} />;
}

function StudioResendModalDialog({
  onClose,
  currentFileName,
  currentContentLength,
  line = "Konectar.me",
  onSubmit,
}: StudioResendModalProps) {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [updateBriefing, setUpdateBriefing] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  const handleFile = (file?: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    const isDoc = lowerName.endsWith(".doc") || lowerName.endsWith(".docx");
    if (!isPdf && !isDoc) {
      setErrorMessage("Formato não suportado. Envie um arquivo PDF (.pdf) ou Word (.doc, .docx).");
      return;
    }
    const maxSize = isPdf ? 20 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMessage(`O arquivo excede o limite de ${isPdf ? "20 MB para PDF" : "50 MB para Word"}.`);
      return;
    }
    setSelectedFile(file);
    setErrorMessage("");
  };

  const handleConfirm = async () => {
    if (mode === "file" && !selectedFile) {
      setErrorMessage("Selecione um arquivo de apostila para continuar.");
      return;
    }
    if (mode === "text" && !pastedText.trim()) {
      setErrorMessage("Insira o texto da apostila para continuar.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSubmittingStatus("Lendo material e processando conteúdo…");

    try {
      await onSubmit({
        file: mode === "file" ? selectedFile || undefined : undefined,
        text: mode === "text" ? pastedText.trim() : undefined,
        updateBriefing,
      });
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : "Não foi possível reenviar o material. Tente novamente.");
    }
  };

  const hasData = mode === "file" ? Boolean(selectedFile) : Boolean(pastedText.trim());

  return (
    <div
      className="studio-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resend-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="studio-modal studio-modal--resend">
        <div className="studio-modal__header-top">
          <div className="studio-modal__header" style={{ marginBottom: 0 }}>
            <div className="studio-modal__icon-wrap studio-modal__icon-wrap--primary">
              <Upload size={22} />
            </div>
            <div>
              <h2 id="resend-modal-title">Reenviar material da aula</h2>
              <p>Envie uma nova versão da apostila ou cole o conteúdo atualizado para recriar os slides.</p>
            </div>
          </div>
          <button
            type="button"
            className="studio-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {currentFileName && (
          <div className="studio-resend-current">
            <span className="studio-resend-current__badge">Material atual</span>
            <div className="studio-resend-current__info">
              <strong>{currentFileName}</strong>
              {currentContentLength ? (
                <small>{currentContentLength.toLocaleString("pt-BR")} caracteres de referência</small>
              ) : null}
            </div>
          </div>
        )}

        <div className="studio-resend-tabs">
          <button
            type="button"
            className={`studio-resend-tab ${mode === "file" ? "is-active" : ""}`}
            onClick={() => {
              setMode("file");
              setErrorMessage("");
            }}
            disabled={isSubmitting}
          >
            <FileText size={15} /> Documento (PDF / Word)
          </button>
          <button
            type="button"
            className={`studio-resend-tab ${mode === "text" ? "is-active" : ""}`}
            onClick={() => {
              setMode("text");
              setErrorMessage("");
            }}
            disabled={isSubmitting}
          >
            <Upload size={15} /> Colar texto
          </button>
        </div>

        {mode === "file" ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {!selectedFile ? (
              <div
                className={`studio-resend-dropzone ${isDragging ? "is-dragging" : ""}`}
                onClick={() => !isSubmitting && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
              >
                <Upload size={28} />
                <div>
                  <strong>Clique para selecionar ou arraste o novo arquivo</strong>
                  <small>PDF até 20 MB · Word (.doc/.docx) até 50 MB</small>
                </div>
              </div>
            ) : (
              <div className="studio-resend-selected-file">
                <div className="studio-resend-selected-file__meta">
                  <div className="studio-resend-selected-file__icon">
                    <FileText size={20} />
                  </div>
                  <div className="studio-resend-selected-file__info">
                    <strong>{selectedFile.name}</strong>
                    <small>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Novo arquivo selecionado</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="studio-resend-selected-file__remove"
                  onClick={() => setSelectedFile(null)}
                  disabled={isSubmitting}
                  aria-label="Remover arquivo selecionado"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <textarea
              className="studio-resend-textarea"
              rows={5}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Cole o texto da apostila ou material atualizado aqui…"
              disabled={isSubmitting}
            />
            <div className="studio-resend-textarea-meta">
              <span>{pastedText.length.toLocaleString("pt-BR")} caracteres</span>
            </div>
          </div>
        )}

        <label className="studio-resend-option">
          <input
            type="checkbox"
            checked={updateBriefing}
            onChange={(e) => setUpdateBriefing(e.target.checked)}
            disabled={isSubmitting}
          />
          <span>Atualizar tema, disciplina e objetivo com a IA a partir do novo material</span>
        </label>

        {errorMessage && (
          <div className="studio-resend-feedback" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <p className="studio-modal__desc" style={{ marginBottom: "20px" }}>
          Ao reenviar o material, a IA fará uma nova leitura e recriará a apresentação inteira no modelo <strong>{line}</strong>. Os slides atuais serão substituídos.
        </p>

        <div className="studio-modal__actions">
          <button
            type="button"
            className="studio-button studio-button--quiet"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="studio-button studio-button--primary"
            onClick={handleConfirm}
            disabled={!hasData || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle size={16} className="studio-editor__spinner" />
                {submittingStatus || "Processando novo material…"}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Reenviar e recriar slides
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
