import {
  Environment,
  OrbitControls,
  useGLTF,
  useTexture,
} from "@react-three/drei/native";
import { Canvas } from "@react-three/fiber/native";
import React, { Suspense, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as THREE from "three";

// ─── Model ─────────────────────────────────────────────────────
const SOFA_MODEL = require("../../assets/models/sofa.glb");

// ─── Nodes ─────────────────────────────────────────────────────
const SEAT_NODE_NAMES = ["sofa_02_Seat", "sofa_02_Seat.001"];
const WOOD_NODE = "sofa_02_Base_wooden";

// ─── Texture Definitions ───────────────────────────────────────
// "solid" type = no texture, just flat color
// "textured" type = poly haven fabric maps
export const FABRIC_TYPES = [
  {
    id: "original",
    label: "Original",
    type: "original" as const,
    preview: "#c8b89a",
    textures: null,
  },
  {
    id: "solid",
    label: "Solid",
    type: "solid" as const,
    preview: "multicolor",
    textures: null,
  },
  {
    id: "jersey",
    label: "Jersey\nMelange",
    type: "textured" as const,
    preview: "#D0CECA",
    textures: {
      diff: require("../../assets/models/fabric/jersey/jersey_melange_diff_2k.png"),
      normal: require("../../assets/models/fabric/jersey/jersey_melange_nor_dx_2k.png"),
      rough: require("../../assets/models/fabric/jersey/jersey_melange_rough_2k.png"),
    },
  },
  {
    id: "caban",
    label: "caban",
    type: "textured" as const,
    preview: "#8B7B6B",
    textures: {
      diff: require("../../assets/models/fabric/caban/caban_diff_2k.png"),
      normal: require("../../assets/models/fabric/caban/caban_nor_dx_2k.png"),
      rough: require("../../assets/models/fabric/caban/caban_rough_2k.png"),
    },
  },
  {
    id: "denim",
    label: "Denim",
    type: "textured" as const,
    preview: "#5B7FA6",
    textures: {
      diff: require("../../assets/models/fabric/denim/denim_fabric_diff_2k.png"),
      normal: require("../../assets/models/fabric/denim/denim_fabric_nor_dx_2k.png"),
      rough: require("../../assets/models/fabric/denim/denim_fabric_rough_2k.png"),
    },
  },
] as const;

// ─── Color Palette ─────────────────────────────────────────────
export const COLOR_PALETTE = [
  { id: "white", label: "White", hex: "#FFFFFF" },
  { id: "cream", label: "Cream", hex: "#F5F5DC" },
  { id: "beige", label: "Beige", hex: "#E8DCCB" },
  { id: "gray", label: "Gray", hex: "#A9A9A9" },
  { id: "charcoal", label: "Charcoal", hex: "#36454F" },
  { id: "black", label: "Black", hex: "#1A1A1A" },
  { id: "brown", label: "Brown", hex: "#5C4033" },
  { id: "tan", label: "Tan", hex: "#D2B48C" },
  { id: "navy", label: "Navy", hex: "#1B2A4A" },
  { id: "olive", label: "Olive", hex: "#556B2F" },
  { id: "terracotta", label: "Terra", hex: "#C1694F" },
  { id: "blush", label: "Blush", hex: "#E8A0A0" },
];

type FabricType = (typeof FABRIC_TYPES)[number];
type ColorType = (typeof COLOR_PALETTE)[number];

// ─── Fabric Material (textured) ────────────────────────────────
function TexturedMaterial({
  textures,
  tint,
}: {
  textures: NonNullable<Extract<FabricType, { type: "textured" }>["textures"]>;
  tint: string;
}) {
  const [diffMap, normalMap, roughMap] = useTexture([
    textures.diff,
    textures.normal,
    textures.rough,
  ]);

  [diffMap, normalMap, roughMap].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.needsUpdate = true;
  });

  return (
    <meshStandardMaterial
      map={diffMap}
      normalMap={normalMap}
      roughnessMap={roughMap}
      normalScale={new THREE.Vector2(1, 1)}
      color={tint}
      roughness={1}
      metalness={0}
    />
  );
}

// ─── Sofa ──────────────────────────────────────────────────────
function Sofa({ fabric, color }: { fabric: FabricType; color: ColorType }) {
  const { nodes, materials } = useGLTF(SOFA_MODEL) as any;

  function SeatMaterial() {
    if (fabric.type === "original") {
      return (
        <primitive
          object={nodes[SEAT_NODE_NAMES[0]]?.material}
          attach="material"
        />
      );
    }
    if (fabric.type === "solid") {
      return (
        <meshStandardMaterial
          color={color.hex}
          roughness={0.85}
          metalness={0}
        />
      );
    }
    // textured
    return (
      <Suspense fallback={<meshStandardMaterial color={color.hex} />}>
        <TexturedMaterial textures={fabric.textures!} tint={color.hex} />
      </Suspense>
    );
  }

  return (
    <group dispose={null}>
      {SEAT_NODE_NAMES.map((name) => {
        const node = nodes[name];
        if (!node?.geometry) return null;
        return (
          <mesh key={name} geometry={node.geometry} castShadow receiveShadow>
            <SeatMaterial />
          </mesh>
        );
      })}

      {Object.keys(nodes).map((name) => {
        const node = nodes[name];
        if (!node?.geometry || SEAT_NODE_NAMES.includes(name)) return null;
        return (
          <mesh
            key={name}
            geometry={node.geometry}
            material={
              name === WOOD_NODE
                ? materials["sofa_02.001"]
                : materials["sofa_02"]
            }
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
}

// ─── Scene ─────────────────────────────────────────────────────
function Scene({ fabric, color }: { fabric: FabricType; color: ColorType }) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 6, 5]} intensity={2} castShadow />
      <Environment preset="apartment" />
      <Suspense fallback={null}>
        <Sofa fabric={fabric} color={color} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={2} maxDistance={8} />
    </>
  );
}

// ─── Texture Picker ────────────────────────────────────────────
function TexturePicker({
  selected,
  onSelect,
}: {
  selected: FabricType;
  onSelect: (f: FabricType) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionLabel}>Fabric Type</Text>
      <FlatList
        data={FABRIC_TYPES}
        horizontal
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        renderItem={({ item }) => {
          const isSelected = item.id === selected.id;
          return (
            <TouchableOpacity
              onPress={() => onSelect(item as FabricType)}
              style={styles.fabricItem}
              activeOpacity={0.75}
            >
              {/* Swatch */}
              <View
                style={[
                  styles.fabricSwatch,
                  isSelected && styles.swatchSelected,
                ]}
              >
                {item.preview === "multicolor" ? (
                  // Solid option — gradient dot
                  <View style={styles.multiDot}>
                    {["#E8DCCB", "#1B2A4A", "#556B2F", "#5C4033"].map(
                      (c, i) => (
                        <View
                          key={i}
                          style={[styles.multiSlice, { backgroundColor: c }]}
                        />
                      ),
                    )}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.fabricSwatchInner,
                      { backgroundColor: item.preview },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.fabricLabel,
                  isSelected && styles.fabricLabelSelected,
                ]}
                numberOfLines={2}
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

// ─── Color Picker ──────────────────────────────────────────────
function ColorPicker({
  selected,
  onSelect,
  disabled,
}: {
  selected: ColorType;
  onSelect: (c: ColorType) => void;
  disabled: boolean;
}) {
  return (
    <View style={[styles.colorSection, disabled && styles.sectionDisabled]}>
      <Text style={styles.sectionLabel}>
        Color{" "}
        {disabled ? (
          <Text style={styles.disabledNote}>(select a fabric first)</Text>
        ) : (
          <Text style={styles.selectedNote}>— {selected.label}</Text>
        )}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        scrollEnabled={!disabled}
      >
        {COLOR_PALETTE.map((item) => {
          const isSelected = item.id === selected.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => !disabled && onSelect(item)}
              style={styles.colorItem}
              activeOpacity={disabled ? 1 : 0.75}
            >
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: item.hex },
                  item.hex === "#FFFFFF" && styles.whiteBorder,
                  isSelected && !disabled && styles.colorDotSelected,
                  disabled && styles.colorDotDisabled,
                ]}
              />
              <Text
                style={[
                  styles.colorLabel,
                  isSelected && !disabled && styles.colorLabelSelected,
                  disabled && styles.colorLabelDisabled,
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

// ─── Main Screen ───────────────────────────────────────────────
export default function HomeScreen() {
  const [fabric, setFabric] = useState<FabricType>(FABRIC_TYPES[0]);
  const [color, setColor] = useState<ColorType>(COLOR_PALETTE[3]); // default gray

  // Color picker disabled only for "original"
  const colorDisabled = fabric.type === "original";

  function handleFabricSelect(f: FabricType) {
    setFabric(f);
    // Auto reset color to gray when switching
    if (f.type !== "original") setColor(COLOR_PALETTE[3]);
  }

  return (
    <View style={styles.container}>
      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 1.5, 5], fov: 45 }} shadows>
        <Scene fabric={fabric} color={color} />
      </Canvas>

      {/* Bottom Panel */}
      <View style={styles.panel}>
        <TexturePicker selected={fabric} onSelect={handleFabricSelect} />
        <View style={styles.divider} />
        <ColorPicker
          selected={color}
          onSelect={setColor}
          disabled={colorDisabled}
        />
      </View>
    </View>
  );
}

useGLTF.preload(SOFA_MODEL);

// ─── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5efe6",
  },

  // ── Panel ──
  panel: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e8e8e8",
    paddingTop: 14,
    paddingBottom: 28,
  },

  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 16,
    marginVertical: 12,
  },

  rowContent: {
    paddingHorizontal: 16,
    paddingRight: 24,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    marginBottom: 10,
    paddingHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  selectedNote: {
    color: "#222",
    fontWeight: "700",
    textTransform: "none",
  },

  disabledNote: {
    color: "#ccc",
    fontWeight: "400",
    textTransform: "none",
  },

  // ── Fabric swatch ──
  fabricItem: {
    alignItems: "center",
    marginRight: 14,
    width: 60,
  },

  fabricSwatch: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  swatchSelected: {
    borderColor: "#222",
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },

  fabricSwatchInner: {
    flex: 1,
  },

  multiDot: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },

  multiSlice: {
    width: "50%",
    height: "50%",
  },

  fabricLabel: {
    marginTop: 6,
    fontSize: 10,
    color: "#bbb",
    fontWeight: "500",
    textAlign: "center",
  },

  fabricLabelSelected: {
    color: "#222",
    fontWeight: "700",
  },

  // ── Color picker ──
  colorSection: {},

  sectionDisabled: {
    opacity: 0.4,
  },

  colorItem: {
    alignItems: "center",
    marginRight: 14,
    width: 44,
  },

  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },

  whiteBorder: {
    borderWidth: 1,
    borderColor: "#ddd",
  },

  colorDotSelected: {
    borderWidth: 3,
    borderColor: "#222",
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },

  colorDotDisabled: {
    opacity: 0.5,
  },

  colorLabel: {
    marginTop: 5,
    fontSize: 10,
    color: "#bbb",
    fontWeight: "500",
  },

  colorLabelSelected: {
    color: "#222",
    fontWeight: "700",
  },

  colorLabelDisabled: {
    color: "#ddd",
  },
});
