import {
    Environment,
    OrbitControls,
    useAnimations,
    useGLTF,
} from "@react-three/drei/native";
import { Canvas, useFrame } from "@react-three/fiber/native";
import React, {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Animated,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as THREE from "three";

// ─── Model path ────────────────────────────────────────────────
const CURIE_MODEL = require("../../assets/models/Curie_rigged_Blendshapes.glb");

// ─── Animation clip names (update these after logging yours) ───
// Run with DEV_MODE = true once to discover real names from your GLB
const DEV_MODE = __DEV__; // logs animation & blendshape names in development

export const ANIMATION_CLIPS = [
  { id: "idle", label: "Idle", clipName: "Idle" },
  { id: "wave", label: "Wave", clipName: "Wave" },
  { id: "talk", label: "Talk", clipName: "Talk" },
  { id: "nod", label: "Nod", clipName: "Nod" },
] as const;

// ─── Blendshape presets (morph target names from your GLB) ─────
// Common ARKit / MetaHuman blendshape names — adjust to match yours
export const BLENDSHAPE_PRESETS = [
  {
    id: "neutral",
    label: "Neutral",
    emoji: "😐",
    values: {},
  },
  {
    id: "smile",
    label: "Smile",
    emoji: "😊",
    values: {
      mouthSmileLeft: 0.8,
      mouthSmileRight: 0.8,
      cheekPuff: 0.2,
    },
  },
  {
    id: "surprised",
    label: "Surprised",
    emoji: "😲",
    values: {
      eyeWideLeft: 0.9,
      eyeWideRight: 0.9,
      jawOpen: 0.5,
      browInnerUp: 0.7,
    },
  },
  {
    id: "sad",
    label: "Sad",
    emoji: "😢",
    values: {
      mouthFrownLeft: 0.7,
      mouthFrownRight: 0.7,
      browDownLeft: 0.5,
      browDownRight: 0.5,
    },
  },
  {
    id: "wink",
    label: "Wink",
    emoji: "😉",
    values: {
      eyeBlinkLeft: 1.0,
      mouthSmileRight: 0.5,
    },
  },
  {
    id: "blink",
    label: "Blink",
    emoji: "😑",
    values: {
      eyeBlinkLeft: 1.0,
      eyeBlinkRight: 1.0,
    },
  },
] as const;

type AnimationClip = (typeof ANIMATION_CLIPS)[number];
type BlendshapePreset = (typeof BLENDSHAPE_PRESETS)[number];
type BlendshapeMap = Record<string, number>;

// ─── Curie 3D Model Component ──────────────────────────────────
interface CurieModelProps {
  animationName: string;
  blendshapes: BlendshapeMap;
  animateBlendshapes: boolean;
  blendshapeAnimationKey: number;
}

function CurieModel({
  animationName,
  blendshapes,
  animateBlendshapes,
  blendshapeAnimationKey,
}: CurieModelProps) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(CURIE_MODEL) as any;
  const { actions, mixer } = useAnimations(animations, group);
  const blendshapeLoopStart = useRef<number | null>(null);
  const morphMeshes = useMemo(() => {
    const meshes: {
      dict: Record<string, number>;
      influences: number[];
    }[] = [];

    scene.traverse((child: any) => {
      if (!child.isMesh || !child.morphTargetDictionary) return;
      meshes.push({
        dict: child.morphTargetDictionary,
        influences: child.morphTargetInfluences,
      });
    });

    return meshes;
  }, [scene]);

  // Log available clips & blendshapes in dev
  useEffect(() => {
    if (!DEV_MODE) return;
    console.log(
      "[Curie] Animation clips:",
      animations.map((a: THREE.AnimationClip) => a.name),
    );
    scene.traverse((child: any) => {
      if (child.isMesh && child.morphTargetDictionary) {
        console.log(
          `[Curie] ${child.name} blendshapes:`,
          Object.keys(child.morphTargetDictionary),
        );
      }
    });
  }, [scene, animations]);

  // Play skeletal animation clip
  useEffect(() => {
    if (!animationName) return;
    const action = actions[animationName];
    if (!action) {
      if (DEV_MODE) console.warn(`[Curie] Clip "${animationName}" not found`);
      return;
    }
    action.reset().fadeIn(0.4).play();
    return () => {
      action.fadeOut(0.4);
    };
  }, [animationName, actions]);

  useEffect(() => {
    blendshapeLoopStart.current = null;
  }, [blendshapeAnimationKey]);

  // Advance animation mixer every frame
  useFrame(({ clock }, delta) => {
    mixer.update(delta);

    const loopDuration = 0.9;
    const elapsed =
      animateBlendshapes && Object.keys(blendshapes).length > 0
        ? (() => {
            if (blendshapeLoopStart.current === null) {
              blendshapeLoopStart.current = clock.getElapsedTime();
            }

            return (
              (clock.getElapsedTime() - blendshapeLoopStart.current) %
              loopDuration
            );
          })()
        : loopDuration;
    const progress = animateBlendshapes ? elapsed / loopDuration : 1;

    morphMeshes.forEach(({ dict, influences }) => {
      Object.values(dict).forEach((idx) => {
        influences[idx] = 0;
      });

      Object.entries(blendshapes).forEach(([name, value]) => {
        const idx = dict[name];
        if (idx !== undefined) {
          influences[idx] = Math.max(0, Math.min(1, value * progress));
        }
      });
    });
  });

  return (
    <primitive
      ref={group}
      object={scene}
      dispose={null}
      position={[0, -1.2, 0]}
      scale={1.2}
    />
  );
}

// ─── Scene ─────────────────────────────────────────────────────
interface SceneProps {
  animationName: string;
  blendshapes: BlendshapeMap;
  animateBlendshapes: boolean;
  blendshapeAnimationKey: number;
}

function Scene({
  animationName,
  blendshapes,
  animateBlendshapes,
  blendshapeAnimationKey,
}: SceneProps) {
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 6, 5]} intensity={2.2} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.6} />
      <Environment preset="studio" />
      <Suspense fallback={null}>
        <CurieModel
          animationName={animationName}
          blendshapes={blendshapes}
          animateBlendshapes={animateBlendshapes}
          blendshapeAnimationKey={blendshapeAnimationKey}
        />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={5}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.8}
        target={[0, 0.5, 0]}
      />
    </>
  );
}

// ─── Animation Picker ──────────────────────────────────────────
interface AnimationPickerProps {
  selected: AnimationClip;
  onSelect: (clip: AnimationClip) => void;
}

function AnimationPicker({ selected, onSelect }: AnimationPickerProps) {
  return (
    <View>
      <Text style={styles.sectionLabel}>Animation</Text>
      <FlatList
        data={ANIMATION_CLIPS}
        horizontal
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        renderItem={({ item }) => {
          const isSelected = item.id === selected.id;
          return (
            <TouchableOpacity
              onPress={() => onSelect(item)}
              style={[
                styles.chipButton,
                isSelected && styles.chipButtonSelected,
              ]}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.chipLabel,
                  isSelected && styles.chipLabelSelected,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ─── Expression Picker ─────────────────────────────────────────
interface ExpressionPickerProps {
  selected: BlendshapePreset;
  onSelect: (preset: BlendshapePreset) => void;
}

function ExpressionPicker({ selected, onSelect }: ExpressionPickerProps) {
  return (
    <View>
      <Text style={styles.sectionLabel}>Expression</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
      >
        {BLENDSHAPE_PRESETS.map((item) => {
          const isSelected = item.id === selected.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onSelect(item)}
              style={styles.expressionItem}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.expressionCircle,
                  isSelected && styles.expressionCircleSelected,
                ]}
              >
                <Text style={styles.expressionEmoji}>{item.emoji}</Text>
              </View>
              <Text
                style={[
                  styles.expressionLabel,
                  isSelected && styles.expressionLabelSelected,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Blendshape Slider (single morph target) ───────────────────
interface BlendshapeSliderProps {
  name: string;
  value: number;
  onChange: (name: string, value: number) => void;
}

function BlendshapeSlider({ name, value, onChange }: BlendshapeSliderProps) {
  const fillAnim = useRef(new Animated.Value(value)).current;

  const handlePress = useCallback(
    (v: number) => {
      Animated.timing(fillAnim, {
        toValue: v,
        duration: 200,
        useNativeDriver: false,
      }).start();
      onChange(name, v);
    },
    [fillAnim, name, onChange],
  );

  const steps = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderName} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.sliderSteps}>
        {steps.map((step) => (
          <TouchableOpacity
            key={step}
            onPress={() => handlePress(step)}
            style={[
              styles.sliderStep,
              Math.abs(value - step) < 0.01 && styles.sliderStepActive,
            ]}
          >
            <Text style={styles.sliderStepLabel}>{step}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────
export default function HomeScreen() {
  const [clip, setClip] = useState<AnimationClip>(ANIMATION_CLIPS[0]);
  const [preset, setPreset] = useState<BlendshapePreset>(BLENDSHAPE_PRESETS[0]);
  const [blendshapes, setBlendshapes] = useState<BlendshapeMap>({});
  const [animateBlendshapes, setAnimateBlendshapes] = useState(false);
  const [blendshapeAnimationKey, setBlendshapeAnimationKey] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Common individual blendshapes to expose as sliders
  const EXPOSED_SLIDERS = [
    "mouthSmileLeft",
    "mouthSmileRight",
    "jawOpen",
    "eyeBlinkLeft",
    "eyeBlinkRight",
    "browInnerUp",
  ];

  function handlePresetSelect(p: BlendshapePreset) {
    setPreset(p);
    setBlendshapes({ ...(p.values as BlendshapeMap) });
    setAnimateBlendshapes(Object.keys(p.values).length > 0);
    setBlendshapeAnimationKey((prev) => prev + 1);
  }

  function handleSliderChange(name: string, value: number) {
    setAnimateBlendshapes(false);
    setBlendshapes((prev) => ({ ...prev, [name]: value }));
    // Clear preset selection since we're now in custom state
    setPreset(BLENDSHAPE_PRESETS[0]);
  }

  return (
    <View style={styles.container}>
      {/* ── 3D Canvas ── */}
      <Canvas
        camera={{ position: [0, 1.5, 5], fov: 45 }}
        shadows
        style={styles.canvas}
      >
        <Scene
          animationName={clip.clipName}
          blendshapes={blendshapes}
          animateBlendshapes={animateBlendshapes}
          blendshapeAnimationKey={blendshapeAnimationKey}
        />
      </Canvas>

      {/* ── Control Panel ── */}
      <View style={styles.panel}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.panelContent}
        >
          {/* Animation clips */}
          <AnimationPicker selected={clip} onSelect={setClip} />

          <View style={styles.divider} />

          {/* Expression presets */}
          <ExpressionPicker selected={preset} onSelect={handlePresetSelect} />

          <View style={styles.divider} />

          {/* Advanced blendshape sliders */}
          <TouchableOpacity
            onPress={() => setShowAdvanced((v) => !v)}
            style={styles.advancedToggle}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionLabel}>
              Blendshapes{" "}
              <Text style={styles.advancedChevron}>
                {showAdvanced ? "▲" : "▼"}
              </Text>
            </Text>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.sliderList}>
              {EXPOSED_SLIDERS.map((name) => (
                <BlendshapeSlider
                  key={name}
                  name={name}
                  value={blendshapes[name] ?? 0}
                  onChange={handleSliderChange}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// Preload to avoid first-render stutter
useGLTF.preload(CURIE_MODEL);

// ─── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f13",
  },

  canvas: {
    flex: 1,
  },

  // ── Panel ──
  panel: {
    backgroundColor: "#1a1a22",
    borderTopWidth: 1,
    borderTopColor: "#2e2e3a",
    maxHeight: 340,
  },

  panelContent: {
    paddingTop: 16,
    paddingBottom: 28,
  },

  divider: {
    height: 1,
    backgroundColor: "#2e2e3a",
    marginHorizontal: 16,
    marginVertical: 14,
  },

  rowContent: {
    paddingHorizontal: 16,
    paddingRight: 24,
    gap: 10,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5a5a72",
    marginBottom: 12,
    paddingHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  // ── Chip buttons (animations) ──
  chipButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#25253a",
    borderWidth: 1,
    borderColor: "#35354a",
  },

  chipButtonSelected: {
    backgroundColor: "#4f46e5",
    borderColor: "#6366f1",
  },

  chipLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b6b8a",
  },

  chipLabelSelected: {
    color: "#ffffff",
  },

  // ── Expression picker ──
  expressionItem: {
    alignItems: "center",
    width: 62,
  },

  expressionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#25253a",
    borderWidth: 2,
    borderColor: "#35354a",
    alignItems: "center",
    justifyContent: "center",
  },

  expressionCircleSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#2d2d52",
  },

  expressionEmoji: {
    fontSize: 24,
  },

  expressionLabel: {
    marginTop: 6,
    fontSize: 10,
    color: "#5a5a72",
    fontWeight: "600",
    textAlign: "center",
  },

  expressionLabelSelected: {
    color: "#a5b4fc",
    fontWeight: "700",
  },

  // ── Advanced sliders ──
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
  },

  advancedChevron: {
    color: "#4f46e5",
    fontSize: 11,
  },

  sliderList: {
    paddingHorizontal: 16,
    gap: 10,
  },

  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  sliderName: {
    fontSize: 11,
    color: "#6b6b8a",
    fontWeight: "600",
    width: 120,
    textTransform: "none",
  },

  sliderSteps: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },

  sliderStep: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#25253a",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#35354a",
  },

  sliderStepActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#6366f1",
  },

  sliderStepLabel: {
    fontSize: 10,
    color: "#6b6b8a",
    fontWeight: "600",
  },
});
