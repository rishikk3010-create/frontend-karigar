import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/src/theme";
import { ScreenHeader, Loader } from "@/src/components/ui";
import WorkerDetail from "@/src/components/WorkerDetail";
import { apiFetch } from "@/src/api/client";
import { Worker } from "@/src/utils/profile";

export default function AdminWorkerDetail() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [worker, setWorker] = useState<Worker | null>(null);

  useEffect(() => {
    apiFetch<Worker>(`/admin/workers/${id}`).then(setWorker).catch(() => {});
  }, [id]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={t("reviewProfile")} onBack={() => router.back()} />
      {worker ? <WorkerDetail worker={worker} /> : <Loader />}
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.surface } });
