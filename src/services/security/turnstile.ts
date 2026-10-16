export const TURNSTILE_SITE_KEY = '0x4AAAAAACKKIZGhHxLokv-j';

/** Cloudflare Turnstile SDK 地址（按需加载，见 ensureTurnstileSdkInjected） */
const TURNSTILE_SDK_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';

let sdkInjected = false;

function getCallbacks(): Array<() => void> | null {
  if (typeof window === 'undefined') return null;
  if (!window.turnstileCallbacks) window.turnstileCallbacks = [];
  return window.turnstileCallbacks;
}

/**
 * 按需注入 Turnstile SDK。
 * 自建部署的后端（/api/v1/auth/security-settings）返回 turnstile_enabled=false，
 * 登录页不会渲染人机验证，因此也不会加载这个第三方脚本；
 * 若后端确实开启了验证，这里会即时加载，行为与原来静态引入一致。
 */
function ensureTurnstileSdkInjected(): void {
  if (sdkInjected || typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.turnstile) return;
  sdkInjected = true;

  window.onTurnstileLoad = function () {
    console.log('[Turnstile] SDK已加载，调用所有回调');
    getCallbacks()?.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('[Turnstile] 回调执行失败:', error);
      }
    });
  };

  const script = document.createElement('script');
  script.src = TURNSTILE_SDK_URL;
  script.async = true;
  script.defer = true;
  script.onerror = () => console.error('[Turnstile] SDK 加载失败');
  document.head.appendChild(script);
}

export async function waitForTurnstile(timeoutMs = 8000): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.turnstile) return true;

  ensureTurnstileSdkInjected();

  const callbacks = getCallbacks();
  if (!callbacks) return false;

  return await new Promise<boolean>((resolve) => {
    let done = false;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };

    const timer = setTimeout(() => finish(!!window.turnstile), timeoutMs);
    // 兜底轮询：SDK 的 onload 回调偶发丢失时也能就绪
    const poll = setInterval(() => {
      if (window.turnstile) {
        clearInterval(poll);
        clearTimeout(timer);
        finish(true);
      }
    }, 250);
    callbacks.push(() => {
      clearTimeout(timer);
      clearInterval(poll);
      finish(!!window.turnstile);
    });
  });
}

export function renderTurnstile(
  container: HTMLElement,
  params: {
    siteKey?: string;
    theme?: 'light' | 'dark' | 'auto';
    onSuccess: (token: string) => void;
    onError?: () => void;
    onExpired?: () => void;
  },
): string {
  if (!window.turnstile) {
    throw new Error('Turnstile SDK not loaded');
  }

  const widgetId = window.turnstile.render(container, {
    sitekey: params.siteKey ?? TURNSTILE_SITE_KEY,
    theme: params.theme ?? 'auto',
    callback: (token: unknown) => params.onSuccess(typeof token === 'string' ? token : ''),
    'error-callback': () => params.onError?.(),
    'expired-callback': () => params.onExpired?.(),
  });

  return widgetId;
}

export function resetTurnstile(widgetId?: string | null) {
  if (!window.turnstile) return;
  try {
    window.turnstile.reset(widgetId ?? undefined);
  } catch (_e) {
    // ignore
  }
}

export function removeTurnstile(widgetId?: string | null) {
  if (!window.turnstile || !widgetId) return;
  try {
    window.turnstile.remove?.(widgetId);
  } catch (_e) {
    // ignore
  }
}
