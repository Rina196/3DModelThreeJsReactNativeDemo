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
const MODEL_POSITION: [number, number, number] = [0, -1.65, 0];
const MODEL_SCALE = 1.75;
const CAMERA_POSITION: [number, number, number] = [0, 1.2, 3.6];
const ORBIT_TARGET: [number, number, number] = [0, 0.15, 0];

// ─── Animation clip names (update these after logging yours) ───
// Run with DEV_MODE = true once to discover real names from your GLB
const DEV_MODE = __DEV__; // logs animation & blendshape names in development

export const ANIMATION_CLIPS = [
  { id: "idle", label: "Idle", clipName: "Idle" },
  { id: "wave", label: "Wave", clipName: "Wave" },
  { id: "talk", label: "Talk", clipName: "Talk" },
  { id: "nod", label: "Nod", clipName: "Nod" },
] as const;

export const BLENDSHAPE_OPTIONS = [
  "mouthSmileLeft",
  "mouthSmileRight",
  "jawOpen",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "browInnerUp",
] as const;

type AnimationClip = (typeof ANIMATION_CLIPS)[number];
type BlendshapeName = (typeof BLENDSHAPE_OPTIONS)[number];
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
  const bodyAnimationStart = useRef<number | null>(null);
  const basePosition = useMemo(
    () => new THREE.Vector3(...MODEL_POSITION),
    [],
  );
  const morphMeshes = useMemo(() => {
    const meshes: Array<{
      dict: Record<string, number>;
      influences: number[];
    }> = [];

    scene.traverse((child: any) => {
      if (!child.isMesh || !child.morphTargetDictionary) return;
      meshes.push({
        dict: child.morphTargetDictionary,
        influences: child.morphTargetInfluences,
      });
    });

    return meshes;
  }, [scene]);
  const skinnedMeshes = useMemo(() => {
    const meshes: THREE.SkinnedMesh[] = [];

    scene.traverse((child: any) => {
      if (child.isSkinnedMesh) {
        meshes.push(child as THREE.SkinnedMesh);
      }
    });

    return meshes;
  }, [scene]);
  const bones = useMemo(() => {
    const skeletonBones = new Map<string, THREE.Bone>();

    skinnedMeshes.forEach((mesh) => {
      mesh.skeleton?.bones.forEach((bone) => {
        if (bone?.name && !skeletonBones.has(bone.name)) {
          skeletonBones.set(bone.name, bone);
        }
      });
    });

    const findBone = (name: string) =>
      skeletonBones.get(name) ??
      (scene.getObjectByName(name) as THREE.Bone | null) ??
      null;

    return {
      head: findBone("mixamorig:Head"),
      hips: findBone("mixamorig:Hips"),
      neck: findBone("mixamorig:Neck"),
      spine: findBone("mixamorig:Spine"),
      spine1: findBone("mixamorig:Spine1"),
      spine2: findBone("mixamorig:Spine2"),
      rightShoulder: findBone("mixamorig:RightShoulder"),
      rightArm: findBone("mixamorig:RightArm"),
      rightForeArm: findBone("mixamorig:RightForeArm"),
      rightHand: findBone("mixamorig:RightHand"),
      leftShoulder: findBone("mixamorig:LeftShoulder"),
      leftArm: findBone("mixamorig:LeftArm"),
    };
  }, [scene, skinnedMeshes]);
  const initialBoneRotations = useMemo(() => {
    const rotationMap = new Map<
      THREE.Bone,
      { rotation: THREE.Euler; quaternion: THREE.Quaternion }
    >();

    Object.values(bones).forEach((bone) => {
      if (bone) {
        rotationMap.set(bone, {
          rotation: bone.rotation.clone(),
          quaternion: bone.quaternion.clone(),
        });
      }
    });

    return rotationMap;
  }, [bones]);

  // Log available clips & blendshapes in dev
  useEffect(() => {
    if (!DEV_MODE) return;
    console.log(
      "[Curie] Animation clips:",
      animations.map((a: THREE.AnimationClip) => a.name),
    );
    console.log("[Curie] Skinned meshes:", skinnedMeshes.map((m) => m.name));
    console.log(
      "[Curie] Resolved bones:",
      Object.fromEntries(
        Object.entries(bones).map(([key, bone]) => [key, bone?.name ?? null]),
      ),
    );
    scene.traverse((child: any) => {
      if (child.isMesh && child.morphTargetDictionary) {
        console.log(
          `[Curie] ${child.name} blendshapes:`,
          Object.keys(child.morphTargetDictionary),
        );
      }
    });
  }, [scene, animations, bones, skinnedMeshes]);

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

  useEffect(() => {
    bodyAnimationStart.current = null;
  }, [animationName]);

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
    const action = actions[animationName];
    const hasClipAnimation = Boolean(action);

    if (bodyAnimationStart.current === null) {
      bodyAnimationStart.current = clock.getElapsedTime();
    }

    const bodyElapsed = clock.getElapsedTime() - bodyAnimationStart.current;
    const setBoneRotation = (
      bone: THREE.Bone | null,
      x = 0,
      y = 0,
      z = 0,
    ) => {
      if (!bone) return;
      const initialPose = initialBoneRotations.get(bone);
      if (!initialPose) return;

      bone.quaternion.copy(initialPose.quaternion);

      const offsetEuler = new THREE.Euler(x, y, z, "XYZ");
      const offsetQuaternion = new THREE.Quaternion().setFromEuler(offsetEuler);
      bone.quaternion.multiply(offsetQuaternion);
    };

    if (!hasClipAnimation) {
      scene.position.copy(basePosition);
      scene.rotation.set(0, 0, 0);

      initialBoneRotations.forEach((pose, bone) => {
        bone.rotation.copy(pose.rotation);
        bone.quaternion.copy(pose.quaternion);
      });

      const idleBreath = Math.sin(bodyElapsed * 1.6) * 0.03;
      const idleSway = Math.sin(bodyElapsed * 0.9) * 0.05;
      setBoneRotation(bones.spine2, idleBreath, 0, 0);
      setBoneRotation(bones.head, idleBreath * 0.4, 0, 0);
      setBoneRotation(bones.hips, 0, idleSway * 0.25, 0);
      scene.position.y = basePosition.y + Math.sin(bodyElapsed * 1.6) * 0.03;

      if (animationName === "Wave") {
        const waveSwing = Math.sin(bodyElapsed * 6.5) * 0.95;
        const foreArmSwing = Math.sin(bodyElapsed * 6.5 + 0.4) * 0.7;
        const handTwist = Math.cos(bodyElapsed * 6.5) * 0.45;

        scene.rotation.y = Math.sin(bodyElapsed * 1.2) * 0.08;
        setBoneRotation(bones.spine1, 0, 0, -0.1);
        setBoneRotation(bones.spine2, -0.08, 0, -0.18);
        setBoneRotation(bones.rightShoulder, 0.35, 0.15, 0.8);
        setBoneRotation(bones.rightArm, -1.85, 0.35, 1.2);
        setBoneRotation(bones.rightForeArm, -0.65, 0.1, foreArmSwing);
        setBoneRotation(bones.rightHand, 0, handTwist, 0.4);
        setBoneRotation(bones.leftShoulder, 0.05, 0, -0.08);
        setBoneRotation(bones.leftArm, 0.12, 0, -0.14);
      }

      if (animationName === "Talk") {
        const talkBob = Math.sin(bodyElapsed * 5.5) * 0.12;
        const shoulderShift = Math.sin(bodyElapsed * 3.2) * 0.08;

        scene.rotation.y = Math.sin(bodyElapsed * 1.8) * 0.06;
        setBoneRotation(bones.spine1, talkBob * 0.25, 0, 0);
        setBoneRotation(bones.spine2, talkBob * 0.35, 0, 0);
        setBoneRotation(bones.neck, talkBob * 0.45, 0, 0);
        setBoneRotation(bones.head, talkBob, 0, 0);
        setBoneRotation(bones.leftShoulder, 0, 0, -shoulderShift);
        setBoneRotation(bones.rightShoulder, 0, 0, shoulderShift);
        setBoneRotation(bones.leftArm, 0.1, 0, -0.12);
        setBoneRotation(bones.rightArm, 0.1, 0, 0.12);
      }

      if (animationName === "Nod") {
        const nodWave = Math.sin(bodyElapsed * 3.8);
        const nodForward = Math.max(0, nodWave) * 0.55;
        const nodRecover = Math.min(0, nodWave) * 0.18;
        const nodAngle = nodForward + nodRecover;

        scene.rotation.y = Math.sin(bodyElapsed * 1.1) * 0.04;
        setBoneRotation(bones.neck, nodAngle * 0.55, 0, 0);
        setBoneRotation(bones.head, nodAngle, 0, 0);
        setBoneRotation(bones.spine1, nodAngle * 0.12, 0, 0);
        setBoneRotation(bones.spine2, nodAngle * 0.22, 0, 0);
      }

      scene.updateMatrixWorld(true);
    }

    const animatedBlendshapes: BlendshapeMap = { ...blendshapes };
    if (animationName === "Talk") {
      const mouthCycle = (Math.sin(bodyElapsed * 9) + 1) / 2;
      animatedBlendshapes.jawOpen = Math.max(
        animatedBlendshapes.jawOpen ?? 0,
        0.15 + mouthCycle * 0.65,
      );
      animatedBlendshapes.mouthSmileLeft = Math.max(
        animatedBlendshapes.mouthSmileLeft ?? 0,
        0.12,
      );
      animatedBlendshapes.mouthSmileRight = Math.max(
        animatedBlendshapes.mouthSmileRight ?? 0,
        0.12,
      );
    }

    morphMeshes.forEach(({ dict, influences }) => {
      Object.values(dict).forEach((idx) => {
        influences[idx] = 0;
      });

      Object.entries(animatedBlendshapes).forEach(([name, value]) => {
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
      position={MODEL_POSITION}
      scale={MODEL_SCALE}
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
        minDistance={1.25}
        maxDistance={5}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.8}
        target={ORBIT_TARGET}
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

// ─── Blendshape Picker ─────────────────────────────────────────
interface BlendshapePickerProps {
  selected: BlendshapeName | null;
  onSelect: (name: BlendshapeName) => void;
  onReset: () => void;
}

function BlendshapePicker({
  selected,
  onSelect,
  onReset,
}: BlendshapePickerProps) {
  return (
    <View>
      <Text style={styles.sectionLabel}>Blendshape Animation</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
      >
        <TouchableOpacity
          onPress={onReset}
          style={[
            styles.chipButton,
            selected === null && styles.chipButtonSelected,
          ]}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.chipLabel,
              selected === null && styles.chipLabelSelected,
            ]}
          >
            Reset
          </Text>
        </TouchableOpacity>
        {BLENDSHAPE_OPTIONS.map((item) => {
          const isSelected = item === selected;
          return (
            <TouchableOpacity
              key={item}
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
                {item}
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
  const [selectedBlendshape, setSelectedBlendshape] =
    useState<BlendshapeName | null>(null);
  const [blendshapes, setBlendshapes] = useState<BlendshapeMap>({});
  const [animateBlendshapes, setAnimateBlendshapes] = useState(false);
  const [blendshapeAnimationKey, setBlendshapeAnimationKey] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleBlendshapeSelect(name: BlendshapeName) {
    setSelectedBlendshape(name);
    setBlendshapes({ [name]: 1 });
    setAnimateBlendshapes(true);
    setBlendshapeAnimationKey((prev) => prev + 1);
  }

  function handleBlendshapeReset() {
    setSelectedBlendshape(null);
    setBlendshapes({});
    setAnimateBlendshapes(false);
    setBlendshapeAnimationKey((prev) => prev + 1);
  }

  function handleSliderChange(name: string, value: number) {
    setAnimateBlendshapes(false);
    setBlendshapes((prev) => ({ ...prev, [name]: value }));
    setSelectedBlendshape(null);
  }

  return (
    <View style={styles.container}>
      {/* ── 3D Canvas ── */}
      <Canvas
        camera={{ position: CAMERA_POSITION, fov: 36 }}
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

          {/* Blendshape animation */}
          <BlendshapePicker
            selected={selectedBlendshape}
            onSelect={handleBlendshapeSelect}
            onReset={handleBlendshapeReset}
          />

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
              {BLENDSHAPE_OPTIONS.map((name) => (
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
