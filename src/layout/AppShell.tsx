import React from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  AppRoute,
  DESKTOP_NAV_ITEMS,
  MOBILE_TAB_ITEMS,
  type NavIconName,
  ROUTE_TITLES,
} from "../navigation/routes";
import { useAppTheme } from "../theme/ThemeProvider";

type Props = {
  route: AppRoute;
  children: React.ReactNode;
  onNavigate: (route: AppRoute) => void;
  onOpenSearch: () => void;
  onOpenAccount: () => void;
  onLogout: () => void | Promise<void>;
};

function isRouteActive(current: AppRoute, target: AppRoute) {
  if (current === target) return true;
  if (target === "community") {
    return current === "communityPost" || current === "communityNewPost";
  }
  return false;
}

type AppShellIconName = NavIconName | "magnify" | "weather-sunny" | "moon-waning-crescent" | "logout-variant";

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
  route,
  children,
  onNavigate,
  onOpenSearch,
  onOpenAccount,
  onLogout,
}: Props) {
  const { theme, toggleMode } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;

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
            <Text style={[styles.brandSubtitle, { color: theme.colors.sidebarTextMuted }]}>
              Direito do Consumidor
            </Text>
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
            <Text style={[styles.desktopHeaderTitle, { color: theme.colors.sidebarText }]}>
              {ROUTE_TITLES[route]}
            </Text>
          </View>
          <View style={styles.contentWrap}>{children}</View>
        </View>
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
          },
        ]}
      >
        <Text style={[styles.mobileTitle, { color: theme.colors.sidebarText }]}>{ROUTE_TITLES[route]}</Text>
        <View style={styles.mobileActions}>
          <Pressable
            testID="shell-mobile-search"
            style={[styles.mobileActionButton, { borderColor: theme.colors.sidebarBorder }]}
            onPress={onOpenSearch}
            accessibilityLabel="Abrir busca global"
          >
            <ShellIcon name="magnify" size={18} color={theme.colors.sidebarText} />
          </Pressable>
          <Pressable
            testID="shell-mobile-theme"
            style={[styles.mobileActionButton, { borderColor: theme.colors.sidebarBorder }]}
            onPress={toggleMode}
            accessibilityLabel={theme.isDark ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            <ShellIcon
              name={theme.isDark ? "weather-sunny" : "moon-waning-crescent"}
              size={18}
              color={theme.colors.sidebarText}
            />
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
          },
        ]}
      >
        {MOBILE_TAB_ITEMS.map((item) => {
          const active = isRouteActive(route, item.route);
          return (
            <Pressable
              key={item.route}
              testID={`shell-tab-${item.route}`}
              onPress={() => onNavigate(item.route)}
              style={styles.mobileTab}
            >
              <ShellIcon
                name={item.icon}
                size={20}
                color={active ? theme.colors.accent : theme.colors.textMuted}
              />
              <Text style={[styles.mobileTabLabel, { color: active ? theme.colors.accent : theme.colors.textMuted }]}>
                {item.shortLabel || item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
    justifyContent: "center",
    paddingHorizontal: 22,
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
  mobileTitle: {
    fontFamily: "Georgia",
    fontSize: 21,
    fontWeight: "700",
    flexShrink: 1,
  },
  mobileActions: { flexDirection: "row", gap: 8 },
  mobileActionButton: {
    borderWidth: 1,
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  mobileBottomBar: {
    minHeight: 72,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 10,
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  mobileTab: {
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mobileTabLabel: { fontSize: 12, fontWeight: "700" },
});
