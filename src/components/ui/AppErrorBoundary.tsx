import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#0b0f19",
            color: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "#131b2e",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "16px",
              padding: "32px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.12)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f87171",
                marginBottom: "20px",
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px 0", color: "#ffffff" }}>
              Ops! Algo deu errado ao exibir esta tela
            </h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.6, margin: "0 0 24px 0" }}>
              Ocorreu uma falha inesperada durante a exibição do conteúdo. Você pode recarregar a página ou voltar para o início com segurança.
            </p>

            {this.state.error?.message && (
              <pre
                style={{
                  background: "#070a13",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "12px",
                  fontSize: "12px",
                  color: "#fca5a5",
                  textAlign: "left",
                  overflowX: "auto",
                  margin: "0 0 24px 0",
                  whiteSpace: "pre-wrap",
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#4f46e5",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={16} /> Recarregar página
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = "/inicio"; }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#1e293b",
                  color: "#cbd5e1",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Home size={16} /> Ir para o Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
