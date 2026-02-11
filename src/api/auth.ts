import { apiFetch } from "./http";
import type { AuthSession } from "../auth/authSession";

type LoginRegisterResponse = 
    | { access: string; refresh?: string }
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

export async function login(email: string, password: string): Promise<AuthSession> {
    const res = await apiFetch<LoginRegisterResponse>("/auth/login/", {
        method: "POST",
        body: { email, password },
    });
    return normalizeAuthResponse(res);
}

export async function register(payload: {
    email: string;
    password: string;
    name?: string;
    profession?: string;
}): Promise<AuthSession> {
    const res = await apiFetch<LoginRegisterResponse>("/auth/register/", {
        method: "POST",
        body: payload,
    });
    return normalizeAuthResponse(res);
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