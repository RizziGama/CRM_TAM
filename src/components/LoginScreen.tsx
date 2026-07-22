import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getUserInfo, loginAzure, logoutAzure } from "@/components/azureAuth";
import { buscarExecutivoDeVendas, cacheExecutivo, clearExecutivoCache } from "@/components/ifsService";

type Props = {
  onLoginSuccess?: () => void; // ✅ mudou nome (fluxo SSO)
  onForgotPassword?: () => void;
  onBiometrics?: () => void;
  onFaceId?: () => void;
};

export default function LoginScreen({
  onLoginSuccess,
  onForgotPassword,
  onBiometrics,
  onFaceId,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false); // ✅ novo

  // ✅ NOVO LOGIN (SSO) + validação de Executivo de Vendas no IFS
  const handleLogin = async () => {
    try {
      setLoading(true);

      const result = await loginAzure();

      if (!result?.accessToken) {
        Alert.alert("Erro", "Não foi possível autenticar.");
        return;
      }

      // Login no Azure OK — agora confirma se esse usuário é um Executivo
      // de Vendas cadastrado (e ativo) no IFS antes de liberar o app.
      const userInfo = await getUserInfo();

      if (!userInfo?.email) {
        Alert.alert(
          "Erro",
          "Não foi possível identificar o e-mail do usuário autenticado."
        );
        await logoutAzure();
        await clearExecutivoCache();
        return;
      }

      const executivo = await buscarExecutivoDeVendas(userInfo.email);

      if (!executivo) {
        Alert.alert(
          "Acesso restrito",
          "Seu usuário não está cadastrado como Executivo de Vendas no IFS. Entre em contato com o administrador do sistema."
        );
        await logoutAzure();
        await clearExecutivoCache();
        return;
      }

      if (!executivo.ativo) {
        Alert.alert(
          "Acesso bloqueado",
          "Seu cadastro de Executivo de Vendas está inativo no IFS. Entre em contato com o administrador do sistema."
        );
        await logoutAzure();
        await clearExecutivoCache();
        return;
      }

      // Tudo certo: guarda o executivo real (ID + nome do IFS) para uso em
      // qualquer tela (ex.: cadastro de lead) e libera o acesso ao app.
      await cacheExecutivo(executivo);
      onLoginSuccess?.();

    } catch (err) {
      Alert.alert("Erro", "Falha no login com Microsoft.");
    } finally {
      setLoading(false);
    }
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
          {/* ── Logo ── */}
          <View className="flex-row items-center gap-3 mb-10">
            <View className="w-12 h-12 bg-red-600 rounded-xl items-center justify-center">
              <Ionicons name="airplane" size={24} color="#fff" />
            </View>
            <View>
              <Text className="text-xl font-bold text-gray-900">TAM</Text>
              <Text className="text-[10px] text-gray-400 uppercase">
                Aviação Executiva
              </Text>
            </View>
          </View>

          {/* ── Headline ── */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900">
              Bem-vindo,{"\n"}Executivo.
            </Text>
            <Text className="text-sm text-gray-400 mt-2">
              Acesse com sua conta corporativa Microsoft.
            </Text>
          </View>

          {/* ── Campos (opcional manter) ── */}
          <View className="gap-3 mb-2">
            <View className="bg-gray-100 rounded-2xl px-4 pt-2 pb-3">
              <Text className="text-[10px] text-gray-400 uppercase mb-1">
                E-mail corporativo
              </Text>
              <TextInput
                className="text-sm text-gray-800"
                value={email}
                onChangeText={setEmail}
                placeholder="Detectado automaticamente pela Microsoft"
                placeholderTextColor="#9ca3af"
                editable={false} // ✅ bloqueado (SSO decide)
              />
            </View>

            <View className="bg-gray-100 rounded-2xl px-4 py-4 flex-row items-center">
              <TextInput
                className="flex-1 text-sm text-gray-800"
                placeholder="Senha gerenciada pela Microsoft"
                placeholderTextColor="#9ca3af"
                editable={false}
                secureTextEntry
              />
            </View>
          </View>

          {/* ── Forgot password ── 
          <TouchableOpacity
            onPress={onForgotPassword}
            className="self-end mb-6"
          >
            <Text className="text-sm font-semibold text-red-600">
              Esqueceu a senha?
            </Text>
          </TouchableOpacity>
*/}
          {/* ✅ BOTÃO SSO */}
          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
            className="bg-red-600 rounded-2xl py-4 flex-row items-center justify-center gap-2 mb-8"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text className="text-white font-bold text-base">
                  Entrar com Microsoft
                </Text>
                <Ionicons name="logo-microsoft" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          
          {/* ── Biometria (opcional) ── 
          <View className="flex-row gap-4">
            <TouchableOpacity
              onPress={onBiometrics}
              className="flex-1 bg-gray-100 rounded-2xl py-4 items-center"
            >
              <Ionicons name="finger-print-outline" size={26} color="#374151" />
              <Text className="text-xs text-gray-600">Biometria</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onFaceId}
              className="flex-1 bg-gray-100 rounded-2xl py-4 items-center"
            >
              <Ionicons name="scan-outline" size={26} color="#374151" />
              <Text className="text-xs text-gray-600">Face ID</Text>
            </TouchableOpacity>
          </View>*/}

          {/* ── Footer 
          <View className="flex-row justify-center gap-2 mt-10">
            <Text className="text-[10px] text-gray-300 uppercase">
              IFS ERP • Secure • v2.4.1
            </Text>
          </View>── */}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
