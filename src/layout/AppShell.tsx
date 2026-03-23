import React from "react";
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMeProfile, getMyEntitlements, type SubscriptionStatus, type SubscriptionTier } from "../api/entitlements";
import {
  AppRoute,
  DESKTOP_NAV_ITEMS,
  MOBILE_TAB_ITEMS,
  type NavIconName,
  ROUTE_TITLES,
} from "../navigation/routes";
import { useAppTheme } from "../theme/ThemeProvider";
import { sanitizeAvatarUrl } from "../utils/communityUi";

type Props = {
  token: string;
  route: AppRoute;
  children: React.ReactNode;
  onNavigate: (route: AppRoute) => void;
  onOpenSearch: () => void;
  onOpenAccount: () => void;
  onLogout: () => void | Promise<void>;
  accountRefreshSignal?: number;
};

type AccountQuickSummary = {
  name: string;
  email: string;
  profession: string;
  avatarUrl: string | null;
  planLabel: string;
  planStatus: string;
};

function isRouteActive(current: AppRoute, target: AppRoute) {
  if (current === target) return true;
  if (target === "community") {
    return current === "communityPost" || current === "communityNewPost";
  }
  return false;
}

type AppShellIconName = NavIconName | "magnify" | "weather-sunny" | "moon-waning-crescent" | "logout-variant";

function formatTier(tier: SubscriptionTier | null | undefined) {
  if (!tier) return "Sem assinatura";
  if (tier === "professional") return "Profissional";
  return "Essencial";
}

function formatStatus(status: SubscriptionStatus | null | undefined) {
  if (!status) return "-";
  if (status === "active") return "Ativa";
  if (status === "canceled") return "Cancelada";
  return "Inativa";
}

function getInitials(name: string) {
  const cleanName = (name || "").trim();
  if (!cleanName) return "LV";
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function ShellIcon({
  name,
  color,
  size,
}: {
  name: AppShellIconName;
  color: string;
  size: number;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export function AppShell({
  token,
  route,
  children,
  onNavigate,
  onOpenSearch,
  onOpenAccount,
  onLogout,
  accountRefreshSignal = 0,
}: Props) {
  const { theme, toggleMode } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;
  const useCompactMobileLabels = width < 390;
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [accountSummary, setAccountSummary] = React.useState<AccountQuickSummary | null>(null);
  const [accountSummaryLoading, setAccountSummaryLoading] = React.useState(false);
  const [accountSummaryError, setAccountSummaryError] = React.useState<string | null>(null);

  const closeAccountMenu = React.useCallback(() => {
    setAccountMenuOpen(false);
  }, []);

  const openAccountMenu = React.useCallback(() => {
    setAccountMenuOpen(true);
  }, []);

  const openAccountFromMenu = React.useCallback(() => {
    closeAccountMenu();
    onOpenAccount();
  }, [closeAccountMenu, onOpenAccount]);

  const openSearchFromMenu = React.useCallback(() => {
    closeAccountMenu();
    onOpenSearch();
  }, [closeAccountMenu, onOpenSearch]);

  const toggleModeFromMenu = React.useCallback(() => {
    closeAccountMenu();
    toggleMode();
  }, [closeAccountMenu, toggleMode]);

  React.useEffect(() => {
    setAccountMenuOpen(false);
  }, [route]);

  const loadAccountSummary = React.useCallback(async (aliveRef?: { current: boolean }) => {
    try {
      setAccountSummaryLoading(true);
      setAccountSummaryError(null);
      const [profile, entitlements] = await Promise.all([getMeProfile(token), getMyEntitlements(token)]);
      if (aliveRef && !aliveRef.current) return;

      setAccountSummary({
        name: profile?.name?.trim() || "Conta Livro Vivo",
        email: profile?.email?.trim() || "-",
        profession: profile?.profession?.trim() || "Profissão não informada",
        avatarUrl: sanitizeAvatarUrl(profile?.avatar_url),
        planLabel: formatTier(entitlements?.effective_tier),
        planStatus: formatStatus(entitlements?.subscription?.status),
      });
    } catch {
      if (aliveRef && !aliveRef.current) return;
      setAccountSummaryError("Não foi possível carregar o resumo da conta.");
    } finally {
      if (aliveRef && !aliveRef.current) return;
      setAccountSummaryLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    const aliveRef = { current: true };
    void loadAccountSummary(aliveRef);
    return () => {
      aliveRef.current = false;
    };
  }, [loadAccountSummary, accountRefreshSignal]);

  React.useEffect(() => {
    if (!accountMenuOpen) return;
    const aliveRef = { current: true };
    void loadAccountSummary(aliveRef);
    return () => {
      aliveRef.current = false;
    };
  }, [accountMenuOpen, loadAccountSummary]);

  const accountDisplayName = accountSummary?.name || "Minha conta";
  const accountDisplayEmail = accountSummary?.email || "-";
  const accountDisplayProfession = accountSummary?.profession || "Profissão não informada";
  const accountDisplayAvatarUrl = sanitizeAvatarUrl(accountSummary?.avatarUrl);
  const accountDisplayPlan = accountSummary
    ? `${accountSummary.planLabel} • ${accountSummary.planStatus}`
    : "Plano indisponível";
  const accountInitials = getInitials(accountDisplayName);

  const accountButtonStyle = [
    styles.headerAccountButton,
    {
      borderColor: route === "account" ? theme.colors.accent : theme.colors.sidebarBorder,
      backgroundColor: route === "account" ? theme.colors.sidebarActiveBg : theme.colors.topBarBg,
    },
  ];

  const accountMenu = (
    <Modal visible={accountMenuOpen} transparent animationType="fade" onRequestClose={closeAccountMenu}>
      <View style={styles.accountMenuOverlay}>
        <Pressable
          style={styles.accountMenuBackdrop}
          onPress={closeAccountMenu}
          accessibilityRole="button"
          accessibilityLabel="Fechar menu da conta"
        />
        <View
          style={[
            styles.accountMenuCard,
            isDesktopWeb
              ? styles.accountMenuCardDesktop
              : [styles.accountMenuCardMobile, { marginTop: 68 + insets.top }],
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.accountIdentityRow}>
            <View style={[styles.accountAvatar, { backgroundColor: theme.colors.topBarBg }]}>
              {accountDisplayAvatarUrl ? (
                <Image source={{ uri: accountDisplayAvatarUrl }} style={styles.accountAvatarImage} resizeMode="cover" />
              ) : (
                <Text style={[styles.accountAvatarText, { color: theme.colors.sidebarText }]}>{accountInitials}</Text>
              )}
            </View>
            <View style={styles.accountIdentityMeta}>
              <Text style={[styles.accountName, { color: theme.colors.text }]} numberOfLines={1}>
                {accountDisplayName}
              </Text>
              <Text style={[styles.accountMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {accountDisplayEmail}
              </Text>
              <Text style={[styles.accountMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {accountDisplayProfession}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.accountPlanTag,
              { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong },
            ]}
          >
            <Text style={[styles.accountPlanTagText, { color: theme.colors.accent }]}>{accountDisplayPlan}</Text>
          </View>

          {accountSummaryLoading ? (
            <Text style={[styles.accountMeta, { color: theme.colors.textMuted }]}>Carregando resumo da conta…</Text>
          ) : null}
          {accountSummaryError ? (
            <Text style={[styles.accountError, { color: theme.colors.danger }]}>{accountSummaryError}</Text>
          ) : null}

          <Pressable
            style={[
              styles.accountMenuAction,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
            onPress={openAccountFromMenu}
            accessibilityRole="button"
            accessibilityLabel="Abrir tela Minha Conta"
          >
            <ShellIcon name="account-circle-outline" size={18} color={theme.colors.text} />
            <Text style={[styles.accountMenuActionText, { color: theme.colors.text }]}>Minha conta</Text>
          </Pressable>

          <Pressable
            style={[
              styles.accountMenuAction,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
            onPress={openSearchFromMenu}
            accessibilityRole="button"
            accessibilityLabel="Abrir tela Busca Global"
          >
            <ShellIcon name="magnify" size={18} color={theme.colors.text} />
            <Text style={[styles.accountMenuActionText, { color: theme.colors.text }]}>Busca global</Text>
          </Pressable>

          <Pressable
            style={[
              styles.accountMenuAction,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
            ]}
            onPress={toggleModeFromMenu}
            accessibilityRole="button"
            accessibilityLabel={theme.isDark ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            <ShellIcon
              name={theme.isDark ? "weather-sunny" : "moon-waning-crescent"}
              size={18}
              color={theme.colors.text}
            />
            <Text style={[styles.accountMenuActionText, { color: theme.colors.text }]}>
              {theme.isDark ? "Modo claro" : "Modo escuro"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  if (isDesktopWeb) {
    return (
      <View style={[styles.desktopRoot, { backgroundColor: theme.colors.bg }]}>
        <View
          style={[
            styles.desktopSidebar,
            {
              backgroundColor: theme.colors.sidebarBg,
              borderRightColor: theme.colors.sidebarBorder,
            },
          ]}
        >
          <View style={styles.brandBlock}>
            <Text style={[styles.brandTitle, { color: theme.colors.sidebarText }]}>Livro Vivo</Text>
            <Text style={[styles.brandSubtitle, { color: theme.colors.sidebarTextMuted }]}>Direito do Consumidor</Text>
          </View>

          <View style={styles.desktopNav}>
            {DESKTOP_NAV_ITEMS.map((item) => {
              const active = isRouteActive(route, item.route);
              const color = active ? theme.colors.sidebarText : theme.colors.sidebarTextMuted;
              return (
                <Pressable
                  key={item.route}
                  onPress={() => onNavigate(item.route)}
                  style={[
                    styles.desktopNavItem,
                    active
                      ? { backgroundColor: theme.colors.sidebarActiveBg, borderColor: theme.colors.sidebarBorder }
                      : null,
                  ]}
                >
                  <View style={styles.desktopNavInner}>
                    <ShellIcon name={item.icon} size={20} color={color} />
                    <Text style={[styles.desktopNavText, { color }]}>{item.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.desktopFooter, { borderTopColor: theme.colors.sidebarBorder }]}>
            <Pressable style={styles.desktopFooterAction} onPress={onOpenSearch}>
              <ShellIcon name="magnify" size={20} color={theme.colors.sidebarText} />
              <Text style={[styles.desktopFooterText, { color: theme.colors.sidebarText }]}>Busca global</Text>
            </Pressable>
            <Pressable style={styles.desktopFooterAction} onPress={onOpenAccount}>
              <ShellIcon name="account-circle-outline" size={20} color={theme.colors.sidebarText} />
              <Text style={[styles.desktopFooterText, { color: theme.colors.sidebarText }]}>Minha conta</Text>
            </Pressable>
            <Pressable style={styles.desktopFooterAction} onPress={toggleMode}>
              <ShellIcon
                name={theme.isDark ? "weather-sunny" : "moon-waning-crescent"}
                size={20}
                color={theme.colors.sidebarText}
              />
              <Text style={[styles.desktopFooterText, { color: theme.colors.sidebarText }]}>
                {theme.isDark ? "Modo claro" : "Modo escuro"}
              </Text>
            </Pressable>
            <Pressable style={styles.desktopFooterAction} onPress={() => void Promise.resolve(onLogout())}>
              <ShellIcon name="logout-variant" size={20} color={theme.colors.danger} />
              <Text style={[styles.desktopFooterText, { color: theme.colors.danger }]}>Sair</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.desktopContent}>
          <View
            style={[
              styles.desktopHeader,
              {
                backgroundColor: theme.colors.topBarBg,
                borderBottomColor: theme.colors.sidebarBorder,
              },
            ]}
          >
            <Text style={[styles.desktopHeaderTitle, { color: theme.colors.sidebarText }]}>{ROUTE_TITLES[route]}</Text>
            <Pressable
              testID="shell-desktop-account"
              style={accountButtonStyle}
              onPress={openAccountMenu}
              accessibilityRole="button"
              accessibilityLabel="Abrir menu da conta"
            >
              {accountDisplayAvatarUrl ? (
                <Image source={{ uri: accountDisplayAvatarUrl }} style={styles.headerAvatarImage} resizeMode="cover" />
              ) : (
                <Text style={[styles.headerAvatarText, { color: theme.colors.sidebarText }]}>{accountInitials}</Text>
              )}
            </Pressable>
          </View>
          <View style={styles.contentWrap}>{children}</View>
        </View>

        {accountMenu}
      </View>
    );
  }

  return (
    <View style={[styles.mobileRoot, { backgroundColor: theme.colors.bg }]}>
      <View
        style={[
          styles.mobileTopBar,
          {
            backgroundColor: theme.colors.topBarBg,
            borderBottomColor: theme.colors.sidebarBorder,
            paddingTop: 8 + insets.top,
            minHeight: 62 + insets.top,
          },
        ]}
      >
        <View style={styles.mobileTopBarLeading}>
          {route !== "main" ? (
            <Pressable
              testID="shell-mobile-home"
              style={[
                styles.headerHomeButton,
                {
                  borderColor: theme.colors.sidebarBorder,
                  backgroundColor: theme.colors.topBarBg,
                },
              ]}
              onPress={() => onNavigate("main")}
              accessibilityRole="button"
              accessibilityLabel="Voltar para inicio"
            >
              <ShellIcon name="home-outline" size={18} color={theme.colors.sidebarText} />
            </Pressable>
          ) : null}
          <Text style={[styles.mobileTitle, { color: theme.colors.sidebarText }]}>{ROUTE_TITLES[route]}</Text>
        </View>
        <View style={styles.mobileActions}>
          <Pressable
            testID="shell-mobile-account"
            style={accountButtonStyle}
            onPress={openAccountMenu}
            accessibilityRole="button"
            accessibilityLabel="Abrir menu da conta"
          >
            {accountDisplayAvatarUrl ? (
              <Image source={{ uri: accountDisplayAvatarUrl }} style={styles.headerAvatarImage} resizeMode="cover" />
            ) : (
              <Text style={[styles.headerAvatarText, { color: theme.colors.sidebarText }]}>{accountInitials}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.contentWrap}>{children}</View>

      <View
        style={[
          styles.mobileBottomBar,
          {
            backgroundColor: theme.colors.bottomBarBg,
            borderTopColor: theme.colors.border,
            paddingBottom: Math.max(10, insets.bottom + 8),
          },
        ]}
      >
        {MOBILE_TAB_ITEMS.map((item) => {
          const active = isRouteActive(route, item.route);
          const tabLabel = useCompactMobileLabels ? (item.shortLabel || item.label) : item.label;
          return (
            <Pressable
              key={item.route}
              testID={`shell-tab-${item.route}`}
              onPress={() => onNavigate(item.route)}
              style={styles.mobileTab}
            >
              <ShellIcon name={item.icon} size={20} color={active ? theme.colors.accent : theme.colors.textMuted} />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                style={[styles.mobileTabLabel, { color: active ? theme.colors.accent : theme.colors.textMuted }]}
              >
                {tabLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {accountMenu}
    </View>
  );
}

const styles = StyleSheet.create({
  desktopRoot: {
    flex: 1,
    flexDirection: "row",
  },
  desktopSidebar: {
    width: 250,
    borderRightWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  brandBlock: { marginBottom: 18, gap: 4 },
  brandTitle: {
    fontFamily: "Georgia",
    fontSize: 27,
    fontWeight: "700",
  },
  brandSubtitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  desktopNav: { gap: 6 },
  desktopNavItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  desktopNavInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  desktopNavText: { fontSize: 15, fontWeight: "700" },
  desktopFooter: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 2,
  },
  desktopFooterAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  desktopFooterText: { fontSize: 14, fontWeight: "600" },
  desktopContent: { flex: 1 },
  desktopHeader: {
    minHeight: 70,
    borderBottomWidth: 1,
    justifyContent: "space-between",
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 22,
    gap: 12,
  },
  desktopHeaderTitle: {
    fontSize: 25,
    fontFamily: "Georgia",
    fontWeight: "700",
  },
  contentWrap: { flex: 1 },
  mobileRoot: { flex: 1 },
  mobileTopBar: {
    minHeight: 62,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  mobileTopBarLeading: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  mobileTitle: {
    fontFamily: "Georgia",
    fontSize: 21,
    fontWeight: "700",
    flexShrink: 1,
  },
  mobileActions: { flexDirection: "row", gap: 8 },
  headerHomeButton: {
    borderWidth: 1,
    borderRadius: 999,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerAccountButton: {
    borderWidth: 1,
    borderRadius: 999,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  headerAvatarImage: { width: "100%", height: "100%" },
  headerAvatarText: { fontSize: 12, fontWeight: "800" },
  accountMenuOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  accountMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  accountMenuCard: {
    width: 304,
    maxWidth: "92%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  accountMenuCardDesktop: {
    marginTop: 78,
    marginRight: 20,
  },
  accountMenuCardMobile: {
    marginTop: 68,
    marginRight: 10,
  },
  accountIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  accountAvatarImage: { width: "100%", height: "100%" },
  accountAvatarText: {
    fontSize: 14,
    fontWeight: "800",
  },
  accountIdentityMeta: {
    flex: 1,
    gap: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: "800",
  },
  accountMeta: {
    fontSize: 12,
    fontWeight: "500",
  },
  accountPlanTag: {
    borderWidth: 1,
    borderRadius: 999,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  accountPlanTagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  accountError: {
    fontSize: 12,
    fontWeight: "600",
  },
  accountMenuAction: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountMenuActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  mobileBottomBar: {
    minHeight: 72,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  mobileTab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mobileTabLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },
});
