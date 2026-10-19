import { useColorScheme } from "react-native";

export interface ThemeTokens {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}

export const lightTheme: ThemeTokens = {
  background: "#FFFFFF",
  surface: "#F5F5F5",
  text: "#1A1A1A",
  textMuted: "#6B6B6B",
  accent: "#E0562C",
  border: "#E2E2E2",
};

export const darkTheme: ThemeTokens = {
  background: "#121212",
  surface: "#1E1E1E",
  text: "#F2F2F2",
  textMuted: "#A0A0A0",
  accent: "#FF7A4D",
  border: "#2E2E2E",
};

export function useTheme(): ThemeTokens {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkTheme : lightTheme;
}
