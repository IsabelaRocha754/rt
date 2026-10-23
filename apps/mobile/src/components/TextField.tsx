import { Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../theme/tokens";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: theme.textMuted, fontSize: 13 }}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[
          {
            borderWidth: 1,
            borderColor: error ? "#D1453B" : theme.border,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 16,
            color: theme.text,
            backgroundColor: theme.surface,
          },
          style,
        ]}
        {...inputProps}
      />
      {error ? <Text style={{ color: "#D1453B", fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}
