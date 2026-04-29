import { GLView } from "expo-gl";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      out[j * 4 + i] =
        a[i] * b[j * 4] +
        a[i + 4] * b[j * 4 + 1] +
        a[i + 8] * b[j * 4 + 2] +
        a[i + 12] * b[j * 4 + 3];
  return out;
}

// Perspective projection matrix
function mat4Perspective(fovY, aspect, near, far) {
  const f = 1.0 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * nf,
    -1,
    0,
    0,
    2 * far * near * nf,
    0,
  ]);
}

// Translation matrix
function mat4Translate(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

// Rotation around X axis
function mat4RotateX(angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

// Rotation around Y axis
function mat4RotateY(angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

// ─── Shaders ──────────────────────────────────────────────────────────────────

const VERT_SHADER = `
  precision mediump float;
  attribute vec3 aPosition;
  attribute vec3 aColor;
  varying vec3 vColor;
  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;
  void main() {
    vColor = aColor;
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
`;

const FRAG_SHADER = `
  precision mediump float;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

// ─── Cube Geometry ─────────────────────────────────────────────────────────────
//  Each face = 4 vertices, 6 faces = 24 vertices
//  Format: x, y, z,  r, g, b

const CUBE_VERTICES = new Float32Array([
  // Front face  (red)
  -1, -1, 1, 1, 0, 0, 1, -1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, -1, 1, 1, 1, 0, 0,
  // Back face   (green)
  -1, -1, -1, 0, 1, 0, -1, 1, -1, 0, 1, 0, 1, 1, -1, 0, 1, 0, 1, -1, -1, 0, 1,
  0,
  // Top face    (blue)
  -1, 1, -1, 0, 0, 1, -1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, -1, 0, 0, 1,
  // Bottom face (yellow)
  -1, -1, -1, 1, 1, 0, 1, -1, -1, 1, 1, 0, 1, -1, 1, 1, 1, 0, -1, -1, 1, 1, 1,
  0,
  // Right face  (cyan)
  1, -1, -1, 0, 1, 1, 1, 1, -1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, -1, 1, 0, 1, 1,
  // Left face   (magenta)
  -1, -1, -1, 1, 0, 1, -1, -1, 1, 1, 0, 1, -1, 1, 1, 1, 0, 1, -1, 1, -1, 1, 0,
  1,
]);

// Indices — 2 triangles per face × 6 faces = 36 indices
const CUBE_INDICES = new Uint16Array([
  0,
  1,
  2,
  0,
  2,
  3, // front
  4,
  5,
  6,
  4,
  6,
  7, // back
  8,
  9,
  10,
  8,
  10,
  11, // top
  12,
  13,
  14,
  12,
  14,
  15, // bottom
  16,
  17,
  18,
  16,
  18,
  19, // right
  20,
  21,
  22,
  20,
  22,
  23, // left
]);

export default function HomeScreen() {
  let animFrame;

  const onContextCreate = (gl) => {
    const { drawingBufferWidth: W, drawingBufferHeight: H } = gl;

    // ── Compile Shaders ──────────────────────────────────────────
    function compileShader(type, src) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        console.error("Shader error:", gl.getShaderInfoLog(shader));
      return shader;
    }

    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, VERT_SHADER));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, FRAG_SHADER));
    gl.linkProgram(program);
    gl.useProgram(program);

    // ── Upload Geometry ──────────────────────────────────────────
    // Vertex buffer
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, CUBE_VERTICES, gl.STATIC_DRAW);

    // Index buffer
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, CUBE_INDICES, gl.STATIC_DRAW);

    // stride = 6 floats × 4 bytes = 24 bytes
    const stride = 24;

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);

    const aColor = gl.getAttribLocation(program, "aColor");
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 12); // offset 12 bytes

    // ── Uniform Locations ────────────────────────────────────────
    const uModel = gl.getUniformLocation(program, "uModel");
    const uView = gl.getUniformLocation(program, "uView");
    const uProjection = gl.getUniformLocation(program, "uProjection");

    // ── Static Matrices ──────────────────────────────────────────
    // Perspective: 60° FOV, near=0.1, far=100
    const projection = mat4Perspective(Math.PI / 3, W / H, 0.1, 100);
    gl.uniformMatrix4fv(uProjection, false, projection);

    // Camera: pull back 5 units on Z axis
    const view = mat4Translate(0, 0, -5);
    gl.uniformMatrix4fv(uView, false, view);

    // ── GL State ─────────────────────────────────────────────────
    gl.enable(gl.DEPTH_TEST); // closer faces hide farther faces
    gl.viewport(0, 0, W, H);

    // ── Animation Loop ───────────────────────────────────────────
    let angle = 0;

    const render = () => {
      animFrame = requestAnimationFrame(render);
      angle += 0.01; // rotation speed

      // Rotate around both X and Y axes for nice 3D spin
      const rotY = mat4RotateY(angle);
      const rotX = mat4RotateX(angle * 0.5);
      const model = mat4Multiply(rotX, rotY);
      gl.uniformMatrix4fv(uModel, false, model);

      // Clear screen
      gl.clearColor(0.08, 0.08, 0.12, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Draw cube (36 indices)
      gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

      // ⚠️ Required by expo-gl — present the frame
      gl.endFrameEXP();
    };

    render();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>3D Rotating Cube</Text>
      <Text style={styles.subtitle}>Built with expo-gl raw WebGL</Text>
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
      <Text style={styles.info}>
        6 faces · Perspective camera · Depth testing
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08080C",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  subtitle: {
    color: "#888",
    fontSize: 13,
  },
  glView: {
    width: 320,
    height: 320,
    borderRadius: 16,
    overflow: "hidden",
  },
  info: {
    color: "#555",
    fontSize: 12,
  },
});
