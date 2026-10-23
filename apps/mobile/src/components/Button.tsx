import { ActivityIndicator, Pressable, Text } from "react-native";
import { useTheme } from "../theme/tokens";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = "primary", loading, disabled }: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={{
        backgroundColor: isPrimary ? theme.accent : "transparent",
        borderWidth: isPrimary ? 0 : 1,
        borderColor: theme.border,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.background : theme.text} />
      ) : (
        <Text
          style={{
            color: isPrimary ? theme.background : theme.text,
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
