import type { AuthSession } from "./authSession";

type Listener = (session: AuthSession | null) => void;

let listener: Listener | null = null;

export function setSessionListener(fn: Listener | null) {
    listener = fn;
}

export function emitSessionChanged(session: AuthSession | null) {
    try {
        listener?.(session);
    } catch {
        // no-op
    }
}