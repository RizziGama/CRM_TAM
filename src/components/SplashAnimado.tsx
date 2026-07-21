import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
} from "react-native";

const { width, height } = Dimensions.get("window");

// ─── Configuração do Radar ────────────────────────────────────────────────────

const RADAR_SIZE = 220;
const CENTER = RADAR_SIZE / 2;
const SWEEP_HALF_HEIGHT = CENTER * 0.42; // controla a abertura angular da fatia (~45°)
const RINGS = [0.25, 0.5, 0.75, 1.0]; // proporções dos anéis
const BLIP_POSITIONS = [
  { x: CENTER + 28, y: CENTER - 42, delay: 600  },
  { x: CENTER - 38, y: CENTER + 22, delay: 1200 },
];

// ─── Ícone de avião (SVG-like com Views) ─────────────────────────────────────

function AviaoIcon() {
  return (
    <View style={styles.aviaoBox}>
      <Text style={styles.aviaoEmoji}>✈</Text>
    </View>
  );
}

// ─── Blip piscante ────────────────────────────────────────────────────────────

function Blip({ x, y, delay }: { x: number; y: number; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.delay(1400),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[styles.blip, { left: x - 4, top: y - 4, opacity }]} />
  );
}

// ─── Sweep (fatia do radar que gira) ─────────────────────────────────────────

function RadarSweep({ rotation }: { rotation: Animated.Value }) {
  const spin = rotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      style={[styles.sweepContainer, { transform: [{ rotate: spin }] }]}
      renderToHardwareTextureAndroid={Platform.OS === "android"}
      needsOffscreenAlphaCompositing={Platform.OS === "android"}
    >
      <View style={styles.sweepSlice} />
      <View style={styles.sweepLine} />
    </Animated.View>
  );
}
// ─── Tela Principal ───────────────────────────────────────────────────────────

interface Props {
  onFinish?: () => void;
  duration?: number; // ms antes de chamar onFinish
}

export default function SplashAnimado({ onFinish, duration = 3000 }: Props) {
  const rotation  = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const radarScale  = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Radar gira continuamente
    Animated.loop(
      Animated.timing(rotation, {
        toValue:        1,
        duration:       2400,
        easing:         Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Fade-in + scale do radar e logo
    Animated.parallel([
      Animated.timing(radarScale, {
        toValue:        1,
        duration:       800,
        easing:         Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue:        1,
        duration:       900,
        delay:          300,
        useNativeDriver: true,
      }),
    ]).start();

    // Chama onFinish após o duration
    if (onFinish) {
      const timer = setTimeout(onFinish, duration);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <View style={styles.container}>

      {/* ── Radar ──────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.radarWrapper, { transform: [{ scale: radarScale }] }]}>
        <View style={styles.radar}
          renderToHardwareTextureAndroid={Platform.OS === "android"}>

          {/* Anéis concêntricos */}
          {RINGS.map((r, i) => (
            <View
              key={i}
              style={[
                styles.ring,
                {
                  width:  RADAR_SIZE * r,
                  height: RADAR_SIZE * r,
                  borderRadius: (RADAR_SIZE * r) / 2,
                  left: CENTER - (RADAR_SIZE * r) / 2,
                  top:  CENTER - (RADAR_SIZE * r) / 2,
                  opacity: 0.35 + i * 0.1,
                },
              ]}
            />
          ))}

          {/* Cruz central (linhas de mira) */}
          <View style={styles.crossH} />
          <View style={styles.crossV} />

          {/* Ponto central */}
          <View style={styles.centerDot} />

          {/* Sweep animado */}
          <RadarSweep rotation={rotation} />

          {/* Blips */}
          {BLIP_POSITIONS.map((b, i) => (
            <Blip key={i} x={b.x} y={b.y} delay={b.delay} />
          ))}
        </View>
      </Animated.View>

      {/* ── Logo TAM ───────────────────────────────────────────────────── */}
      <Animated.View style={[styles.logoRow, { opacity: logoOpacity }]}>
        <AviaoIcon />
        <View style={styles.logoTextBlock}>
          <Text style={styles.logoTam}>TAM</Text>
          <Text style={styles.logoSub}>AVIAÇÃO EXECUTIVA</Text>
        </View>
      </Animated.View>

    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: "#FFFFFF",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             48,
  },

  // ── Radar
  radarWrapper: {
    alignItems:     "center",
    justifyContent: "center",
  },
  radar: {
    width:    RADAR_SIZE,
    height:   RADAR_SIZE,
    borderRadius: CENTER,
    overflow:     "hidden",    // <- corta tudo que passar do círculo
    position:     "relative"
  },
  ring: {
    position:    "absolute",
    borderWidth: 1,
    borderColor: "#CC0000",
  },
  crossH: {
    position:        "absolute",
    left:            0,
    top:             CENTER - 0.5,
    width:           RADAR_SIZE,
    height:          1,
    backgroundColor: "#CC0000",
    opacity:         0.4,
  },
  crossV: {
    position:        "absolute",
    top:             0,
    left:            CENTER - 0.5,
    width:           1,
    height:          RADAR_SIZE,
    backgroundColor: "#CC0000",
    opacity:         0.4,
  },
  centerDot: {
    position:        "absolute",
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: "#CC0000",
    left:            CENTER - 5,
    top:             CENTER - 5,
    zIndex:          10,
  },

  // ── Sweep
  sweepContainer: {
    position:       "absolute",
    width:          RADAR_SIZE,
    height:         RADAR_SIZE,
    alignItems:     "center",
    justifyContent: "center",
  },
  sweepSlice: {
    position: "absolute",
    left:     CENTER,
    top:      CENTER - SWEEP_HALF_HEIGHT,
    width:    0,
    height:   0,
    borderTopWidth:    SWEEP_HALF_HEIGHT,
    borderBottomWidth: SWEEP_HALF_HEIGHT,
    borderRightWidth:  CENTER,
    borderTopColor:    "transparent",
    borderBottomColor: "transparent",
    borderRightColor:  "rgba(204, 0, 0, 0.15)",
  },
  sweepLine: {
    position:        "absolute",
    left:            CENTER,
    top:             CENTER - 0.5,
    width:           CENTER,
    height:          1.5,
    backgroundColor: "#CC0000",
    opacity:         0.8,
  },

  // ── Blip
  blip: {
    position:        "absolute",
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: "#CC0000",
  },

  // ── Logo
  logoRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           14,
  },
  aviaoBox: {
    width:          56,
    height:         56,
    borderRadius:   14,
    backgroundColor: "#CC0000",
    alignItems:     "center",
    justifyContent: "center",
  },
  aviaoEmoji: {
    fontSize:  28,
    color:     "#fff",
    transform: [{ rotate: "45deg" }],
  },
  logoTextBlock: {
    gap: 2,
  },
  logoTam: {
    fontSize:   28,
    fontWeight: "800",
    color:      "#111",
    letterSpacing: 2,
  },
  logoSub: {
    fontSize:    11,
    fontWeight:  "600",
    color:       "#AAA",
    letterSpacing: 3.5,
  },
});
