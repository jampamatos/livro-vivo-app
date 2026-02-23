// Fallback para ambientes que não resolvem sufixos de plataforma.
export {
  getAuthSession,
  setAuthSession,
  clearAuthSession,
} from "./tokenStorage.native";
