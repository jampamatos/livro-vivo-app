import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import {
  changeMyPassword,
  getMeProfile,
  getMyEntitlements,
  updateMeProfile,
  type EntitlementsResponse,
  type MeProfileResponse,
  type SubscriptionStatus,
  type SubscriptionTier,
  type UpdateMeProfileAvatarCrop,
  type UpdateMeProfileAvatarUpload,
} from "../api/entitlements";
import {
  acceptLegalDocuments,
  getLegalAcceptances,
  getRequiredLegalDocuments,
} from "../api/legal";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferenceField,
  type NotificationPreferences,
} from "../api/notifications";
import {
  buildDataExportSummary,
  getMyDataExport,
  requestMyDataErasure,
  type DataExportResponse,
  type DataExportSummary,
} from "../api/privacy";
import type { LinkedAccount, LegalAcceptanceEntry, LegalDocumentSummary } from "../api/accountState";
import { ApiError } from "../api/http";
import {
  getLinkedAccounts,
  setPasswordFromSocialOnlyAccount,
  startSocialAuth,
  unlinkLinkedAccount,
} from "../api/social";
import { getCurrentWebRedirectUri, redirectToSocialAuthorization } from "../auth/socialWeb";
import { LegalRichText } from "../components/LegalRichText";
import { getAppPlatform, getAppVersion } from "../config/runtime";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/tokens";
import {
  AVATAR_CROP_MAX_ZOOM,
  AVATAR_CROP_MIN_ZOOM,
  buildAvatarCropSelection,
  buildAvatarPreviewImageStyle,
  clampAvatarCropOffsets,
  getAvatarCropMetrics,
  type AvatarCropDraft,
  type AvatarCropSelection,
} from "../utils/avatarCrop";
import { sanitizeAvatarUrl } from "../utils/communityUi";
import { extractApiErrorMessage } from "../utils/apiErrors";
import {
  formatAuthMethodLabel,
  formatLegalAcceptanceSource,
  formatLegalDocumentType,
  formatLegalPlatform,
} from "../utils/legalText";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => void | Promise<void>;
  onProfileUpdated?: (profile: MeProfileResponse) => void;
  pushStatusMessage?: string | null;
  initialPanel?: AccountPanel | null;
  privacyNotice?: string | null;
};

export type AccountPanel = "home" | "profile" | "password" | "plan" | "notifications" | "privacy" | "export" | "delete";

type MenuRowProps = {
  theme: AppTheme;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
  subtitle: string;
  testID?: string;
  danger?: boolean;
  onPress: () => void;
};

type ProfileAvatarProps = {
  theme: AppTheme;
  name: string;
  avatarUrl?: string | null;
  crop?: AvatarCropSelection | null;
  size?: number;
};

type ProfileFormState = {
  name: string;
  profession: string;
  avatarPreviewUrl: string | null;
  avatarAsset: UpdateMeProfileAvatarUpload | null;
  avatarCrop: AvatarCropSelection | null;
  avatarRemoved: boolean;
};

type AvatarCropperState = {
  asset: UpdateMeProfileAvatarUpload;
  draft: AvatarCropDraft;
};

type PlanOption = {
  tier: SubscriptionTier;
  title: string;
  subtitle: string;
  price: string;
  period: string;
  description: string;
  highlights: string[];
};

const PLAN_OPTIONS: PlanOption[] = [
  {
    tier: "essential",
    title: "Essencial",
    subtitle: "Foco em leitura contínua e interação básica.",
    price: "R$ 29,90",
    period: "/ mês",
    description: "Ideal para quem quer biblioteca e comunidade em uma assinatura mais enxuta.",
    highlights: ["Biblioteca", "Comunidade", "Busca global", "Notificações essenciais"],
  },
  {
    tier: "professional",
    title: "Profissional",
    subtitle: "Pacote completo para uso profissional diário.",
    price: "R$ 79,90",
    period: "/ mês",
    description: "Inclui todos os módulos do app para rotina de estudo, prática e atualização.",
    highlights: ["Biblioteca", "Comunidade", "Jurisprudência", "Banco de Peças", "Curso"],
  },
];

function formatTier(tier: SubscriptionTier | null | undefined) {
  if (!tier) return "Sem assinatura ativa";
  if (tier === "professional") return "Profissional";
  return "Essencial";
}

function formatStatus(status: SubscriptionStatus | null | undefined) {
  if (!status) return "-";
  if (status === "active") return "Ativa";
  if (status === "canceled") return "Cancelada";
  return "Inativa";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function isEditorialLegalTitle(document: Pick<LegalDocumentSummary, "document_type" | "title">) {
  const documentTypeLabel = formatLegalDocumentType(document.document_type);
  return (
    document.title.trim().length > 0 &&
    document.title.trim().toLowerCase() !== documentTypeLabel.trim().toLowerCase()
  );
}

function getInitials(name: string) {
  const cleaned = (name || "").trim();
  if (!cleaned) return "LV";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  const body = error.body as { detail?: unknown } | null;
  if (body && typeof body.detail === "string" && body.detail.trim()) {
    return body.detail;
  }
  return fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function PanelSectionLabel({ theme, children }: { theme: AppTheme; children: React.ReactNode }) {
  return <Text style={[styles.panelSectionLabel, { color: theme.colors.textMuted }]}>{children}</Text>;
}

function ProfileAvatar({ theme, name, avatarUrl, crop, size = 68 }: ProfileAvatarProps) {
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl);
  const [imageFailed, setImageFailed] = React.useState(false);
  const showImage = Boolean(safeAvatarUrl) && !imageFailed;
  const croppedPreviewStyle = React.useMemo(
    () => (showImage && crop ? buildAvatarPreviewImageStyle(size, crop) : null),
    [crop, showImage, size]
  );

  React.useEffect(() => {
    setImageFailed(false);
  }, [safeAvatarUrl]);

  return (
    <View
      style={[
        styles.profileAvatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.topBarBg,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: safeAvatarUrl! }}
          style={croppedPreviewStyle ? [styles.profileAvatarCroppedImage, croppedPreviewStyle] : styles.profileAvatarImage}
          resizeMode={croppedPreviewStyle ? "stretch" : "cover"}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={[styles.profileAvatarText, { color: theme.colors.sidebarText }]}>{getInitials(name)}</Text>
      )}
    </View>
  );
}

function MenuRow({ theme, icon, title, subtitle, testID, danger = false, onPress }: MenuRowProps) {
  const iconColor = danger ? theme.colors.danger : theme.colors.textMuted;
  const titleColor = danger ? theme.colors.danger : theme.colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.menuRow,
        { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface },
      ]}
      onPress={onPress}
    >
      <View style={styles.menuRowLead}>
        <View style={[styles.menuIconWrap, { backgroundColor: theme.colors.surfaceMuted }]}>
          <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.menuCopy}>
          <Text style={[styles.menuTitle, { color: titleColor }]}>{title}</Text>
          <Text style={[styles.menuSubtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={iconColor} />
    </Pressable>
  );
}

export function AccountScreen({
  token,
  onBack,
  onLogout,
  onProfileUpdated,
  pushStatusMessage,
  initialPanel = null,
  privacyNotice = null,
}: Props) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = React.useState(true);
  const [entitlements, setEntitlements] = React.useState<EntitlementsResponse | null>(null);
  const [profile, setProfile] = React.useState<MeProfileResponse | null>(null);
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [updatingPreference, setUpdatingPreference] = React.useState<Record<NotificationPreferenceField, boolean>>({
    notifications_enabled: false,
    book_version_updates_enabled: false,
    new_content_updates_enabled: false,
    community_interaction_updates_enabled: false,
    push_enabled: false,
  });
  const [preferencesError, setPreferencesError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [privacyMessage, setPrivacyMessage] = React.useState<string | null>(null);
  const [privacyLoading, setPrivacyLoading] = React.useState(true);
  const [legalDocuments, setLegalDocuments] = React.useState<LegalDocumentSummary[]>([]);
  const [legalAcceptances, setLegalAcceptances] = React.useState<LegalAcceptanceEntry[]>([]);
  const [linkedAccounts, setLinkedAccounts] = React.useState<LinkedAccount[]>([]);
  const [linkedAccountsBusyProvider, setLinkedAccountsBusyProvider] = React.useState<string | null>(null);
  const [socialPasswordForm, setSocialPasswordForm] = React.useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [socialPasswordBusy, setSocialPasswordBusy] = React.useState(false);
  const [socialPasswordError, setSocialPasswordError] = React.useState<string | null>(null);
  const [exportingData, setExportingData] = React.useState(false);
  const [exportPayload, setExportPayload] = React.useState<DataExportResponse | null>(null);
  const [exportSummary, setExportSummary] = React.useState<DataExportSummary | null>(null);
  const [deletingData, setDeletingData] = React.useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("");
  const [deleteReason, setDeleteReason] = React.useState("");
  const [activePanel, setActivePanel] = React.useState<AccountPanel>("home");
  const [profileForm, setProfileForm] = React.useState<ProfileFormState>({
    name: "",
    profession: "",
    avatarPreviewUrl: null,
    avatarAsset: null,
    avatarCrop: null,
    avatarRemoved: false,
  });
  const [avatarCropper, setAvatarCropper] = React.useState<AvatarCropperState | null>(null);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profilePickerLoading, setProfilePickerLoading] = React.useState(false);
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: "",
    nextPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [profileRes, entitlementsRes, preferencesRes] = await Promise.allSettled([
          getMeProfile(token),
          getMyEntitlements(token),
          getNotificationPreferences(token),
        ]);

        if (!alive) return;
        setProfile(profileRes.status === "fulfilled" ? profileRes.value : null);
        setEntitlements(entitlementsRes.status === "fulfilled" ? entitlementsRes.value : null);
        setPreferences(preferencesRes.status === "fulfilled" ? preferencesRes.value : null);

        const allRejected =
          profileRes.status === "rejected" &&
          entitlementsRes.status === "rejected" &&
          preferencesRes.status === "rejected";

        setError(allRejected ? "Não foi possível carregar os dados da sua conta." : null);
      } catch {
        if (!alive) return;
        setProfile(null);
        setEntitlements(null);
        setPreferences(null);
        setError("Não foi possível carregar os dados da sua conta.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setPrivacyLoading(true);
        const [documentsRes, acceptancesRes, linkedAccountsRes] = await Promise.allSettled([
          getRequiredLegalDocuments(token),
          getLegalAcceptances(token),
          getLinkedAccounts(token),
        ]);

        if (!alive) return;

        if (documentsRes.status === "fulfilled") {
          setLegalDocuments(documentsRes.value.documents);
        }
        if (acceptancesRes.status === "fulfilled") {
          setLegalAcceptances(acceptancesRes.value.acceptances);
        }
        if (linkedAccountsRes.status === "fulfilled") {
          setLinkedAccounts(linkedAccountsRes.value.linked_accounts);
        }

        const allRejected =
          documentsRes.status === "rejected" &&
          acceptancesRes.status === "rejected" &&
          linkedAccountsRes.status === "rejected";

        if (allRejected) {
          setPrivacyMessage("Não foi possível carregar o bloco de privacidade e contas vinculadas.");
        }
      } finally {
        if (alive) {
          setPrivacyLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  React.useEffect(() => {
    setProfileForm({
      name: profile?.name || "",
      profession: profile?.profession || "",
      avatarPreviewUrl: sanitizeAvatarUrl(profile?.avatar_url),
      avatarAsset: null,
      avatarCrop: null,
      avatarRemoved: false,
    });
  }, [profile?.avatar_url, profile?.name, profile?.profession]);

  React.useEffect(() => {
    if (initialPanel) {
      setActivePanel(initialPanel);
    }
  }, [initialPanel]);

  React.useEffect(() => {
    if (privacyNotice) {
      setPrivacyMessage(privacyNotice);
    }
  }, [privacyNotice]);

  const displayName = (profile?.name || "").trim() || "Nome não informado";
  const displayProfession = (profile?.profession || "").trim() || "Profissão não informada";
  const displayEmail = (profile?.email || "").trim() || "-";
  const displayAvatarUrl = sanitizeAvatarUrl(profile?.avatar_url);
  const hasPendingLegalDocuments = legalDocuments.some((document) => !document.accepted);
  const authMethodsLabel = profile?.auth_methods?.length
    ? profile.auth_methods.map((method) => formatAuthMethodLabel(method)).join(", ")
    : "Nenhum";
  const canSubmitSetPassword =
    !socialPasswordBusy &&
    socialPasswordForm.newPassword.trim().length >= 8 &&
    socialPasswordForm.newPassword === socialPasswordForm.confirmPassword;
  const isWidePlansLayout = width >= 920;
  const avatarCropViewportSize = Math.min(Math.max(width - 72, 220), 340);
  const avatarCropBaseOffsetRef = React.useRef({ x: 0, y: 0 });
  const avatarCropDraftRef = React.useRef<AvatarCropDraft | null>(null);

  React.useEffect(() => {
    avatarCropDraftRef.current = avatarCropper?.draft ?? null;
  }, [avatarCropper]);

  const togglePreference = React.useCallback(
    async (field: NotificationPreferenceField) => {
      if (!preferences) return;
      if (updatingPreference[field]) return;

      const current = Boolean(preferences[field]);
      const next = !current;

      setPreferencesError(null);
      setUpdatingPreference((prev) => ({ ...prev, [field]: true }));
      setPreferences((prev) => (prev ? { ...prev, [field]: next } : prev));

      try {
        const updated = await updateNotificationPreferences(token, { [field]: next });
        setPreferences(updated);
      } catch {
        setPreferences((prev) => (prev ? { ...prev, [field]: current } : prev));
        setPreferencesError("Não foi possível atualizar suas preferências de notificação.");
      } finally {
        setUpdatingPreference((prev) => ({ ...prev, [field]: false }));
      }
    },
    [preferences, token, updatingPreference]
  );

  const isPreferenceDisabled = (field: NotificationPreferenceField) => {
    if (updatingPreference[field]) return true;
    if (!preferences) return true;
    if (field !== "notifications_enabled" && !preferences.notifications_enabled) return true;
    return false;
  };

  const handleExportData = React.useCallback(async () => {
    if (exportingData) return;
    setPrivacyMessage(null);
    setExportingData(true);
    try {
      const payload = await getMyDataExport(token);
      setExportPayload(payload);
      setExportSummary(buildDataExportSummary(payload));
      setPrivacyMessage("Exportação concluída. O pacote de dados foi gerado com sucesso.");
    } catch (err) {
      setPrivacyMessage(getApiErrorMessage(err, "Não foi possível exportar seus dados agora."));
    } finally {
      setExportingData(false);
    }
  }, [exportingData, token]);

  const handleShareExport = React.useCallback(async () => {
    if (!exportPayload) return;
    try {
      await Share.share({
        title: "Exportação de dados - Livro Vivo",
        message: JSON.stringify(exportPayload, null, 2),
      });
    } catch {
      setPrivacyMessage("Não foi possível compartilhar o JSON da exportação.");
    }
  }, [exportPayload]);

  const handleRequestErasure = React.useCallback(async () => {
    if (deletingData) return;
    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      setPrivacyMessage('Confirmação inválida. Digite "DELETE" para continuar.');
      return;
    }

    setPrivacyMessage(null);
    setDeletingData(true);
    try {
      await requestMyDataErasure(token, deleteReason);
      Alert.alert("Solicitação concluída", "Sua conta foi anonimizada. Você será desconectado do app agora.");
      setPrivacyMessage("Solicitação de exclusão concluída com sucesso.");
      setDeleteConfirmation("");
      setDeleteReason("");
      setDeletingData(false);
      await Promise.resolve(onLogout());
      return;
    } catch (err) {
      setPrivacyMessage(getApiErrorMessage(err, "Não foi possível solicitar a exclusão agora."));
    }

    setDeletingData(false);
  }, [deleteConfirmation, deleteReason, deletingData, onLogout, token]);

  const handleCropZoom = React.useCallback(
    (delta: number) => {
      setAvatarCropper((current) => {
        if (!current) return current;
        const nextZoom = clampNumber(current.draft.zoom + delta, AVATAR_CROP_MIN_ZOOM, AVATAR_CROP_MAX_ZOOM);
        const nextDraft = { ...current.draft, zoom: nextZoom };
        const clamped = clampAvatarCropOffsets(nextDraft, avatarCropViewportSize);
        return {
          ...current,
          draft: {
            ...nextDraft,
            offsetX: clamped.x,
            offsetY: clamped.y,
          },
        };
      });
    },
    [avatarCropViewportSize]
  );

  const handleConfirmAvatarCrop = React.useCallback(() => {
    if (!avatarCropper) return;

    const crop = buildAvatarCropSelection(avatarCropper.draft, avatarCropViewportSize);
    setProfileForm((prev) => ({
      ...prev,
      avatarPreviewUrl: avatarCropper.asset.uri,
      avatarAsset: avatarCropper.asset,
      avatarCrop: crop,
      avatarRemoved: false,
    }));
    setAvatarCropper(null);
  }, [avatarCropViewportSize, avatarCropper]);

  const handleCancelAvatarCrop = React.useCallback(() => {
    setAvatarCropper(null);
  }, []);

  const avatarCropPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => Boolean(avatarCropDraftRef.current),
        onStartShouldSetPanResponderCapture: () => Boolean(avatarCropDraftRef.current),
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Boolean(avatarCropDraftRef.current) && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Boolean(avatarCropDraftRef.current) && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2),
        onPanResponderGrant: () => {
          avatarCropBaseOffsetRef.current = {
            x: avatarCropDraftRef.current?.offsetX ?? 0,
            y: avatarCropDraftRef.current?.offsetY ?? 0,
          };
        },
        onPanResponderMove: (_, gestureState) => {
          setAvatarCropper((current) => {
            if (!current) return current;
            const nextDraft = {
              ...current.draft,
              offsetX: avatarCropBaseOffsetRef.current.x + gestureState.dx,
              offsetY: avatarCropBaseOffsetRef.current.y + gestureState.dy,
            };
            const clamped = clampAvatarCropOffsets(nextDraft, avatarCropViewportSize);
            return {
              ...current,
              draft: {
                ...nextDraft,
                offsetX: clamped.x,
                offsetY: clamped.y,
              },
            };
          });
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [avatarCropViewportSize]
  );

  const avatarCropMetrics = React.useMemo(() => {
    if (!avatarCropper) return null;
    return getAvatarCropMetrics(
      avatarCropper.draft.imageWidth,
      avatarCropper.draft.imageHeight,
      avatarCropViewportSize,
      avatarCropper.draft.zoom
    );
  }, [avatarCropViewportSize, avatarCropper]);

  const handleSaveProfile = React.useCallback(async () => {
    if (profileSaving) return;
    setProfileError(null);
    setProfileMessage(null);
    setProfileSaving(true);

    try {
      const payload = {
        name: profileForm.name.trim(),
        profession: profileForm.profession.trim(),
        ...(profileForm.avatarAsset ? { avatar: profileForm.avatarAsset } : {}),
        ...(profileForm.avatarAsset && profileForm.avatarCrop
          ? {
              avatar_crop: {
                x: profileForm.avatarCrop.x,
                y: profileForm.avatarCrop.y,
                size: profileForm.avatarCrop.size,
              } satisfies UpdateMeProfileAvatarCrop,
            }
          : {}),
        ...(profileForm.avatarRemoved ? { avatar_clear: true } : {}),
      };

      const updated = await updateMeProfile(token, payload);
      setProfile(updated);
      onProfileUpdated?.(updated);
      setProfileMessage("Perfil atualizado com sucesso.");
    } catch (err) {
      setProfileError(getApiErrorMessage(err, "Não foi possível salvar o perfil agora."));
    } finally {
      setProfileSaving(false);
    }
  }, [
    onProfileUpdated,
    profileForm.avatarAsset,
    profileForm.avatarCrop,
    profileForm.avatarRemoved,
    profileForm.name,
    profileForm.profession,
    profileSaving,
    token,
  ]);

  const handlePickProfileAvatar = React.useCallback(async () => {
    if (profilePickerLoading) return;

    setProfileError(null);
    setProfileMessage(null);
    setProfilePickerLoading(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setProfileError("Permita o acesso à galeria para escolher uma foto.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.width || !asset.height) {
        setProfileError("Não foi possível identificar o tamanho da imagem selecionada.");
        return;
      }

      setAvatarCropper({
        asset: {
          uri: asset.uri,
          name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
          type: asset.mimeType ?? "image/jpeg",
          file: asset.file ?? null,
        },
        draft: {
          imageWidth: asset.width,
          imageHeight: asset.height,
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
        },
      });
    } catch {
      setProfileError("Não foi possível abrir a galeria agora.");
    } finally {
      setProfilePickerLoading(false);
    }
  }, [profilePickerLoading]);

  const handleRemoveProfileAvatar = React.useCallback(() => {
    setProfileError(null);
    setProfileMessage(null);
    setProfileForm((prev) => ({
      ...prev,
      avatarPreviewUrl: null,
      avatarAsset: null,
      avatarCrop: null,
      avatarRemoved: Boolean(displayAvatarUrl),
    }));
  }, [displayAvatarUrl]);

  const handlePlanAction = React.useCallback((targetTier: SubscriptionTier) => {
    const actionLabel =
      entitlements?.effective_tier === "professional" && targetTier === "essential"
        ? "downgrade"
        : entitlements?.effective_tier === "essential" && targetTier === "professional"
          ? "upgrade"
          : "seleção";

    Alert.alert(
      "Em breve",
      `O fluxo de ${actionLabel} de plano será conectado ao billing em uma próxima etapa.`
    );
  }, [entitlements?.effective_tier]);

  const handleChangePassword = React.useCallback(async () => {
    if (passwordSaving) return;
    setPasswordError(null);
    setPasswordMessage(null);

    if (!passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword) {
      setPasswordError("Preencha a senha atual, a nova senha e a confirmação.");
      return;
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setPasswordError("A confirmação da nova senha precisa ser idêntica.");
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await changeMyPassword(token, {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.nextPassword,
      });
      setPasswordForm({ currentPassword: "", nextPassword: "", confirmPassword: "" });
      setPasswordMessage(response.detail || "Senha atualizada com sucesso.");
    } catch (err) {
      setPasswordError(getApiErrorMessage(err, "Não foi possível atualizar a senha agora."));
    } finally {
      setPasswordSaving(false);
    }
  }, [passwordForm.confirmPassword, passwordForm.currentPassword, passwordForm.nextPassword, passwordSaving, token]);

  const handleAcceptCurrentLegalDocuments = React.useCallback(async () => {
    if (!legalDocuments.length) {
      setPrivacyMessage("Nenhum documento vigente foi retornado pela API.");
      return;
    }

    try {
      setPrivacyMessage(null);
      const response = await acceptLegalDocuments(token, {
        document_ids: legalDocuments.map((document) => document.id),
        source: "account_settings",
        app_platform: getAppPlatform(),
        app_version: getAppVersion(),
      });
      const documentsResponse = await getRequiredLegalDocuments(token);
      const acceptancesResponse = await getLegalAcceptances(token);
      setLegalDocuments(documentsResponse.documents);
      setLegalAcceptances(acceptancesResponse.acceptances);
      setProfile((current) => {
        if (!current) return current;
        const nextProfile = {
          ...current,
          legal_status: response.legal_status,
        };
        onProfileUpdated?.(nextProfile);
        return nextProfile;
      });
      setPrivacyMessage("Documentos legais atualizados com sucesso.");
    } catch (err) {
      setPrivacyMessage(extractApiErrorMessage(err, "Não foi possível atualizar os consentimentos agora."));
    }
  }, [legalDocuments, onProfileUpdated, token]);

  const handleStartLinkedAccount = React.useCallback(
    async (provider: string) => {
      const redirectUri = getCurrentWebRedirectUri();
      if (!redirectUri) {
        Alert.alert("Disponível no web", "O vínculo de contas sociais desta fase está habilitado primeiro no web.");
        return;
      }

      try {
        setPrivacyMessage(null);
        setLinkedAccountsBusyProvider(provider);
        const response = await startSocialAuth(
          provider,
          {
            redirect_uri: redirectUri,
            intent: "link",
          },
          token
        );
        redirectToSocialAuthorization(response.authorization_url);
      } catch (err) {
        setPrivacyMessage(extractApiErrorMessage(err, "Não foi possível iniciar o vínculo desta conta agora."));
        setLinkedAccountsBusyProvider(null);
      }
    },
    [token]
  );

  const handleUnlinkAccount = React.useCallback(
    async (provider: string) => {
      try {
        setPrivacyMessage(null);
        setLinkedAccountsBusyProvider(provider);
        const response = await unlinkLinkedAccount(token, provider);
        setLinkedAccounts(response.linked_accounts);
        setProfile((current) => {
          if (!current) return current;
          const nextProfile = {
            ...current,
            has_usable_password: response.has_usable_password,
            auth_methods: response.auth_methods,
          };
          onProfileUpdated?.(nextProfile);
          return nextProfile;
        });
        setPrivacyMessage("Conta desvinculada com sucesso.");
      } catch (err) {
        setPrivacyMessage(extractApiErrorMessage(err, "Não foi possível desvincular esta conta agora."));
      } finally {
        setLinkedAccountsBusyProvider(null);
      }
    },
    [onProfileUpdated, token]
  );

  const handleSetPassword = React.useCallback(async () => {
    if (!canSubmitSetPassword) {
      setSocialPasswordError("Confirme a nova senha com pelo menos 8 caracteres.");
      return;
    }

    try {
      setSocialPasswordBusy(true);
      setSocialPasswordError(null);
      setPrivacyMessage(null);
      const response = await setPasswordFromSocialOnlyAccount(token, socialPasswordForm.newPassword);
      setLinkedAccounts(response.linked_accounts);
      const nextProfile: MeProfileResponse = {
        ...response.user,
        has_usable_password: response.has_usable_password,
        auth_methods: response.auth_methods,
        legal_status: response.legal_status,
      };
      setProfile(nextProfile);
      onProfileUpdated?.(nextProfile);
      setSocialPasswordForm({ newPassword: "", confirmPassword: "" });
      setPrivacyMessage(response.detail || "Senha definida com sucesso.");
    } catch (err) {
      setSocialPasswordError(extractApiErrorMessage(err, "Não foi possível definir a senha agora."));
    } finally {
      setSocialPasswordBusy(false);
    }
  }, [canSubmitSetPassword, onProfileUpdated, socialPasswordForm.newPassword, token]);

  const canSubmitErasure = deleteConfirmation.trim().toUpperCase() === "DELETE" && !deletingData;

  const renderPanelHeader = (title: string, description: string) => (
    <View style={styles.panelStack}>
      <Pressable
        testID="account-section-back"
        accessibilityRole="button"
        accessibilityLabel="Voltar para Minha Conta"
        onPress={() => setActivePanel("home")}
        style={styles.sectionBackAction}
      >
        <MaterialCommunityIcons name="arrow-left" size={16} color={theme.colors.textMuted} />
        <Text style={[styles.sectionBackText, { color: theme.colors.textMuted }]}>Voltar para Minha Conta</Text>
      </Pressable>

      <View
        style={[
          styles.panelIntroCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            ...theme.shadow.card,
          },
        ]}
      >
        <Text style={[styles.panelTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>{description}</Text>
      </View>
    </View>
  );

  const renderHomePanel = () => (
    <View style={styles.panelStack}>
      <View
        style={[
          styles.heroCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            ...theme.shadow.card,
          },
        ]}
      >
        <ProfileAvatar theme={theme} name={displayName} avatarUrl={displayAvatarUrl} size={72} />
        <View style={styles.heroCopy}>
          <Text style={[styles.heroName, { color: theme.colors.text }]}>{displayName}</Text>
          <Text style={[styles.heroMeta, { color: theme.colors.textMuted }]}>{displayEmail}</Text>
          <Text style={[styles.heroMeta, { color: theme.colors.textMuted }]}>{displayProfession}</Text>
          <View
            style={[
              styles.heroPlanBadge,
              { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Text style={[styles.heroPlanText, { color: theme.colors.accent }]}>
              {formatTier(entitlements?.effective_tier)} • {formatStatus(entitlements?.subscription?.status)}
            </Text>
          </View>
        </View>
      </View>

      <PanelSectionLabel theme={theme}>Perfil</PanelSectionLabel>
      <View style={[styles.menuGroup, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <MenuRow
          theme={theme}
          testID="account-menu-profile"
          icon="account-edit-outline"
          title="Editar perfil"
          subtitle="Nome, profissão e foto"
          onPress={() => setActivePanel("profile")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
        <MenuRow
          theme={theme}
          testID="account-menu-password"
          icon="key-outline"
          title="Alterar senha"
          subtitle="Atualizar credenciais"
          onPress={() => setActivePanel("password")}
        />
      </View>

      <PanelSectionLabel theme={theme}>Plano</PanelSectionLabel>
      <View style={[styles.menuGroup, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <MenuRow
          theme={theme}
          testID="account-menu-plan"
          icon="crown-outline"
          title="Meu plano"
          subtitle={`${formatTier(entitlements?.effective_tier)} • ${formatStatus(entitlements?.subscription?.status)}`}
          onPress={() => setActivePanel("plan")}
        />
      </View>

      <PanelSectionLabel theme={theme}>Configurações</PanelSectionLabel>
      <View style={[styles.menuGroup, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <MenuRow
          theme={theme}
          testID="account-menu-notifications"
          icon="bell-outline"
          title="Notificações"
          subtitle="E-mail, push e alertas do app"
          onPress={() => setActivePanel("notifications")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
        <MenuRow
          theme={theme}
          testID="account-menu-privacy"
          icon="shield-check-outline"
          title="Privacidade (LGPD)"
          subtitle="Dados e consentimento"
          onPress={() => setActivePanel("privacy")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
        <MenuRow
          theme={theme}
          testID="account-menu-export"
          icon="download-outline"
          title="Exportar dados"
          subtitle="Gerar e baixar seu pacote"
          onPress={() => setActivePanel("export")}
        />
      </View>

      <PanelSectionLabel theme={theme}>Zona de risco</PanelSectionLabel>
      <View style={[styles.menuGroup, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <MenuRow
          theme={theme}
          danger
          testID="account-menu-delete"
          icon="delete-outline"
          title="Deletar conta"
          subtitle="Ação permanente"
          onPress={() => setActivePanel("delete")}
        />
      </View>
    </View>
  );

  const renderProfilePanel = () => (
    <View style={styles.panelStack}>
      {renderPanelHeader("Editar perfil", "Atualize nome, profissão e a foto que aparece na comunidade.")}

      <View
        style={[
          styles.formCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
        >
        <View style={styles.profileEditorHeader}>
        <ProfileAvatar
          theme={theme}
          name={profileForm.name || displayName}
          avatarUrl={profileForm.avatarPreviewUrl}
          crop={profileForm.avatarCrop}
          size={84}
        />
          <View style={styles.profileEditorCopy}>
            <Text style={[styles.profilePreviewName, { color: theme.colors.text }]}>
              {(profileForm.name || "").trim() || "Nome não informado"}
            </Text>
            <Text style={[styles.profilePreviewMeta, { color: theme.colors.textMuted }]}>
              {(profileForm.profession || "").trim() || "Profissão não informada"}
            </Text>
            <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
              A foto aparece na comunidade e no menu da conta.
            </Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Nome</Text>
          <TextInput
            testID="account-profile-name"
            accessibilityLabel="Nome do perfil"
            value={profileForm.name}
            onChangeText={(value) => setProfileForm((prev) => ({ ...prev, name: value }))}
            placeholder="Seu nome"
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
                color: theme.colors.text,
              },
            ]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Profissão</Text>
          <TextInput
            testID="account-profile-profession"
            accessibilityLabel="Profissão do perfil"
            value={profileForm.profession}
            onChangeText={(value) => setProfileForm((prev) => ({ ...prev, profession: value }))}
            placeholder="Ex.: Advogado"
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
                color: theme.colors.text,
              },
            ]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Foto do perfil</Text>
          <View style={styles.inlineActions}>
            <Pressable
              testID="account-profile-avatar-pick"
              accessibilityRole="button"
              accessibilityLabel="Escolher foto do perfil"
              style={[
                styles.secondaryAction,
                {
                  borderColor: theme.colors.borderStrong,
                  backgroundColor: theme.colors.surfaceMuted,
                },
                profilePickerLoading || profileSaving ? styles.disabledAction : null,
              ]}
              disabled={profilePickerLoading || profileSaving}
              onPress={() => void handlePickProfileAvatar()}
            >
              <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>
                {profilePickerLoading ? "Abrindo galeria..." : "Escolher foto"}
              </Text>
            </Pressable>

            {(profileForm.avatarPreviewUrl || displayAvatarUrl) ? (
              <Pressable
                testID="account-profile-avatar-remove"
                accessibilityRole="button"
                accessibilityLabel="Remover foto do perfil"
                style={[
                  styles.secondaryAction,
                  {
                    borderColor: theme.colors.danger,
                    backgroundColor: theme.colors.surface,
                  },
                  profileSaving ? styles.disabledAction : null,
                ]}
                disabled={profileSaving}
                onPress={handleRemoveProfileAvatar}
              >
                <Text style={[styles.secondaryActionText, { color: theme.colors.danger }]}>Remover foto</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
            Selecione uma imagem da galeria. O upload substitui a foto atual e atualiza a comunidade.
          </Text>
        </View>

        {profileError ? <Text style={[styles.feedbackText, { color: theme.colors.danger }]}>{profileError}</Text> : null}
        {profileMessage ? <Text style={[styles.feedbackText, { color: theme.colors.success }]}>{profileMessage}</Text> : null}

        <Pressable
          testID="account-profile-save"
          accessibilityRole="button"
          accessibilityLabel="Salvar perfil"
          style={[
            styles.primaryAction,
            { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            profileSaving ? styles.disabledAction : null,
          ]}
          disabled={profileSaving}
          onPress={() => void handleSaveProfile()}
        >
          <Text style={[styles.primaryActionText, { color: theme.colors.textInverse }]}>
            {profileSaving ? "Salvando perfil..." : "Salvar perfil"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderPasswordPanel = () => (
    <View style={styles.panelStack}>
      {renderPanelHeader("Alterar senha", "Troque sua senha com validação da senha atual e confirmação da nova senha.")}

      <View
        style={[
          styles.formCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Senha atual</Text>
          <TextInput
            testID="account-password-current"
            accessibilityLabel="Senha atual"
            value={passwordForm.currentPassword}
            onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, currentPassword: value }))}
            placeholder="Digite sua senha atual"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
                color: theme.colors.text,
              },
            ]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Nova senha</Text>
          <TextInput
            testID="account-password-next"
            accessibilityLabel="Nova senha"
            value={passwordForm.nextPassword}
            onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, nextPassword: value }))}
            placeholder="Digite a nova senha"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
                color: theme.colors.text,
              },
            ]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Confirmar nova senha</Text>
          <TextInput
            testID="account-password-confirm"
            accessibilityLabel="Confirmar nova senha"
            value={passwordForm.confirmPassword}
            onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))}
            placeholder="Repita a nova senha"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
                color: theme.colors.text,
              },
            ]}
          />
        </View>

        {passwordError ? <Text style={[styles.feedbackText, { color: theme.colors.danger }]}>{passwordError}</Text> : null}
        {passwordMessage ? <Text style={[styles.feedbackText, { color: theme.colors.success }]}>{passwordMessage}</Text> : null}

        <Pressable
          testID="account-password-save"
          accessibilityRole="button"
          accessibilityLabel="Salvar nova senha"
          style={[
            styles.primaryAction,
            { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            passwordSaving ? styles.disabledAction : null,
          ]}
          disabled={passwordSaving}
          onPress={() => void handleChangePassword()}
        >
          <Text style={[styles.primaryActionText, { color: theme.colors.textInverse }]}>
            {passwordSaving ? "Atualizando senha..." : "Atualizar senha"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderPlanPanel = () => (
    <View style={styles.panelStack}>
      {renderPanelHeader("Meu plano", "Escolha o pacote ideal e deixe a troca de plano pronta para quando o billing entrar no app.")}

      <View
        style={[
          styles.planStatusCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Text style={[styles.planStatusEyebrow, { color: theme.colors.textMuted }]}>Assinatura atual</Text>
        <Text style={[styles.planHeadline, { color: theme.colors.text }]}>
          {formatTier(entitlements?.effective_tier)}
        </Text>
        <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
          Status: {formatStatus(entitlements?.subscription?.status)} • Founder: {entitlements?.subscription?.is_founder ? "Sim" : "Não"}
        </Text>
        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
          Expira em: {formatDateTime(entitlements?.subscription?.expires_at)}
        </Text>
      </View>

      <View style={[styles.planCardsGrid, isWidePlansLayout ? styles.planCardsGridDesktop : null]}>
        {PLAN_OPTIONS.map((option) => {
          const isCurrentPlan = entitlements?.effective_tier === option.tier;
          const isUpgrade = entitlements?.effective_tier === "essential" && option.tier === "professional";
          const isDowngrade = entitlements?.effective_tier === "professional" && option.tier === "essential";
          const ctaLabel = isCurrentPlan
            ? "Plano atual"
            : isUpgrade
              ? "Melhorar plano"
              : isDowngrade
                ? "Baixar plano"
                : "Escolher plano";

          return (
            <View
              key={option.tier}
              style={[
                styles.planCatalogCard,
                {
                  borderColor: isCurrentPlan ? theme.colors.accent : theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  ...(isCurrentPlan ? theme.shadow.card : null),
                },
              ]}
            >
              <View style={styles.planCatalogHeader}>
                <View style={styles.planCatalogCopy}>
                  <Text style={[styles.planOptionTitle, { color: theme.colors.text }]}>{option.title}</Text>
                  <Text style={[styles.planOptionBody, { color: theme.colors.textMuted }]}>{option.subtitle}</Text>
                </View>
                {isCurrentPlan ? (
                  <View
                    style={[
                      styles.planCurrentBadge,
                      { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceMuted },
                    ]}
                  >
                    <Text style={[styles.planCurrentBadgeText, { color: theme.colors.accent }]}>Plano atual</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.planPriceRow}>
                <Text style={[styles.planPriceValue, { color: theme.colors.text }]}>{option.price}</Text>
                <Text style={[styles.planPricePeriod, { color: theme.colors.textMuted }]}>{option.period}</Text>
              </View>

              <Text style={[styles.planOptionBody, { color: theme.colors.textMuted }]}>{option.description}</Text>

              <View style={styles.planFeatureList}>
                {option.highlights.map((highlight) => (
                  <View key={highlight} style={styles.planFeatureRow}>
                    <MaterialCommunityIcons name="check" size={16} color={theme.colors.accent} />
                    <Text style={[styles.planFeatureText, { color: theme.colors.text }]}>{highlight}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                testID={`account-plan-${option.tier}`}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                style={[
                  isCurrentPlan ? styles.secondaryAction : styles.primaryAction,
                  {
                    borderColor: isCurrentPlan ? theme.colors.borderStrong : theme.colors.primary,
                    backgroundColor: isCurrentPlan ? theme.colors.surfaceMuted : theme.colors.primary,
                  },
                ]}
                disabled={isCurrentPlan}
                onPress={() => handlePlanAction(option.tier)}
              >
                <Text
                  style={[
                    isCurrentPlan ? styles.secondaryActionText : styles.primaryActionText,
                    { color: isCurrentPlan ? theme.colors.textMuted : theme.colors.textInverse },
                  ]}
                >
                  {ctaLabel}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text style={[styles.planFootnote, { color: theme.colors.textMuted }]}>
        Valores e ações já deixam o layout pronto. A integração real de cobrança e mudança de plano entra depois.
      </Text>
    </View>
  );

  const renderNotificationsPanel = () => (
    <View style={styles.panelStack}>
      {renderPanelHeader("Notificações", "Escolha quais alertas o app pode preparar e entregar para você.")}

      <View
        style={[
          styles.formCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        {preferences?.updated_at ? (
          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
            Última atualização: {formatDateTime(preferences.updated_at)}
          </Text>
        ) : null}

        <View style={styles.preferenceRows}>
          <View
            style={[
              styles.preferenceItem,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <View style={styles.preferenceTextWrap}>
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Receber notificações</Text>
              <Text style={[styles.preferenceHint, { color: theme.colors.textMuted }]}>
                Controle geral das notificações do app.
              </Text>
            </View>
            <Pressable
              testID="account-pref-notifications"
              accessibilityRole="switch"
              accessibilityLabel="Receber notificações"
              accessibilityState={{
                checked: Boolean(preferences?.notifications_enabled),
                disabled: isPreferenceDisabled("notifications_enabled"),
              }}
              style={[
                styles.preferenceToggle,
                preferences?.notifications_enabled
                  ? { borderColor: theme.colors.success, backgroundColor: theme.isDark ? "#183829" : "#E7F5EC" }
                  : { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
                isPreferenceDisabled("notifications_enabled") ? styles.disabledAction : null,
              ]}
              disabled={isPreferenceDisabled("notifications_enabled")}
              onPress={() => void togglePreference("notifications_enabled")}
            >
              <Text style={[styles.preferenceToggleText, { color: theme.colors.text }]}>
                {preferences?.notifications_enabled ? "Ligado" : "Desligado"}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.preferenceItem,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <View style={styles.preferenceTextWrap}>
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Novas versões do livro</Text>
              <Text style={[styles.preferenceHint, { color: theme.colors.textMuted }]}>
                Avisar quando houver publicação de nova versão.
              </Text>
            </View>
            <Pressable
              testID="account-pref-book-updates"
              accessibilityRole="switch"
              accessibilityLabel="Novas versões do livro"
              accessibilityState={{
                checked: Boolean(preferences?.book_version_updates_enabled),
                disabled: isPreferenceDisabled("book_version_updates_enabled"),
              }}
              style={[
                styles.preferenceToggle,
                preferences?.book_version_updates_enabled
                  ? { borderColor: theme.colors.success, backgroundColor: theme.isDark ? "#183829" : "#E7F5EC" }
                  : { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
                isPreferenceDisabled("book_version_updates_enabled") ? styles.disabledAction : null,
              ]}
              disabled={isPreferenceDisabled("book_version_updates_enabled")}
              onPress={() => void togglePreference("book_version_updates_enabled")}
            >
              <Text style={[styles.preferenceToggleText, { color: theme.colors.text }]}>
                {preferences?.book_version_updates_enabled ? "Ligado" : "Desligado"}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.preferenceItem,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <View style={styles.preferenceTextWrap}>
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Novos conteúdos</Text>
              <Text style={[styles.preferenceHint, { color: theme.colors.textMuted }]}>
                Avisar sobre novos conteúdos de curso e jurisprudência.
              </Text>
            </View>
            <Pressable
              testID="account-pref-new-content"
              accessibilityRole="switch"
              accessibilityLabel="Novos conteúdos"
              accessibilityState={{
                checked: Boolean(preferences?.new_content_updates_enabled),
                disabled: isPreferenceDisabled("new_content_updates_enabled"),
              }}
              style={[
                styles.preferenceToggle,
                preferences?.new_content_updates_enabled
                  ? { borderColor: theme.colors.success, backgroundColor: theme.isDark ? "#183829" : "#E7F5EC" }
                  : { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
                isPreferenceDisabled("new_content_updates_enabled") ? styles.disabledAction : null,
              ]}
              disabled={isPreferenceDisabled("new_content_updates_enabled")}
              onPress={() => void togglePreference("new_content_updates_enabled")}
            >
              <Text style={[styles.preferenceToggleText, { color: theme.colors.text }]}>
                {preferences?.new_content_updates_enabled ? "Ligado" : "Desligado"}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.preferenceItem,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <View style={styles.preferenceTextWrap}>
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Interações na comunidade</Text>
              <Text style={[styles.preferenceHint, { color: theme.colors.textMuted }]}>
                Avisar quando houver comentário novo em post seu.
              </Text>
            </View>
            <Pressable
              testID="account-pref-community-interactions"
              accessibilityRole="switch"
              accessibilityLabel="Interações na comunidade"
              accessibilityState={{
                checked: Boolean(preferences?.community_interaction_updates_enabled),
                disabled: isPreferenceDisabled("community_interaction_updates_enabled"),
              }}
              style={[
                styles.preferenceToggle,
                preferences?.community_interaction_updates_enabled
                  ? { borderColor: theme.colors.success, backgroundColor: theme.isDark ? "#183829" : "#E7F5EC" }
                  : { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
                isPreferenceDisabled("community_interaction_updates_enabled") ? styles.disabledAction : null,
              ]}
              disabled={isPreferenceDisabled("community_interaction_updates_enabled")}
              onPress={() => void togglePreference("community_interaction_updates_enabled")}
            >
              <Text style={[styles.preferenceToggleText, { color: theme.colors.text }]}>
                {preferences?.community_interaction_updates_enabled ? "Ligado" : "Desligado"}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.preferenceItem,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <View style={styles.preferenceTextWrap}>
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Push no dispositivo</Text>
              <Text style={[styles.preferenceHint, { color: theme.colors.textMuted }]}>
                Requer dispositivo físico e credenciais de entrega configuradas no projeto.
              </Text>
              {pushStatusMessage ? (
                <Text style={[styles.preferenceRuntimeHint, { color: theme.colors.accent }]}>{pushStatusMessage}</Text>
              ) : null}
            </View>
            <Pressable
              testID="account-pref-push"
              accessibilityRole="switch"
              accessibilityLabel="Push no dispositivo"
              accessibilityState={{
                checked: Boolean(preferences?.push_enabled),
                disabled: isPreferenceDisabled("push_enabled"),
              }}
              style={[
                styles.preferenceToggle,
                preferences?.push_enabled
                  ? { borderColor: theme.colors.success, backgroundColor: theme.isDark ? "#183829" : "#E7F5EC" }
                  : { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
                isPreferenceDisabled("push_enabled") ? styles.disabledAction : null,
              ]}
              disabled={isPreferenceDisabled("push_enabled")}
              onPress={() => void togglePreference("push_enabled")}
            >
              <Text style={[styles.preferenceToggleText, { color: theme.colors.text }]}>
                {preferences?.push_enabled ? "Ligado" : "Desligado"}
              </Text>
            </Pressable>
          </View>
        </View>

        {preferencesError ? <Text style={[styles.feedbackText, { color: theme.colors.danger }]}>{preferencesError}</Text> : null}
      </View>
    </View>
  );

  const renderPrivacyPanel = () => (
    <View style={styles.panelStack}>
      {renderPanelHeader("Privacidade (LGPD)", "Centralize consentimentos, documentos vigentes e métodos de acesso da sua conta.")}

      <View
        style={[
          styles.formCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Dados da conta</Text>
        <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
          Nome: {displayName}
        </Text>
        <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
          E-mail: {displayEmail}
        </Text>
        <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
          Profissão: {displayProfession}
        </Text>
        <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
          Métodos de acesso: {authMethodsLabel}
        </Text>
      </View>

      <View
        style={[
          styles.formCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Documentos vigentes</Text>
        {privacyLoading ? (
          <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>Carregando documentos e vínculos...</Text>
        ) : null}
        {legalDocuments.length ? (
          <View style={styles.actionsColumn}>
            {legalDocuments.map((document) => (
              <View
                key={document.id}
                style={[
                  styles.summaryBox,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
                  {formatLegalDocumentType(document.document_type)}
                </Text>
                {isEditorialLegalTitle(document) ? (
                  <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
                    {document.title}
                  </Text>
                ) : null}
                <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
                  Versão {document.version} · Vigente em {document.enforcement_starts_at ? formatDateTime(document.enforcement_starts_at) : "-"}
                </Text>
                <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
                  Status: {document.accepted ? `Aceito em ${formatDateTime(document.accepted_at)}` : "Pendente de aceite"}
                </Text>
                <LegalRichText contentHtml={document.content_html} />
              </View>
            ))}

            {hasPendingLegalDocuments ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleAcceptCurrentLegalDocuments()}
                style={[
                  styles.primaryAction,
                  { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
              >
                <Text style={[styles.primaryActionText, { color: theme.colors.textInverse }]}>Aceitar versões vigentes</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
            Nenhum documento legal vigente foi retornado pela API.
          </Text>
        )}
      </View>

      <View
        style={[
          styles.formCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Contas vinculadas</Text>
        {linkedAccounts.length ? (
          <View style={styles.actionsColumn}>
            {linkedAccounts.map((account) => {
              const isBusy = linkedAccountsBusyProvider === account.provider;
              const canConnect = account.enabled && !account.connected;
              const canDisconnect = account.connected;
              return (
                <View
                  key={account.provider}
                  style={[
                    styles.summaryBox,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                  ]}
                >
                  <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>{account.label}</Text>
                  <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
                    Status: {account.connected
                      ? `Vinculada${account.email ? ` ao e-mail ${account.email}` : ""}`
                      : account.enabled
                        ? "Pronta para vínculo"
                        : "Ainda não habilitada neste ambiente"}
                  </Text>
                  {account.connected && account.linked_at ? (
                    <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                      Vinculada em {formatDateTime(account.linked_at)}
                    </Text>
                  ) : null}
                  <View style={styles.actionsColumn}>
                    {canConnect ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => void handleStartLinkedAccount(account.provider)}
                        style={[
                          styles.secondaryAction,
                          { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
                          isBusy ? styles.disabledAction : null,
                        ]}
                      >
                        <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>
                          {isBusy ? "Redirecionando..." : `Vincular ${account.label}`}
                        </Text>
                      </Pressable>
                    ) : null}
                    {canDisconnect ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => void handleUnlinkAccount(account.provider)}
                        style={[
                          styles.secondaryAction,
                          { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
                          isBusy ? styles.disabledAction : null,
                        ]}
                      >
                        <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>
                          {isBusy ? "Processando..." : `Desvincular ${account.label}`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
            Nenhum provider social foi carregado para esta conta.
          </Text>
        )}

        {!profile?.has_usable_password ? (
          <View
            style={[
              styles.summaryBox,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Definir senha local</Text>
            <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
              Esta conta ainda depende de um login social. Defina uma senha antes de remover o último provider vinculado.
            </Text>
            <TextInput
              accessibilityLabel="Nova senha local"
              value={socialPasswordForm.newPassword}
              onChangeText={(value) => {
                setSocialPasswordError(null);
                setSocialPasswordForm((current) => ({ ...current, newPassword: value }));
              }}
              placeholder="Nova senha"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  borderColor: theme.colors.borderStrong,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                },
              ]}
            />
            <TextInput
              accessibilityLabel="Confirmar nova senha local"
              value={socialPasswordForm.confirmPassword}
              onChangeText={(value) => {
                setSocialPasswordError(null);
                setSocialPasswordForm((current) => ({ ...current, confirmPassword: value }));
              }}
              placeholder="Confirmar nova senha"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  borderColor: theme.colors.borderStrong,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                },
              ]}
            />
            {socialPasswordError ? (
              <Text style={[styles.feedbackText, { color: theme.colors.danger }]}>{socialPasswordError}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!canSubmitSetPassword}
              onPress={() => void handleSetPassword()}
              style={[
                styles.primaryAction,
                { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                !canSubmitSetPassword ? styles.disabledAction : null,
              ]}
            >
              <Text style={[styles.primaryActionText, { color: theme.colors.textInverse }]}>
                {socialPasswordBusy ? "Definindo senha..." : "Definir senha local"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.formCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Histórico de aceite</Text>
        {legalAcceptances.length ? (
          <View style={styles.actionsColumn}>
            {legalAcceptances.map((acceptance) => (
              <View
                key={acceptance.id}
                style={[
                  styles.summaryBox,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>{acceptance.document_title}</Text>
                <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
                  {formatLegalDocumentType(acceptance.document_type)} · versão {acceptance.document_version}
                </Text>
                <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                  Aceito em {formatDateTime(acceptance.accepted_at)} no fluxo {formatLegalAcceptanceSource(acceptance.source)} ({formatLegalPlatform(acceptance.app_platform)})
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
            Ainda não há aceites históricos registrados para esta conta.
          </Text>
        )}

        {privacyMessage ? <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>{privacyMessage}</Text> : null}
      </View>
    </View>
  );

  const renderExportPanel = () => (
    <View style={styles.panelStack}>
      {renderPanelHeader("Exportar dados", "Gere o pacote da sua conta e baixe/compartilhe o JSON exportado.")}

      <View
        style={[
          styles.formCard,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <View style={styles.actionsColumn}>
          <Pressable
            testID="account-data-export"
            accessibilityRole="button"
            accessibilityLabel="Exportar meus dados"
            style={[
              styles.primaryAction,
              { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
              exportingData ? styles.disabledAction : null,
            ]}
            disabled={exportingData}
            onPress={() => void handleExportData()}
          >
            <Text style={[styles.primaryActionText, { color: theme.colors.textInverse }]}>
              {exportingData ? "Gerando exportação..." : "Gerar exportação"}
            </Text>
          </Pressable>

          <Pressable
            testID="account-data-export-share"
            accessibilityRole="button"
            accessibilityLabel="Compartilhar JSON exportado"
            style={[
              styles.secondaryAction,
              { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted },
              !exportPayload ? styles.disabledAction : null,
            ]}
            disabled={!exportPayload}
            onPress={() => void handleShareExport()}
          >
            <Text style={[styles.secondaryActionText, { color: theme.colors.text }]}>Baixar / compartilhar JSON</Text>
          </Pressable>
        </View>

        {exportSummary ? (
          <View
            style={[
              styles.summaryBox,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Resumo da exportação</Text>
            <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
              Assinaturas: {exportSummary.subscriptions}
            </Text>
            <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
              Entitlements: {exportSummary.entitlements}
            </Text>
            <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
              Anotações: {exportSummary.annotations}
            </Text>
            <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
              Posts comunidade: {exportSummary.community_posts}
            </Text>
            <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
              Comentários comunidade: {exportSummary.community_comments}
            </Text>
            <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
              Reports comunidade: {exportSummary.community_reports}
            </Text>
            <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
              Gerado em: {formatDateTime(exportPayload?.generated_at)}
            </Text>
          </View>
        ) : null}

        {privacyMessage ? <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>{privacyMessage}</Text> : null}
      </View>
    </View>
  );

  const renderDeletePanel = () => (
    <View style={styles.panelStack}>
      {renderPanelHeader("Deletar conta", "A exclusão anonimiza a conta e faz logout automático ao concluir.")}

      <View
        style={[
          styles.formCard,
          {
            borderColor: theme.colors.danger,
            backgroundColor: theme.isDark ? "#25151A" : "#FFF7F6",
          },
        ]}
      >
        <Text style={[styles.sectionHeading, { color: theme.colors.danger }]}>Confirmação obrigatória</Text>
        <Text style={[styles.panelDescription, { color: theme.colors.textMuted }]}>
          Digite DELETE para confirmar. Os dados pessoais serão anonimizados e o app encerrará sua sessão.
        </Text>

        <TextInput
          testID="account-data-delete-confirmation"
          accessibilityLabel="Confirmação de exclusão"
          value={deleteConfirmation}
          onChangeText={setDeleteConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder='Digite "DELETE"'
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
            },
          ]}
        />
        <TextInput
          testID="account-data-delete-reason"
          accessibilityLabel="Motivo da exclusão"
          value={deleteReason}
          onChangeText={setDeleteReason}
          autoCapitalize="sentences"
          placeholder="Motivo (opcional)"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            styles.multilineInput,
            {
              borderColor: theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
            },
          ]}
          multiline
        />

        <Pressable
          testID="account-data-delete-submit"
          accessibilityRole="button"
          accessibilityLabel="Solicitar exclusão da conta"
          style={[
            styles.dangerAction,
            { borderColor: theme.colors.danger, backgroundColor: theme.colors.surface },
            !canSubmitErasure ? styles.disabledAction : null,
          ]}
          disabled={!canSubmitErasure}
          onPress={() => void handleRequestErasure()}
        >
          <Text style={[styles.dangerActionText, { color: theme.colors.danger }]}>
            {deletingData ? "Processando exclusão..." : "Solicitar exclusão e sair"}
          </Text>
        </Pressable>

        {privacyMessage ? <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>{privacyMessage}</Text> : null}
      </View>
    </View>
  );

  const renderActivePanel = () => {
    if (activePanel === "profile") return renderProfilePanel();
    if (activePanel === "password") return renderPasswordPanel();
    if (activePanel === "plan") return renderPlanPanel();
    if (activePanel === "notifications") return renderNotificationsPanel();
    if (activePanel === "privacy") return renderPrivacyPanel();
    if (activePanel === "export") return renderExportPanel();
    if (activePanel === "delete") return renderDeletePanel();
    return renderHomePanel();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={[styles.feedbackText, { color: theme.colors.textMuted }]}>Carregando dados da conta...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.feedbackText, { color: theme.colors.danger }]}>{error}</Text>
        ) : (
          renderActivePanel()
        )}
      </ScrollView>

      <Modal
        visible={Boolean(avatarCropper)}
        transparent
        animationType="fade"
        onRequestClose={handleCancelAvatarCrop}
      >
        <View style={[styles.cropperBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View
            style={[
              styles.cropperCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                ...theme.shadow.card,
              },
            ]}
            testID="account-avatar-cropper"
          >
            <Text style={[styles.cropperTitle, { color: theme.colors.text }]}>Ajustar foto</Text>
            <Text style={[styles.cropperSubtitle, { color: theme.colors.textMuted }]}>
              Arraste para enquadrar e use o zoom para aproximar o rosto.
            </Text>

            <View
              style={[
                styles.cropperViewport,
                {
                  width: avatarCropViewportSize,
                  height: avatarCropViewportSize,
                  borderColor: theme.colors.borderStrong,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
              {...avatarCropPanResponder.panHandlers}
            >
              {avatarCropper && avatarCropMetrics ? (
                <Image
                  source={{ uri: avatarCropper.asset.uri }}
                  style={[
                    styles.cropperImage,
                    {
                      width: avatarCropMetrics.displayWidth,
                      height: avatarCropMetrics.displayHeight,
                      left: (avatarCropViewportSize - avatarCropMetrics.displayWidth) / 2,
                      top: (avatarCropViewportSize - avatarCropMetrics.displayHeight) / 2,
                      transform: [
                        { translateX: avatarCropper.draft.offsetX },
                        { translateY: avatarCropper.draft.offsetY },
                      ],
                    },
                  ]}
                  resizeMode="stretch"
                />
              ) : null}
              <View pointerEvents="none" style={[styles.cropperOverlayRing, { borderColor: theme.colors.accent }]} />
            </View>

            <View style={styles.cropperToolbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Diminuir zoom da foto"
                testID="account-avatar-crop-zoom-out"
                onPress={() => handleCropZoom(-0.15)}
                style={[styles.cropperZoomAction, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
                disabled={!avatarCropper}
              >
                <MaterialCommunityIcons name="minus" size={18} color={theme.colors.text} />
              </Pressable>
              <Text style={[styles.cropperZoomText, { color: theme.colors.textMuted }]}>
                {avatarCropper ? `${Math.round(avatarCropper.draft.zoom * 100)}%` : "100%"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Aumentar zoom da foto"
                testID="account-avatar-crop-zoom-in"
                onPress={() => handleCropZoom(0.15)}
                style={[styles.cropperZoomAction, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
                disabled={!avatarCropper}
              >
                <MaterialCommunityIcons name="plus" size={18} color={theme.colors.text} />
              </Pressable>
            </View>

            <View style={styles.cropperActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar ajuste da foto"
                onPress={handleCancelAvatarCrop}
                style={[styles.cropperSecondaryAction, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
              >
                <Text style={[styles.cropperSecondaryActionText, { color: theme.colors.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Usar foto recortada"
                testID="account-avatar-crop-confirm"
                onPress={handleConfirmAvatarCrop}
                style={[styles.cropperPrimaryAction, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }]}
              >
                <Text style={[styles.cropperPrimaryActionText, { color: theme.colors.textInverse }]}>Usar foto</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  center: { paddingVertical: 24, alignItems: "center", gap: 8 },

  panelStack: { marginTop: 16, gap: 12 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  profileAvatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileAvatarImage: { width: "100%", height: "100%" },
  profileAvatarCroppedImage: { position: "absolute" },
  profileAvatarText: { fontSize: 24, fontWeight: "800" },
  heroCopy: { flex: 1, gap: 4 },
  heroName: { fontSize: 28, fontWeight: "800", fontFamily: "Georgia" },
  heroMeta: { fontSize: 14, fontWeight: "500" },
  heroPlanBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  heroPlanText: { fontSize: 12, fontWeight: "800" },

  panelSectionLabel: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },
  menuGroup: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  menuRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  menuRowLead: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCopy: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 17, fontWeight: "800" },
  menuSubtitle: { fontSize: 13, lineHeight: 19 },
  menuDivider: { height: 1, marginLeft: 66 },

  cropperBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  cropperCard: { width: "100%", maxWidth: 420, borderWidth: 1, borderRadius: 22, padding: 18, gap: 14 },
  cropperTitle: { fontSize: 24, fontWeight: "800", fontFamily: "Georgia" },
  cropperSubtitle: { fontSize: 14, lineHeight: 22 },
  cropperViewport: {
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  cropperImage: { position: "absolute" },
  cropperOverlayRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderRadius: 24,
  },
  cropperToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
  cropperZoomAction: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cropperZoomText: { fontSize: 14, fontWeight: "700", minWidth: 64, textAlign: "center" },
  cropperActions: { flexDirection: "row", gap: 10 },
  cropperSecondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cropperSecondaryActionText: { fontSize: 15, fontWeight: "700" },
  cropperPrimaryAction: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cropperPrimaryActionText: { fontSize: 15, fontWeight: "800" },

  sectionBackAction: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  sectionBackText: { fontSize: 14, fontWeight: "500" },
  panelIntroCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 6 },
  panelTitle: { fontSize: 24, fontWeight: "800", fontFamily: "Georgia" },
  panelDescription: { fontSize: 14, lineHeight: 22 },
  sectionHeading: { fontSize: 16, fontWeight: "800" },

  formCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  profileEditorHeader: { flexDirection: "row", gap: 14, alignItems: "center" },
  profileEditorCopy: { flex: 1, gap: 4 },
  profilePreviewName: { fontSize: 18, fontWeight: "800" },
  profilePreviewMeta: { fontSize: 13, fontWeight: "500" },
  fieldGroup: { gap: 6 },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fieldLabel: { fontSize: 13, fontWeight: "800" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  helperText: { fontSize: 12, lineHeight: 18 },
  feedbackText: { fontSize: 13, lineHeight: 20 },

  primaryAction: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  primaryActionText: { fontSize: 14, fontWeight: "800" },
  secondaryAction: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  secondaryActionText: { fontSize: 14, fontWeight: "700" },
  dangerAction: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  dangerActionText: { fontSize: 14, fontWeight: "800" },
  disabledAction: { opacity: 0.55 },

  planHeadline: { fontSize: 22, fontWeight: "800", fontFamily: "Georgia" },
  planStatusCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 6 },
  planStatusEyebrow: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  planCardsGrid: { gap: 12 },
  planCardsGridDesktop: { flexDirection: "row", alignItems: "stretch" },
  planCatalogCard: { flex: 1, borderWidth: 1, borderRadius: 22, padding: 18, gap: 14 },
  planCatalogHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  planCatalogCopy: { flex: 1, gap: 4 },
  planOptionTitle: { fontSize: 18, fontWeight: "800", fontFamily: "Georgia" },
  planOptionBody: { fontSize: 14, lineHeight: 22 },
  planCurrentBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  planCurrentBadgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  planPriceRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  planPriceValue: { fontSize: 34, fontWeight: "900" },
  planPricePeriod: { fontSize: 15, fontWeight: "600", paddingBottom: 4 },
  planFeatureList: { gap: 8 },
  planFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planFeatureText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  planFootnote: { fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 8 },

  preferenceRows: { gap: 10 },
  preferenceItem: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  preferenceTextWrap: { flex: 1, gap: 4 },
  preferenceLabel: { fontSize: 14, fontWeight: "800" },
  preferenceHint: { fontSize: 12, lineHeight: 18 },
  preferenceRuntimeHint: { fontSize: 12, fontWeight: "700" },
  preferenceToggle: {
    minWidth: 88,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  preferenceToggleText: { fontSize: 12, fontWeight: "800" },

  actionsColumn: { gap: 10 },
  summaryBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
});
