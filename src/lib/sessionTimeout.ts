/**
 * Gerenciamento de Sessão e Tempo Limite de Inatividade (2 horas)
 * Mind Canvas — INNYX Educação
 */

export const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 horas (7.200.000 ms)
export const SESSION_ACTIVITY_KEY = "mindcanvas_last_activity_time";
export const SESSION_USER_KEY = "mindcanvas_session_uid";
export const SESSION_EXPIRED_KEY = "mindcanvas_session_expired";

/**
 * Registra a atividade do usuário no localStorage.
 */
export function recordUserActivity(uid?: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const now = Date.now();
    window.localStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
    if (uid) {
      window.localStorage.setItem(SESSION_USER_KEY, uid);
    }
  } catch {
    // Ignora restrições de localStorage em modo anônimo estrito
  }
}

/**
 * Obtém o timestamp da última atividade registrada.
 */
export function getLastActivityTime(): number | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SESSION_ACTIVITY_KEY);
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Verifica se a sessão do usuário expirou (inatividade >= maxAgeMs, padrão 2h).
 * @param currentUid UID do usuário autenticado no momento (opcional)
 * @param maxAgeMs Tempo limite em ms (padrão: 2 horas)
 */
export function isSessionExpired(currentUid?: string, maxAgeMs: number = SESSION_TIMEOUT_MS): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;

    const lastTime = getLastActivityTime();
    if (!lastTime) {
      // Se não há registro de atividade anterior, a sessão acabou de iniciar ou é nova
      return false;
    }

    const storedUid = window.localStorage.getItem(SESSION_USER_KEY);
    if (currentUid && storedUid && storedUid !== currentUid) {
      // Outro usuário autenticado no mesmo navegador — reinicia o ciclo
      return false;
    }

    const now = Date.now();
    // Se o relógio do sistema avançar para trás (anomalia de horário), protege contra travamento
    if (lastTime > now + 60 * 1000) {
      recordUserActivity(currentUid);
      return false;
    }

    return now - lastTime >= maxAgeMs;
  } catch {
    return false;
  }
}

/**
 * Limpa os dados de sessão do usuário no localStorage.
 */
export function clearUserSession(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(SESSION_ACTIVITY_KEY);
    window.localStorage.removeItem(SESSION_USER_KEY);
  } catch {
    // Ignora
  }
}

/**
 * Marca a sessão como expirada no sessionStorage para que a tela de login exiba o aviso.
 */
export function markSessionExpired(reason: string = "inactivity_2h"): void {
  try {
    clearUserSession();
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(SESSION_EXPIRED_KEY, reason);
    }
  } catch {
    // Ignora
  }
}

/**
 * Lê e consome o motivo da expiração da sessão (remove após leitura).
 */
export function consumeSessionExpiredReason(): string | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    const reason = window.sessionStorage.getItem(SESSION_EXPIRED_KEY);
    if (reason) {
      window.sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    }
    return reason;
  } catch {
    return null;
  }
}

/**
 * Configura os listeners de atividade e o temporizador periódico de expiração da sessão.
 * Atualiza o timestamp conforme o usuário interage e dispara onExpire() se inativo por >= 2h.
 */
export function setupSessionTimeoutListener(
  onExpire: () => void,
  options: {
    maxAgeMs?: number;
    throttleMs?: number;
    checkIntervalMs?: number;
    currentUid?: string;
  } = {}
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const maxAgeMs = options.maxAgeMs ?? SESSION_TIMEOUT_MS;
  const throttleMs = options.throttleMs ?? 60 * 1000; // Atualiza localStorage no máx 1x por minuto
  const checkIntervalMs = options.checkIntervalMs ?? 30 * 1000; // Verifica a cada 30 segundos
  const currentUid = options.currentUid;

  let lastThrottledUpdate = Date.now();

  const checkExpiration = () => {
    if (isSessionExpired(currentUid, maxAgeMs)) {
      onExpire();
    }
  };

  const handleActivity = () => {
    const now = Date.now();
    if (now - lastThrottledUpdate >= throttleMs) {
      lastThrottledUpdate = now;
      recordUserActivity(currentUid);
    }
  };

  const handleImmediateCheckAndRefresh = () => {
    if (isSessionExpired(currentUid, maxAgeMs)) {
      onExpire();
    } else {
      recordUserActivity(currentUid);
      lastThrottledUpdate = Date.now();
    }
  };

  // Eventos de interação do usuário
  const activityEvents: Array<keyof WindowEventMap> = [
    "click",
    "keydown",
    "pointerdown",
    "touchstart",
    "scroll",
  ];

  activityEvents.forEach((event) => {
    window.addEventListener(event, handleActivity, { passive: true });
  });

  // Quando o usuário volta à aba ou desbloqueia o computador
  window.addEventListener("focus", handleImmediateCheckAndRefresh);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      handleImmediateCheckAndRefresh();
    }
  });

  // Temporizador periódico em segundo plano
  const intervalId = window.setInterval(checkExpiration, checkIntervalMs);

  // Escuta logout/expiração disparado em outra aba
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === SESSION_ACTIVITY_KEY && e.newValue === null) {
      checkExpiration();
    }
  };
  window.addEventListener("storage", handleStorageChange);

  // Retorna função de limpeza
  return () => {
    activityEvents.forEach((event) => {
      window.removeEventListener(event, handleActivity);
    });
    window.removeEventListener("focus", handleImmediateCheckAndRefresh);
    window.removeEventListener("storage", handleStorageChange);
    window.clearInterval(intervalId);
  };
}

