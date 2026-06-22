import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";

export const useIconFonts = (): readonly [boolean, Error | null] => {
  return useFonts({
    ...Ionicons.font,
  });
};
