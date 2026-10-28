import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface TurnstileRef {
  reset: () => void;
}

interface TurnstileProps {
  siteKey?: string;
  onVerify: (token: string) => void;
  onError?: (error?: unknown) => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: (error?: unknown) => void;
          "expired-callback"?: () => void;
          theme?: string;
          size?: string;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  (
    {
      siteKey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || "0x4AAAAAAFppNh2281BtTfuV",
      onVerify,
      onError,
      onExpire,
      theme = "light",
      size = "flexible",
      className = "",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    // Refs para manter callbacks atualizados sem disparar o useEffect
    const onVerifyRef = useRef(onVerify);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
      onVerifyRef.current = onVerify;
      onErrorRef.current = onError;
      onExpireRef.current = onExpire;
    });

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {
            // Silencioso
          }
        }
      },
    }));

    useEffect(() => {
      let isMounted = true;

      const renderWidget = () => {
        if (!containerRef.current || !window.turnstile || !isMounted || !siteKey) return;

        // Se já existe um widget renderizado no container, remove antes de renderizar
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignora se já estiver limpo
          }
          widgetIdRef.current = null;
        }

        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              if (isMounted && onVerifyRef.current) {
                onVerifyRef.current(token);
              }
            },
            "error-callback": (err: unknown) => {
              console.warn("[Cloudflare Turnstile] Erro no widget:", err);
              if (isMounted && onErrorRef.current) {
                onErrorRef.current(err);
              }
            },
            "expired-callback": () => {
              if (isMounted && onExpireRef.current) {
                onExpireRef.current();
              }
            },
            theme,
            size,
          });
          widgetIdRef.current = id;
        } catch (err) {
          console.warn("[Cloudflare Turnstile] Falha na renderização:", err);
        }
      };

      // Carrega o script da Cloudflare se ainda não estiver presente no DOM
      const SCRIPT_ID = "cf-turnstile-script";
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

      if (!window.turnstile) {
        if (!script) {
          script = document.createElement("script");
          script.id = SCRIPT_ID;
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
        }

        const prevOnload = window.onloadTurnstileCallback;
        window.onloadTurnstileCallback = () => {
          if (prevOnload) prevOnload();
          if (isMounted) renderWidget();
        };

        script.addEventListener("load", () => {
          if (isMounted) renderWidget();
        });
      } else {
        renderWidget();
      }

      return () => {
        isMounted = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Silencioso na desmontagem
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, theme, size]);

    return (
      <div className={`w-full flex items-center min-h-[65px] ${className}`}>
        <div
          ref={containerRef}
          className={`w-full flex items-center ${size === "flexible" ? "" : "max-w-[300px] justify-center"}`}
        />
      </div>
    );
  }
);

Turnstile.displayName = "Turnstile";
