<script setup lang="ts">
import { ref, onUnmounted, watch } from "vue";
import { gemini } from "../libs/GeminiService";

const props = defineProps<{
  show: boolean;
  src: string;
  type: string;
  initialQuality?: number;
}>();

const emit = defineEmits(["close", "success"]);

// --- State ---
const exportFormat = ref("png");
const webpQuality = ref(props.initialQuality || 0.85);

const modalActiveRatio = ref("free");
const modalViewerState = ref({ x: 0, y: 0, scale: 1 });
const freeBox = ref({ top: 10, left: 10, width: 80, height: 80 }); // Percentages

const cropRatios = [
  { name: "自由", value: "free" },
  { name: "1:1", value: "1:1" },
  { name: "16:9", value: "16:9" },
  { name: "9:16", value: "9:16" },
  { name: "3:2", value: "3:2" },
  { name: "4:3", value: "4:3" },
];

// --- Interaction Handlers ---
const handleModalZoom = (e: WheelEvent) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  modalViewerState.value.scale = Math.min(
    Math.max(modalViewerState.value.scale * delta, 0.1),
    10,
  );
};

let modalIsDragging = false;
let modalLastPos = { x: 0, y: 0 };

const startModalDrag = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest(".crop-handle")) return;
  e.preventDefault(); // Prevent native drag and selection
  modalIsDragging = true;
  modalLastPos = { x: e.clientX, y: e.clientY };
  window.addEventListener("mousemove", handleModalMove);
  window.addEventListener("mouseup", stopModalDrag);
};

const handleModalMove = (e: MouseEvent) => {
  if (!modalIsDragging) return;
  const dx = e.clientX - modalLastPos.x;
  const dy = e.clientY - modalLastPos.y;
  modalViewerState.value.x += dx;
  modalViewerState.value.y += dy;
  modalLastPos = { x: e.clientX, y: e.clientY };
};

const stopModalDrag = () => {
  modalIsDragging = false;
  window.removeEventListener("mousemove", handleModalMove);
  window.removeEventListener("mouseup", stopModalDrag);
};

// --- Resize Logic ---
let isResizing = false;
let resizeHandle = "";

const startResize = (handle: string, e: MouseEvent) => {
  e.stopPropagation();
  isResizing = true;
  resizeHandle = handle;
  modalLastPos = { x: e.clientX, y: e.clientY };
  window.addEventListener("mousemove", handleResize);
  window.addEventListener("mouseup", stopResize);
};

const handleResize = (e: MouseEvent) => {
  if (!isResizing) return;
  const container = document.querySelector(".modal-preview-area");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const dx = ((e.clientX - modalLastPos.x) / rect.width) * 100;
  const dy = ((e.clientY - modalLastPos.y) / rect.height) * 100;

  if (resizeHandle.includes("right"))
    freeBox.value.width = Math.max(10, freeBox.value.width + dx);
  if (resizeHandle.includes("bottom"))
    freeBox.value.height = Math.max(10, freeBox.value.height + dy);
  if (resizeHandle.includes("left")) {
    const change = Math.min(dx, freeBox.value.width - 10);
    freeBox.value.left += change;
    freeBox.value.width -= change;
  }
  if (resizeHandle.includes("top")) {
    const change = Math.min(dy, freeBox.value.height - 10);
    freeBox.value.top += change;
    freeBox.value.height -= change;
  }
  modalLastPos = { x: e.clientX, y: e.clientY };
};

const stopResize = () => {
  isResizing = false;
  window.removeEventListener("mousemove", handleResize);
  window.removeEventListener("mouseup", stopResize);
};

// --- Calculation & Export ---
const calculateFinalCrop = () => {
  const container = document.querySelector(".modal-preview-area");
  const img = container?.querySelector("img");
  const cropBox = container?.querySelector(".modal-crop-box");
  if (!img || !cropBox) return null;
  const imgRect = img.getBoundingClientRect();
  const boxRect = cropBox.getBoundingClientRect();
  const scale = img.naturalWidth / imgRect.width;
  return {
    x: (boxRect.left - imgRect.left) * scale,
    y: (boxRect.top - imgRect.top) * scale,
    width: boxRect.width * scale,
    height: boxRect.height * scale,
  };
};

const startExport = async () => {
  const crop = calculateFinalCrop();
  const res = await gemini.convertImage(
    props.src,
    exportFormat.value,
    webpQuality.value,
    crop,
  );
  const link = document.createElement("a");
  link.href = res.url;
  link.download = `gemini-export-${Date.now()}.${exportFormat.value}`;
  link.click();
  emit("success");
  emit("close");
};

// Reset relative state when opening
watch(
  () => props.show,
  (show) => {
    if (show) {
      modalViewerState.value = { x: 0, y: 0, scale: 1 };
      freeBox.value = { top: 10, left: 10, width: 80, height: 80 };
    }
  },
);

onUnmounted(() => {
  window.removeEventListener("mousemove", handleModalMove);
  window.removeEventListener("mouseup", stopModalDrag);
  window.removeEventListener("mousemove", handleResize);
  window.removeEventListener("mouseup", stopResize);
});
</script>

<template>
  <transition name="modal-fade">
    <div v-if="show" class="full-export-overlay" @click.self="$emit('close')">
      <div class="export-workspace glass-panel">
        <div class="ew-header">
          <div class="ew-title">
            <span class="icon">🖼️</span>
            <h2>裁切导出（缩放不会影响质量）</h2>
          </div>
          <button class="ew-close" @click="$emit('close')">×</button>
        </div>

        <div class="ew-body">
          <div
            class="ew-preview-column checkerboard-bg modal-preview-area"
            @wheel="handleModalZoom"
            @mousedown="startModalDrag"
          >
            <div class="preview-stage">
              <img
                :src="src"
                draggable="false"
                @dragstart.prevent
                :style="{
                  transform: `translate(${modalViewerState.x}px, ${modalViewerState.y}px) scale(${modalViewerState.scale})`,
                }"
              />
              <div
                class="modal-crop-box"
                :class="[
                  'ratio-' + modalActiveRatio.replace(':', '-'),
                  { 'is-free': modalActiveRatio === 'free' },
                ]"
                :style="
                  modalActiveRatio === 'free'
                    ? {
                        top: freeBox.top + '%',
                        left: freeBox.left + '%',
                        width: freeBox.width + '%',
                        height: freeBox.height + '%',
                      }
                    : {}
                "
              >
                <div class="crop-lines"></div>
                <template v-if="modalActiveRatio === 'free'">
                  <div
                    class="crop-handle nw"
                    @mousedown="startResize('top-left', $event)"
                  ></div>
                  <div
                    class="crop-handle n"
                    @mousedown="startResize('top', $event)"
                  ></div>
                  <div
                    class="crop-handle ne"
                    @mousedown="startResize('top-right', $event)"
                  ></div>
                  <div
                    class="crop-handle e"
                    @mousedown="startResize('right', $event)"
                  ></div>
                  <div
                    class="crop-handle se"
                    @mousedown="startResize('bottom-right', $event)"
                  ></div>
                  <div
                    class="crop-handle s"
                    @mousedown="startResize('bottom', $event)"
                  ></div>
                  <div
                    class="crop-handle sw"
                    @mousedown="startResize('bottom-left', $event)"
                  ></div>
                  <div
                    class="crop-handle w"
                    @mousedown="startResize('left', $event)"
                  ></div>
                </template>
              </div>
            </div>
            <div class="preview-hint">滚轮缩放 / 拖拽图片对齐裁切框</div>
          </div>

          <div class="ew-settings-column">
            <div class="settings-section">
              <label>目标宽高比</label>
              <div class="ratio-grid">
                <div
                  v-for="r in cropRatios"
                  :key="r.value"
                  class="ratio-card"
                  :class="{ active: modalActiveRatio === r.value }"
                  @click="modalActiveRatio = r.value"
                >
                  <span>{{ r.name }}</span>
                </div>
              </div>
            </div>

            <div class="settings-divider"></div>

            <div class="settings-section">
              <label>导出格式</label>
              <div class="format-toggle">
                <button
                  v-for="fmt in ['webp', 'png', 'jpg']"
                  :key="fmt"
                  :class="{ active: exportFormat === fmt }"
                  @click="exportFormat = fmt"
                >
                  {{ fmt.toUpperCase() }}
                </button>
              </div>
            </div>

            <div class="settings-section" v-if="exportFormat !== 'png'">
              <div class="slider-header">
                <span>图片质量</span>
                <span class="value">{{ Math.round(webpQuality * 100) }}%</span>
              </div>
              <input
                type="range"
                v-model.number="webpQuality"
                min="0.1"
                max="1.0"
                step="0.05"
                class="neon-slider"
              />
            </div>

            <div class="flex-spacer"></div>

            <button class="start-export-btn" @click="startExport">
              🚀 确认并完成导出
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.full-export-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(15px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.export-workspace {
  width: 100%;
  max-width: 1400px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 40px 100px rgba(0, 0, 0, 0.8);
  border-radius: 24px;
  background: #0f172a;
}

.ew-header {
  padding: 20px 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.02);
}

.ew-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ew-title h2 {
  font-size: 1.1rem;
  font-weight: 600;
  background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.ew-close {
  background: none;
  border: none;
  color: #64748b;
  font-size: 2rem;
  cursor: pointer;
  transition: color 0.2s;
  line-height: 1;
}
.ew-close:hover {
  color: #fff;
}

.ew-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.ew-preview-column {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1e293b;
}

.preview-stage {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
}
.preview-stage:active {
  cursor: grabbing;
}

.preview-stage img {
  max-width: none;
  max-height: none;
  pointer-events: none;
  user-select: none;
}

.modal-crop-box {
  position: absolute;
  pointer-events: none;
  border: 2px solid #00f2fe;
  z-index: 20;
}

.ratio-free {
  border-style: dashed;
  pointer-events: all;
}
.ratio-1-1 {
  width: min(80%, 450px);
  aspect-ratio: 1/1;
}
.ratio-16-9 {
  width: 85%;
  aspect-ratio: 16/9;
}
.ratio-9-16 {
  height: 85%;
  aspect-ratio: 9/16;
}
.ratio-3-2 {
  width: 85%;
  aspect-ratio: 3/2;
}
.ratio-4-3 {
  width: 80%;
  aspect-ratio: 4/3;
}

.modal-crop-box.is-free {
  pointer-events: all;
  border-style: dashed;
}

.crop-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #00f2fe;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: all;
  z-index: 25;
}
.nw {
  top: -6px;
  left: -6px;
  cursor: nw-resize;
}
.n {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}
.ne {
  top: -6px;
  right: -6px;
  cursor: ne-resize;
}
.e {
  top: 50%;
  right: -6px;
  transform: translateY(-50%);
  cursor: e-resize;
}
.se {
  bottom: -6px;
  right: -6px;
  cursor: se-resize;
}
.s {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}
.sw {
  bottom: -6px;
  left: -6px;
  cursor: sw-resize;
}
.w {
  top: 50%;
  left: -6px;
  transform: translateY(-50%);
  cursor: w-resize;
}

.preview-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.75rem;
  color: #94a3b8;
  pointer-events: none;
  backdrop-filter: blur(4px);
  z-index: 30;
}

.ew-settings-column {
  width: 340px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.settings-section label {
  display: block;
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.ratio-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.ratio-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.ratio-card span {
  font-size: 0.8rem;
  color: #cbd5e1;
}
.ratio-card:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}
.ratio-card.active {
  background: rgba(0, 242, 254, 0.15);
  border-color: #00f2fe;
}
.ratio-card.active span {
  color: #00f2fe;
  font-weight: 600;
}

.format-toggle {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 12px;
}
.format-toggle button {
  flex: 1;
  background: none;
  border: none;
  color: #64748b;
  padding: 10px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 9px;
  transition: all 0.2s;
}
.format-toggle button.active {
  background: #1e293b;
  color: #00f2fe;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.slider-header span {
  font-size: 0.8rem;
  color: #94a3b8;
}
.slider-header .value {
  color: #00f2fe;
  font-weight: 700;
}

.start-export-btn {
  background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
  border: none;
  border-radius: 15px;
  padding: 18px;
  color: #060b14;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0, 242, 254, 0.2);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.start-export-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 15px 40px rgba(0, 242, 254, 0.4);
}
.start-export-btn:active {
  transform: scale(0.98);
}

.flex-spacer {
  flex: 1;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.4s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.ew-preview-column.checkerboard-bg {
  background-image:
    linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  background-color: #ffffff;
}
</style>
