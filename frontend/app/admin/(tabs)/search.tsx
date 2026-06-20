import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput, Platform, Share } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import { COLORS, SPACING, RADIUS, FONT, shadow } from "@/src/theme";
import { AppText, Avatar, Chip, EmptyState, Loader, Button } from "@/src/components/ui";
import { apiFetch, getToken, BASE } from "@/src/api/client";
import { Worker, availabilityColor, verificationColor } from "@/src/utils/profile";
import { AVAILABILITY_OPTIONS } from "@/src/constants/app";
import { ALL_SKILLS } from "@/src/constants/skills";
import { useToast } from "@/src/components/Toast";

const VERIF_OPTIONS = [
  { value: "all", key: "all" },
  { value: "pending", key: "pending" },
  { value: "approved", key: "verified" },
  { value: "rejected", key: "rejected" },
];

export default function WorkerSearch() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);

  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [verification, setVerification] = useState("all");
  const [city, setCity] = useState("");
  const [items, setItems] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const snapPoints = useMemo(() => ["65%"], []);

  const buildQuery = useCallback(
    (overrides?: Partial<{ skill: string; availability: string; verification: string; city: string; search: string }>) => {
      const s = { skill, availability, verification, city, search, ...overrides };
      const p = new URLSearchParams();
      if (s.search) p.set("search", s.search);
      if (s.skill && s.skill !== "all") p.set("skill", s.skill);
      if (s.availability && s.availability !== "all") p.set("availability", s.availability);
      if (s.verification && s.verification !== "all") p.set("verification", s.verification);
      if (s.city) p.set("city", s.city);
      return p.toString();
    },
    [skill, availability, verification, city, search]
  );

  const load = useCallback(
    async (overrides?: any) => {
      setLoading(true);
      try {
        const q = buildQuery(overrides);
        const res = await apiFetch<{ items: Worker[]; total: number }>(`/admin/workers?${q}`);
        setItems(res.items);
        setTotal(res.total);
      } catch (e: any) {
        show(e.message || t("genericError"), "error");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onExport = async () => {
    try {
      const token = await getToken();
      const q = buildQuery();
      const res = await fetch(`${BASE}/admin/export?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      const csv = await res.text();
      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "workers.csv";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: csv });
      }
      show(`Exported ${total} workers`, "success");
    } catch (e: any) {
      show(e.message || t("genericError"), "error");
    }
  };

  const clearFilters = () => {
    setSkill("all");
    setAvailability("all");
    setVerification("all");
    setCity("");
    load({ skill: "all", availability: "all", verification: "all", city: "" });
    sheetRef.current?.close();
  };

  const applyFilters = () => {
    load();
    sheetRef.current?.close();
  };

  const activeFilterCount =
    (availability !== "all" ? 1 : 0) + (verification !== "all" ? 1 : 0) + (city ? 1 : 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AppText weight="bold" size="2xl">{t("workerSearch")}</AppText>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={COLORS.muted} />
            <TextInput
              testID="worker-search-input"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => load()}
              placeholder={t("searchPlaceholder")}
              placeholderTextColor={COLORS.muted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => { setSearch(""); load({ search: "" }); }}>
                <Ionicons name="close-circle" size={18} color={COLORS.muted} />
              </Pressable>
            )}
          </View>
          <Pressable style={styles.filterBtn} onPress={() => sheetRef.current?.expand()} testID="open-filters-btn">
            <Ionicons name="options" size={20} color={COLORS.onBrandPrimary} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <AppText size="sm" color="#fff" weight="bold" style={{ fontSize: 10 }}>{activeFilterCount}</AppText>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Skill quick-filter chip row */}
      <View style={styles.chipRowWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["all", ...ALL_SKILLS]}
          keyExtractor={(s) => s}
          contentContainerStyle={{ gap: SPACING.sm, paddingHorizontal: SPACING.lg }}
          renderItem={({ item }) => (
            <Chip
              label={item === "all" ? t("all") : item}
              selected={skill === item}
              onPress={() => { setSkill(item); load({ skill: item }); }}
              testID={`skill-filter-${item}`}
            />
          )}
        />
      </View>

      <View style={styles.resultsBar}>
        <AppText size="sm" color={COLORS.muted}>{t("resultsCount", { count: total })}</AppText>
        <Pressable onPress={onExport} style={styles.exportBtn} testID="export-csv-btn">
          <Ionicons name="download-outline" size={16} color={COLORS.brandPrimary} />
          <AppText size="sm" color={COLORS.brandPrimary} weight="semibold">{t("exportCsv")}</AppText>
        </Pressable>
      </View>

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(w) => w.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.sm, paddingBottom: SPACING["2xl"] }}
          ListEmptyComponent={<EmptyState image="https://images.unsplash.com/photo-1521401415461-83e7162b8e64?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjBhcnRpc2FuJTIwZW1icm9pZGVyeSUyMHRhaWxvcmluZyUyMHdvcmtlcnxlbnwwfHx8fDE3ODEyNTk4MTd8MA&ixlib=rb-4.1.0&q=85" title={t("noWorkers")} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/admin/worker/${item.id}`)} style={[styles.workerCard, shadow]} testID={`worker-card-${item.id}`}>
              <Avatar name={item.full_name} size={48} />
              <View style={{ flex: 1 }}>
                <AppText weight="bold" size="base" numberOfLines={1}>{item.full_name}</AppText>
                <AppText size="sm" color={COLORS.muted} numberOfLines={1}>
                  {item.skills[0]} · {item.years_experience} {t("yearsShort")} · {item.city}
                </AppText>
                <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: 6 }}>
                  <View style={[styles.miniDot, { backgroundColor: availabilityColor(item.availability_status) }]} />
                  <View style={[styles.miniDot, { backgroundColor: verificationColor(item.verification_status) }]} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
            </Pressable>
          )}
        />
      )}

      <BottomSheet ref={sheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose backgroundStyle={{ backgroundColor: COLORS.surfaceSecondary }}>
        <BottomSheetScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}>
          <AppText weight="bold" size="xl" style={{ marginBottom: SPACING.lg }}>{t("filters")}</AppText>

          <AppText weight="semibold" style={{ marginBottom: SPACING.sm }}>{t("filterAvailability")}</AppText>
          <View style={styles.wrap}>
            <Chip label={t("all")} selected={availability === "all"} onPress={() => setAvailability("all")} />
            {AVAILABILITY_OPTIONS.map((o) => (
              <Chip key={o.value} label={t(o.key)} selected={availability === o.value} onPress={() => setAvailability(o.value)} />
            ))}
          </View>

          <AppText weight="semibold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>{t("filterVerification")}</AppText>
          <View style={styles.wrap}>
            {VERIF_OPTIONS.map((o) => (
              <Chip key={o.value} label={t(o.key)} selected={verification === o.value} onPress={() => setVerification(o.value)} />
            ))}
          </View>

          <AppText weight="semibold" style={{ marginTop: SPACING.lg, marginBottom: SPACING.sm }}>{t("filterCity")}</AppText>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Hyderabad"
            placeholderTextColor={COLORS.muted}
            style={styles.sheetInput}
          />

          <View style={{ flexDirection: "row", gap: SPACING.md, marginTop: SPACING.xl }}>
            <View style={{ flex: 1 }}>
              <Button title={t("clearFilters")} variant="secondary" onPress={clearFilters} testID="clear-filters-btn" />
            </View>
            <View style={{ flex: 2 }}>
              <Button title={t("applyFilters")} onPress={applyFilters} testID="apply-filters-btn" />
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  searchRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: FONT.base, color: COLORS.onSurface },
  filterBtn: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: "center", justifyContent: "center" },
  filterBadge: { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  chipRowWrap: { height: 56, justifyContent: "center", marginTop: SPACING.sm },
  resultsBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  workerCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.md },
  miniDot: { width: 10, height: 10, borderRadius: 5 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  sheetInput: { height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: FONT.base, color: COLORS.onSurface, backgroundColor: COLORS.surface },
});
