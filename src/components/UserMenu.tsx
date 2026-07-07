import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AzureUserInfo, getUserInfo, logoutAzure } from "@/components/azureAuth";
import { clearExecutivoCache } from "@/components/ifsService";

// ─── Props ───────────────────────────────────────────────────────────────────

interface UserMenuProps {
  onLogout?: () => void;
  size?: number;
}

// ─── Avatar com iniciais dinâmicas ─────────────────────────────────────────

function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#CC0000",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.4 }}>
        {initials}
      </Text>
    </View>
  );
}

// ─── UserMenu ───────────────────────────────────────────────────────────────
//
// Botão flutuante com o avatar (iniciais reais do usuário Microsoft). Ao
// tocar, abre um card com nome, e-mail e a opção de sair da conta.

export function UserMenu({ onLogout, size = 36 }: UserMenuProps) {
  const [user, setUser] = useState<AzureUserInfo | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    getUserInfo().then((info) => {
      if (mounted) setUser(info);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    setMenuVisible(false);
    Alert.alert(
      "Sair da conta",
      "Deseja realmente encerrar sua sessão?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            try {
              setLoggingOut(true);
              await logoutAzure();
              // Limpa também o executivo de vendas cacheado — senão, ao
              // logar com outra conta, o app poderia usar o representante
              // errado até revalidar (o próximo login já revalida do zero,
              // mas isso evita qualquer janela de inconsistência).
              await clearExecutivoCache();
            } finally {
              setLoggingOut(false);
              onLogout?.();
            }
          },
        },
      ]
    );
  };

  const initials = user?.initials ?? "?";

  return (
    <>
      <TouchableOpacity
        onPress={() => setMenuVisible(true)}
        disabled={loggingOut}
        activeOpacity={0.75}
        style={{ opacity: loggingOut ? 0.5 : 1 }}
      >
        <Avatar initials={initials} size={size} />
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={{
              position: "absolute",
              top: Platform.OS === "ios" ? 96 : 68,
              right: 16,
              width: 260,
              backgroundColor: "#fff",
              borderRadius: 16,
              paddingVertical: 16,
              paddingHorizontal: 18,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            {/* Cabeçalho: avatar + nome + e-mail */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Avatar initials={initials} size={44} />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 14.5, fontWeight: "700", color: "#111" }}
                >
                  {user?.name ?? "Usuário"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 12, color: "#888", marginTop: 1 }}
                >
                  {user?.email ?? ""}
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: "#F0F0F0", marginBottom: 10 }} />

            {/* Ação: Sair */}
            <TouchableOpacity
              onPress={handleLogout}
              disabled={loggingOut}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 8,
              }}
            >
              <Ionicons name="log-out-outline" size={18} color="#CC0000" />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#CC0000" }}>
                Sair da conta
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
