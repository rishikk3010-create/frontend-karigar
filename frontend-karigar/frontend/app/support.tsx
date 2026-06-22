import React from "react";
import { View, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPACING, RADIUS } from "@/src/theme";
import { AppText, ScreenHeader, Card } from "@/src/components/ui";
import { SUPPORT_PHONE, SUPPORT_WHATSAPP, SUPPORT_EMAIL } from "@/src/constants/app";

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t("support")} onBack={() => router.back()} />
      <View style={{ padding: SPACING.lg }}>
        <View style={styles.iconWrap}>
          <Ionicons name="headset" size={40} color={COLORS.brandPrimary} />
        </View>
        <AppText size="base" color={COLORS.muted} style={{ textAlign: "center", marginVertical: SPACING.lg }}>
          {t("supportDesc")}
        </AppText>

        <Card style={styles.option} testID="call-support-btn">
          <ActionRow
            icon="call"
            tint={COLORS.brandPrimary}
            title={t("callSupport")}
            sub={SUPPORT_PHONE}
            onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}
          />
        </Card>
        <View style={{ height: SPACING.md }} />
        <Card style={styles.option} testID="whatsapp-support-btn">
          <ActionRow
            icon="logo-whatsapp"
            tint={COLORS.success}
            title={t("whatsappSupport")}
            sub="Chat with us"
            onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`)}
          />
        </Card>
        <View style={{ height: SPACING.md }} />
        <Card style={styles.option} testID="email-support-btn">
          <ActionRow
            icon="mail"
            tint={COLORS.brandSecondary}
            title={t("emailSupport")}
            sub={SUPPORT_EMAIL}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
        </Card>
      </View>
    </View>
  );
}

function ActionRow({ icon, tint, title, sub, onPress }: any) {
  return (
    <View style={styles.row} onTouchEnd={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: tint + "1A" }]}>
        <Ionicons name={icon} size={24} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText weight="semibold" size="lg">{title}</AppText>
        <AppText size="sm" color={COLORS.muted}>{sub}</AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: SPACING.lg,
  },
  option: { padding: SPACING.md },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  rowIcon: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
});
