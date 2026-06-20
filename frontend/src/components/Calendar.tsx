import React, { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/src/components/ui";
import { COLORS, SPACING, RADIUS } from "@/src/theme";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/**
 * Dependency-free month-grid calendar. Works on web + native.
 * `value` is an ISO date string (YYYY-MM-DD).
 * - mode="future" (default): past dates disabled (e.g. availability picker).
 * - mode="past": future dates disabled + fast year picker (e.g. date of birth).
 */
export function Calendar({
  value,
  onSelect,
  mode = "future",
  testID,
}: {
  value?: string | null;
  onSelect: (iso: string) => void;
  mode?: "future" | "past";
  testID?: string;
}) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isPastMode = mode === "past";
  // For DOB, default the visible month to ~22 years ago for less scrolling.
  const fallback = isPastMode
    ? new Date(today.getFullYear() - 22, today.getMonth(), 1)
    : today;
  const init = value ? new Date(value) : fallback;
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const [yearPicker, setYearPicker] = useState(false);

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const atMinMonth = view.y === today.getFullYear() && view.m === today.getMonth();
  const atMaxMonth = view.y === today.getFullYear() && view.m === today.getMonth();
  const prevDisabled = isPastMode ? view.y <= 1925 && view.m === 0 : atMinMonth;
  const nextDisabled = isPastMode ? atMaxMonth : false;

  const go = (delta: number) => {
    setView((p) => {
      const next = new Date(p.y, p.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  };

  const years: number[] = [];
  if (isPastMode) {
    for (let y = today.getFullYear(); y >= 1940; y--) years.push(y);
  } else {
    for (let y = today.getFullYear(); y <= today.getFullYear() + 5; y++) years.push(y);
  }

  const pickYear = (y: number) => {
    setView((p) => {
      let m = p.m;
      if (isPastMode && y === today.getFullYear() && m > today.getMonth()) m = today.getMonth();
      return { y, m };
    });
    setYearPicker(false);
  };

  return (
    <View testID={testID} style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          onPress={() => !prevDisabled && go(-1)}
          disabled={prevDisabled}
          style={[styles.nav, prevDisabled && { opacity: 0.3 }]}
          hitSlop={8}
          testID="cal-prev"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.onSurface} />
        </Pressable>
        <Pressable onPress={() => setYearPicker((o) => !o)} style={styles.title} testID="cal-title">
          <AppText weight="bold" size="lg">
            {MONTHS[view.m]} {view.y}
          </AppText>
          <Ionicons name={yearPicker ? "chevron-up" : "chevron-down"} size={16} color={COLORS.muted} style={{ marginLeft: 4 }} />
        </Pressable>
        <Pressable
          onPress={() => !nextDisabled && go(1)}
          disabled={nextDisabled}
          style={[styles.nav, nextDisabled && { opacity: 0.3 }]}
          hitSlop={8}
          testID="cal-next"
        >
          <Ionicons name="chevron-forward" size={20} color={COLORS.onSurface} />
        </Pressable>
      </View>

      {yearPicker ? (
        <ScrollView
          style={styles.yearScroll}
          contentContainerStyle={styles.yearGrid}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          persistentScrollbar
        >
          {years.map((y) => {
            const sel = y === view.y;
            return (
              <Pressable key={y} onPress={() => pickYear(y)} style={[styles.yearCell, sel && { backgroundColor: COLORS.brandPrimary }]} testID={`cal-year-${y}`}>
                <AppText weight={sel ? "bold" : "medium"} color={sel ? COLORS.onBrandPrimary : COLORS.onSurface}>
                  {y}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={styles.cell}>
                <AppText size="sm" color={COLORS.muted} weight="semibold">
                  {w}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d == null) return <View key={`e${i}`} style={styles.cell} />;
              const iso = toISO(view.y, view.m, d);
              const cellDate = new Date(view.y, view.m, d);
              const disabled = isPastMode ? cellDate > today : cellDate < today;
              const isSelected = value === iso;
              const isToday = iso === toISO(today.getFullYear(), today.getMonth(), today.getDate());
              return (
                <Pressable
                  key={iso}
                  disabled={disabled}
                  onPress={() => onSelect(iso)}
                  style={styles.cell}
                  testID={`cal-day-${iso}`}
                >
                  <View
                    style={[
                      styles.day,
                      isSelected && { backgroundColor: COLORS.brandPrimary },
                      !isSelected && isToday && { borderWidth: 1, borderColor: COLORS.brandPrimary },
                    ]}
                  >
                    <AppText
                      weight={isSelected ? "bold" : "medium"}
                      color={isSelected ? COLORS.onBrandPrimary : disabled ? COLORS.borderStrong : COLORS.onSurface}
                    >
                      {d}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm },
  title: { flexDirection: "row", alignItems: "center" },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceTertiary },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  yearScroll: { maxHeight: 200 },
  yearGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  yearCell: { width: "31%", height: 44, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm, backgroundColor: COLORS.surfaceTertiary },
});
