/**
 * Error Boundary do DocumentView.
 *
 * Captura erros de renderização em qualquer componente filho e exibe uma
 * mensagem amigável em vez de uma tela branca. Útil quando a IA gera dados
 * inesperados ou quando um campo recebe um valor que o React não consegue
 * renderizar diretamente.
 */
import React, { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class DocumentViewErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "Erro desconhecido",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("DocumentView Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 p-12">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-violet-500" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-black text-slate-800 mb-2">
              Erro ao renderizar o canvas
            </h3>
            <p className="text-sm text-slate-500 mb-1">
              Ocorreu um erro inesperado ao exibir o conteúdo gerado.
            </p>
            <p className="text-xs font-mono text-rose-400 bg-slate-50 px-3 py-1.5 rounded-lg mt-2">
              {this.state.errorMessage}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
            className="flex items-center gap-2 px-6 py-3 bg-violet-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-violet-600 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { DocumentViewErrorBoundary };
