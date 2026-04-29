import { apiFetch } from "./http";
import type { AuthSession } from "../auth/authSession";
import { normalizeAccountState, type AccountState } from "./accountState";

export type ModerationNotice = {
    level: "info" | "warning" | "danger";
    message: string;
    created_at?: string | null;
};

type LoginRegisterResponse = 
    | {
        access: string;
        refresh?: string;
        moderation_notice?: ModerationNotice;
        user: Omit<AccountState, "has_usable_password" | "auth_methods" | "legal_status">;
        auth_methods: AccountState["auth_methods"];
        legal_status: AccountState["legal_status"];
      }
    | { token: string}
    | { key: string};

function normalizeAuthResponse(res: LoginRegisterResponse): AuthSession {
    // JWT padrão
    if ("access" in res && typeof res.access === "string") {
        return {
            accessToken: res.access,
            refreshToken: typeof res.refresh === "string" ? res.refresh: null,
        };
    }

    // Token legado (compat)
    const token = ("token" in res && res.token) || ("key" in res && res.key);
    if (typeof token === "string" && token.trim()) {
        return { accessToken: token.trim(), refreshToken: null };
    }

    throw new Error("Resposta inesperada do endpoint de autenticação.");
}

function normalizeModerationNotice(res: LoginRegisterResponse): ModerationNotice | null {
    if (!("moderation_notice" in res)) return null;
    const notice = res.moderation_notice;
    if (!notice || typeof notice.message !== "string" || !notice.message.trim()) {
        return null;
    }
    return notice;
}

export type AuthResponse = {
    session: AuthSession;
    moderationNotice: ModerationNotice | null;
    accountState: AccountState | null;
};

function normalizeAccountStateFromAuthResponse(res: LoginRegisterResponse): AccountState | null {
    if (!("access" in res) || typeof res.access !== "string") {
        return null;
    }

    if (!("user" in res) || !res.user || typeof res.user !== "object") {
        return null;
    }

    return normalizeAccountState({
        ...res.user,
        auth_methods: Array.isArray(res.auth_methods) ? res.auth_methods : [],
        legal_status: res.legal_status,
    });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
    const res = await apiFetch<LoginRegisterResponse>("/auth/login/", {
        method: "POST",
        body: { email, password },
    });
    return {
        session: normalizeAuthResponse(res),
        moderationNotice: normalizeModerationNotice(res),
        accountState: normalizeAccountStateFromAuthResponse(res),
    };
}

export async function register(payload: {
    email: string;
    password: string;
    name?: string;
    profession?: string;
}): Promise<AuthResponse> {
    const res = await apiFetch<LoginRegisterResponse>("/auth/register/", {
        method: "POST",
        body: payload,
    });
    return {
        session: normalizeAuthResponse(res),
        moderationNotice: normalizeModerationNotice(res),
        accountState: normalizeAccountStateFromAuthResponse(res),
    };
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const res = await apiFetch<{ access: string }>("/auth/refresh/", {
        method: "POST",
        body: { refresh: refreshToken },
    });
    return { accessToken: res.access };
}

export async function logout(refreshToken: string, accessToken?: string): Promise<void> {
    await apiFetch("/auth/logout/", {
        method: "POST",
        token: accessToken ?? null,
        body: { refresh: refreshToken },
    });
}
