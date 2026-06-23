import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type Props = {
  onLogin?: (email: string, password: string) => void;
  onForgotPassword?: () => void;
  onBiometrics?: () => void;
  onFaceId?: () => void;
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function LoginScreen({
  onLogin,
  onForgotPassword,
  onBiometrics,
  onFaceId,
}: Props) {
  const [email, setEmail] = useState("marcos.okabayashi@tamexecutiva.com.br");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
  if (!email || !password) return; // evita login vazio
  onLogin?.(email, password);
};  

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow px-6 pt-8 pb-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo + Badge ── */}
          <View className="flex-row items-center gap-3 mb-10">
            <View className="w-12 h-12 bg-red-600 rounded-xl items-center justify-center shadow-md shadow-red-200">
              {/* Ícone de avião — use sua própria imagem se disponível */}
              <Ionicons name="airplane" size={24} color="#fff" />
            </View>
            <View>
              <Text className="text-xl font-bold text-gray-900 tracking-wide">
                TAM
              </Text>
              <Text className="text-[10px] font-semibold tracking-[3px] text-gray-400 uppercase">
                Aviação Executiva
              </Text>
            </View>
          </View>

          {/* ── Headline ── */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900 leading-tight">
              Bem-vindo,{"\n"}Executivo.
            </Text>
            <Text className="text-sm text-gray-400 mt-2">
              Acesse sua conta corporativa para continuar.
            </Text>
          </View>

          {/* ── Formulário ── */}
          <View className="gap-3 mb-2">
            {/* Campo e-mail */}
            <View className="bg-gray-100 rounded-2xl px-4 pt-2 pb-3">
              <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                E-mail corporativo
              </Text>
              <TextInput
                className="text-sm text-gray-800 p-0"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Campo senha */}
            <View className="bg-gray-100 rounded-2xl px-4 py-4 flex-row items-center justify-between">
              <TextInput
                className="flex-1 text-sm text-gray-800 p-0"
                placeholder="Senha"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={
                  showPassword ? "Ocultar senha" : "Mostrar senha"
                }
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Esqueceu a senha ── */}
          <TouchableOpacity
            onPress={onForgotPassword}
            className="self-end mb-6"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-sm font-semibold text-red-600">
              Esqueceu a senha?
            </Text>
          </TouchableOpacity>

          {/* ── Botão Entrar ── */}
          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.85}
            className="bg-red-600 rounded-2xl py-4 flex-row items-center justify-center gap-2 shadow-lg shadow-red-300 mb-8"
          >
            <Text className="text-white font-bold text-base tracking-wide">
              Entrar
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>

          {/* ── Divisor "ou" ── */}
          <View className="flex-row items-center gap-3 mb-6">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-xs text-gray-400">ou</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* ── Biometria / Face ID ── */}
          <View className="flex-row gap-4">
            <TouchableOpacity
              onPress={onBiometrics}
              activeOpacity={0.8}
              className="flex-1 bg-gray-100 rounded-2xl py-4 items-center gap-1.5"
            >
              <Ionicons name="finger-print-outline" size={26} color="#374151" />
              <Text className="text-xs font-medium text-gray-600">
                Biometria
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onFaceId}
              activeOpacity={0.8}
              className="flex-1 bg-gray-100 rounded-2xl py-4 items-center gap-1.5"
            >
              <Ionicons name="scan-outline" size={26} color="#374151" />
              <Text className="text-xs font-medium text-gray-600">Face ID</Text>
            </TouchableOpacity>
          </View>

          {/* ── Rodapé ── */}
          <View className="flex-row justify-center gap-2 mt-10">
            <Text className="text-[10px] font-semibold tracking-widest text-gray-300 uppercase">
              IFS ERP
            </Text>
            <Text className="text-[10px] text-gray-300">•</Text>
            <Text className="text-[10px] font-semibold tracking-widest text-gray-300 uppercase">
              Secure
            </Text>
            <Text className="text-[10px] text-gray-300">•</Text>
            <Text className="text-[10px] font-semibold tracking-widest text-gray-300 uppercase">
              v2.4.1
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
