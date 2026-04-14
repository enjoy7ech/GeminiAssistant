<script setup lang="ts">
import { ref, nextTick, onUnmounted, watch, onMounted } from "vue";
import { gemini } from "../libs/GeminiService";
import { storage } from "../libs/StorageService";

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

const exportRes = ref({ w: 0, h: 0 });
const imgRef = ref<HTMLImageElement | null>(null);
const viewportRef = ref<HTMLElement | null>(null);

const savedPresets = ref<any[]>([]);
const newPresetName = ref("");

const CANVAS_SIZE = 1536;
const viewportScale = ref(1);

const updateViewportScale = () => {
  if (!viewportRef.value) return;
  const container = viewportRef.value;
  const size = Math.min(container.clientWidth, container.clientHeight) - 20;
  viewportScale.value = size / CANVAS_SIZE;
};

let overlayMouseDown = false;
const handleOverlayMouseDown = (e: MouseEvent) => {
  if (e.target === e.currentTarget) overlayMouseDown = true;
};
const handleOverlayMouseUp = (e: MouseEvent) => {
  if (e.target === e.currentTarget && overlayMouseDown) {
    emit("close");
  }
  overlayMouseDown = false;
};

const cropRatios = [
  { name: "自由", value: "free" },
  { name: "1:1", value: "1:1" },
  { name: "16:9", value: "16:9" },
  { name: "9:16", value: "9:16" },
  { name: "3:2", value: "3:2" },
  { name: "4:3", value: "4:3" },
];

let isDraggingBox = false;
let boxDragOffset = { x: 0, y: 0 };

const startBoxDrag = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest(".crop-handle")) return;
  e.stopPropagation();
  e.preventDefault();
  isDraggingBox = true;
  boxDragOffset = { x: e.clientX, y: e.clientY };
  window.addEventListener("mousemove", handleBoxDrag);
  window.addEventListener("mouseup", stopBoxDrag);
};

const handleBoxDrag = (e: MouseEvent) => {
  if (!isDraggingBox) return;
  const dx = (e.clientX - boxDragOffset.x) / viewportScale.value;
  const dy = (e.clientY - boxDragOffset.y) / viewportScale.value;

  // Convert stage pixels to percentages (0-1536)
  const dPercentX = (dx / CANVAS_SIZE) * 100;
  const dPercentY = (dy / CANVAS_SIZE) * 100;

  freeBox.value.left += dPercentX;
  freeBox.value.top += dPercentY;

  // Sync bounds
  if (freeBox.value.left < 0) freeBox.value.left = 0;
  if (freeBox.value.top < 0) freeBox.value.top = 0;
  if (freeBox.value.left + freeBox.value.width > 100)
    freeBox.value.left = 100 - freeBox.value.width;
  if (freeBox.value.top + freeBox.value.height > 100)
    freeBox.value.top = 100 - freeBox.value.height;

  boxDragOffset = { x: e.clientX, y: e.clientY };
};

const stopBoxDrag = () => {
  isDraggingBox = false;
  window.removeEventListener("mousemove", handleBoxDrag);
  window.removeEventListener("mouseup", stopBoxDrag);
};

// --- Interaction Handlers ---
const handleModalZoom = (e: WheelEvent) => {
  e.preventDefault();
  const stage = (e.currentTarget as HTMLElement).querySelector(
    ".workspace-stage",
  );
  if (!stage) return;

  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const oldScale = modalViewerState.value.scale;
  const newScale = Math.min(Math.max(oldScale * delta, 0.05), 50);

  // Get mouse position relative to the 1536px STAGE (accounting for viewportScale and centering)
  const stageRect = stage.getBoundingClientRect();
  const mouseXOnStage = (e.clientX - stageRect.left) / viewportScale.value;
  const mouseYOnStage = (e.clientY - stageRect.top) / viewportScale.value;

  // Pivot zoom on 1536 stage coordinates
  modalViewerState.value.x -=
    (mouseXOnStage - modalViewerState.value.x) * (newScale / oldScale - 1);
  modalViewerState.value.y -=
    (mouseYOnStage - modalViewerState.value.y) * (newScale / oldScale - 1);
  modalViewerState.value.scale = newScale;
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
  const dx = (e.clientX - modalLastPos.x) / viewportScale.value;
  const dy = (e.clientY - modalLastPos.y) / viewportScale.value;
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
  e.preventDefault();
  isResizing = true;
  resizeHandle = handle;
  modalLastPos = { x: e.clientX, y: e.clientY };
  window.addEventListener("mousemove", handleResize);
  window.addEventListener("mouseup", stopResize);
};

const handleResize = (e: MouseEvent) => {
  if (!isResizing) return;
  const container = document.querySelector(".ew-preview-column");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const dx = ((e.clientX - modalLastPos.x) / rect.width) * 100;
  const dy = ((e.clientY - modalLastPos.y) / rect.height) * 100;

  const box = { ...freeBox.value };

  if (modalActiveRatio.value === "free") {
    if (resizeHandle.includes("right")) box.width = Math.max(5, box.width + dx);
    if (resizeHandle.includes("bottom"))
      box.height = Math.max(5, box.height + dy);
    if (resizeHandle.includes("left")) {
      const change = Math.min(dx, box.width - 5);
      box.left += change;
      box.width -= change;
    }
    if (resizeHandle.includes("top")) {
      const change = Math.min(dy, box.height - 5);
      box.top += change;
      box.height -= change;
    }
  } else {
    // Ratio locked resize: Improved "Fixed Corner" logic
    const [rw, rh] = modalActiveRatio.value.split(":").map(Number);
    const aspect = rw / rh;
    const containerAspect = rect.width / rect.height;
    const scaleFactor = aspect / containerAspect; // Relationship: w% = h% * scaleFactor

    // 1. Identify the corner that should stay pinned based on the handle being dragged
    const pinX = resizeHandle.includes("left")
      ? box.left + box.width
      : box.left;
    const pinY = resizeHandle.includes("top") ? box.top + box.height : box.top;

    // 2. Calculate potential new dimensions
    let newW = box.width;
    let newH = box.height;

    if (resizeHandle.includes("left")) newW -= dx;
    else if (resizeHandle.includes("right")) newW += dx;

    if (resizeHandle.includes("top")) newH -= dy;
    else if (resizeHandle.includes("bottom")) newH += dy;

    // 3. Maintain Aspect Ratio (h% = w% / scaleFactor)
    // If we are dragging a horizontal side, width is primary.
    // If vertical, height is primary.
    // If a corner, pick the axis with more absolute movement.
    const isHorizontalOnly =
      resizeHandle === "left" || resizeHandle === "right";
    const isVerticalOnly = resizeHandle === "top" || resizeHandle === "bottom";
    const useWidthAsLead =
      isHorizontalOnly ||
      (!isVerticalOnly && Math.abs(dx) > Math.abs(dy * scaleFactor));

    if (useWidthAsLead) {
      newW = Math.max(5, newW);
      newH = newW / scaleFactor;
    } else {
      newH = Math.max(5, newH);
      newW = newH * scaleFactor;
    }

    // 4. Reposition based on the pinned corner
    if (resizeHandle.includes("left")) box.left = pinX - newW;
    else box.left = pinX;

    if (resizeHandle.includes("top")) box.top = pinY - newH;
    else box.top = pinY;

    box.width = newW;
    box.height = newH;
  }

  // Final bounds and parity check
  if (box.width + box.left > 100) {
    box.width = 100 - box.left;
    if (modalActiveRatio.value !== "free") {
      const [rw, rh] = modalActiveRatio.value.split(":").map(Number);
      box.height = box.width * (rect.width / rect.height / (rw / rh));
    }
  }
  if (box.height + box.top > 100) {
    box.height = 100 - box.top;
    if (modalActiveRatio.value !== "free") {
      const [rw, rh] = modalActiveRatio.value.split(":").map(Number);
      box.width = box.height * (rw / rh / (rect.width / rect.height));
    }
  }
  if (box.left < 0) box.left = 0;
  if (box.top < 0) box.top = 0;

  freeBox.value = box;
  modalLastPos = { x: e.clientX, y: e.clientY };
  updateExportRes();
};

const updateExportRes = () => {
  // Resolution ALWAYS follows the crop box — this is the single source of truth.
  exportRes.value.w = Math.round((freeBox.value.width / 100) * CANVAS_SIZE);
  exportRes.value.h = Math.round((freeBox.value.height / 100) * CANVAS_SIZE);
};

const handleResInput = (type: "w" | "h") => {
  // When user types a resolution, enforce ratio lock first
  if (modalActiveRatio.value !== "free") {
    const [rw, rh] = modalActiveRatio.value.split(":").map(Number);
    if (type === "w") {
      exportRes.value.h = Math.round(exportRes.value.w * (rh / rw));
    } else {
      exportRes.value.w = Math.round(exportRes.value.h * (rw / rh));
    }
  }

  // Then sync box from resolution (clamped to 100%)
  freeBox.value.width = Math.min(100, (exportRes.value.w / CANVAS_SIZE) * 100);
  freeBox.value.height = Math.min(100, (exportRes.value.h / CANVAS_SIZE) * 100);

  // Re-center the box
  freeBox.value.left = Math.max(0, (100 - freeBox.value.width) / 2);
  freeBox.value.top = Math.max(0, (100 - freeBox.value.height) / 2);
};

const stopResize = () => {
  isResizing = false;
  window.removeEventListener("mousemove", handleResize);
  window.removeEventListener("mouseup", stopResize);
};

// --- Presets Logic ---
const loadPresets = async () => {
  const all = await storage.getAll("resolution_presets");
  savedPresets.value = all;
};

const savePreset = async () => {
  if (!newPresetName.value.trim()) return;
  await storage.save("resolution_presets", newPresetName.value.trim(), {
    w: exportRes.value.w,
    h: exportRes.value.h,
    ratio: modalActiveRatio.value,
  });
  newPresetName.value = "";
  await loadPresets();
};

let skipRatioWatch = false;

const applyPreset = (preset: any) => {
  const targetW = preset.data.w;
  const targetH = preset.data.h;
  const storedRatio = preset.data.ratio || "free";

  // 1. Set ratio directly from stored value (suppress watcher)
  skipRatioWatch = true;
  modalActiveRatio.value = storedRatio;

  // 2. Derive box size from resolution: box% = resolution / 1536 * 100
  let boxW = (targetW / CANVAS_SIZE) * 100;
  let boxH = (targetH / CANVAS_SIZE) * 100;

  // If either axis exceeds 100%, scale both down proportionally
  if (boxW > 100 || boxH > 100) {
    const scale = Math.min(100 / boxW, 100 / boxH);
    boxW *= scale;
    boxH *= scale;
  }

  freeBox.value.width = boxW;
  freeBox.value.height = boxH;
  freeBox.value.left = (100 - boxW) / 2;
  freeBox.value.top = (100 - boxH) / 2;

  // 3. Resolution will be synced by updateExportRes (box% × 1536)
  // For resolutions that fit within 1536, this is exact.
  // For larger resolutions, the box is proportionally scaled down.
  updateExportRes();

  nextTick(() => {
    skipRatioWatch = false;
  });
};

const deletePreset = async (id: string) => {
  await storage.delete("resolution_presets", id);
  await loadPresets();
};

onMounted(() => {
  loadPresets();
  window.addEventListener("resize", updateViewportScale);
  updateViewportScale();
});

// Cleanup moved to end of script

const startExport = async () => {
  if (!imgRef.value) return;

  const res = await gemini.composeAndExport(
    imgRef.value,
    exportFormat.value,
    webpQuality.value,
    CANVAS_SIZE,
    modalViewerState.value,
    freeBox.value,
    exportRes.value,
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
      modalActiveRatio.value = "free";
      setTimeout(() => {
        updateViewportScale();
        // Auto-center image in 1536 canvas
        if (imgRef.value) {
          const img = imgRef.value;
          const s =
            Math.min(
              CANVAS_SIZE / img.naturalWidth,
              CANVAS_SIZE / img.naturalHeight,
            ) * 0.9;
          modalViewerState.value.scale = s;
          modalViewerState.value.x = (CANVAS_SIZE - img.naturalWidth * s) / 2;
          modalViewerState.value.y = (CANVAS_SIZE - img.naturalHeight * s) / 2;
        }
        updateExportRes();
      }, 100);
    }
  },
);

watch(modalActiveRatio, (ratio) => {
  if (skipRatioWatch) return;
  if (ratio === "free") return;
  const [rw, rh] = ratio.split(":").map(Number);
  const aspect = rw / rh;

  // freeBox % maps to the 1536×1536 SQUARE stage — no container correction needed.
  if (aspect >= 1) {
    freeBox.value.width = 80;
    freeBox.value.height = 80 / aspect;
  } else {
    freeBox.value.height = 80;
    freeBox.value.width = 80 * aspect;
  }
  freeBox.value.left = (100 - freeBox.value.width) / 2;
  freeBox.value.top = (100 - freeBox.value.height) / 2;
  updateExportRes();
});

// REMOVED: watch([freeBox], updateExportRes, { deep: true });

onUnmounted(() => {
  window.removeEventListener("resize", updateViewportScale);
  window.removeEventListener("mousemove", handleModalMove);
  window.removeEventListener("mouseup", stopModalDrag);
  window.removeEventListener("mousemove", handleResize);
  window.removeEventListener("mouseup", stopResize);
  window.removeEventListener("mousemove", handleBoxDrag);
  window.removeEventListener("mouseup", stopBoxDrag);
});
</script>

<template>
  <transition name="modal-fade">
    <div
      v-if="show"
      class="full-export-overlay"
      @mousedown="handleOverlayMouseDown"
      @mouseup="handleOverlayMouseUp"
    >
      <div class="export-workspace glass-panel">
        <div class="ew-header modal-header">
          <h3>裁切导出</h3>
          <button class="ew-close" @click="$emit('close')">×</button>
        </div>

        <div class="ew-body">
          <div
            class="ew-preview-column modal-preview-area"
            ref="viewportRef"
            @wheel="handleModalZoom"
            @mousedown="startModalDrag"
          >
            <div
              class="workspace-stage checkerboard-bg"
              :style="{
                width: CANVAS_SIZE + 'px',
                height: CANVAS_SIZE + 'px',
                transform: `scale(${viewportScale})`,
              }"
            >
              <img
                ref="imgRef"
                :src="src"
                draggable="false"
                @load="updateExportRes"
                @dragstart.prevent
                :style="{
                  transform: `translate(${modalViewerState.x}px, ${modalViewerState.y}px) scale(${modalViewerState.scale})`,
                }"
              />
              <div
                class="modal-crop-box"
                :style="{
                  top: freeBox.top + '%',
                  left: freeBox.left + '%',
                  width: freeBox.width + '%',
                  height: freeBox.height + '%',
                }"
              >
                <div class="crop-lines"></div>

                <!-- 4 edge handles for frame dragging -->
                <div
                  class="drag-handle-edge de-n"
                  @mousedown="startBoxDrag"
                ></div>
                <div
                  class="drag-handle-edge de-s"
                  @mousedown="startBoxDrag"
                ></div>
                <div
                  class="drag-handle-edge de-e"
                  @mousedown="startBoxDrag"
                ></div>
                <div
                  class="drag-handle-edge de-w"
                  @mousedown="startBoxDrag"
                ></div>

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
              </div>
            </div>
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
              <label>导出分辨率</label>
              <div class="res-input-container">
                <div class="res-field">
                  <input
                    type="number"
                    v-model.lazy="exportRes.w"
                    @change="handleResInput('w')"
                  />
                  <span>PX</span>
                </div>
                <div class="res-link">
                  <span v-if="modalActiveRatio !== 'free'">🔒</span>
                  <span v-else>🔗</span>
                </div>
                <div class="res-field">
                  <input
                    type="number"
                    v-model.lazy="exportRes.h"
                    @change="handleResInput('h')"
                  />
                  <span>PX</span>
                </div>
              </div>
              <p class="res-hint">调整裁切框或手动输入数值</p>

              <div class="presets-container">
                <div class="preset-save-row">
                  <input
                    v-model="newPresetName"
                    placeholder="存为预设 (如 A4)"
                    @keyup.enter="savePreset"
                  />
                  <button class="save-btn" @click="savePreset">保存</button>
                </div>
                <div class="preset-list" v-if="savedPresets.length">
                  <div
                    v-for="p in savedPresets"
                    :key="p.id"
                    class="preset-item"
                    @click="applyPreset(p)"
                  >
                    <div class="p-info">
                      <span class="p-name">{{ p.id }}</span>
                      <span class="p-res"
                        >{{ p.data.w }} × {{ p.data.h }} ·
                        {{ p.data.ratio || "自由" }}</span
                      >
                    </div>
                    <button class="p-del" @click.stop="deletePreset(p.id)">
                      ×
                    </button>
                  </div>
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

            <button class="start-export-btn" @click="startExport">导出</button>
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
  display: flex;
  height: 80vh;
  overflow: hidden;
}

.ew-preview-column {
  height: 100%;
  aspect-ratio: 1 / 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0c111d;
  padding: 0;
  flex-shrink: 0; /* Keep square */
}

.workspace-stage {
  background-color: #1e293b;
  flex-shrink: 0;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
  transform-origin: center center;
  overflow: hidden; /* STRICT CLIPPING */
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.workspace-stage img {
  pointer-events: all;
  cursor: grab;
  transform-origin: 0 0; /* Must match canvas drawImage which draws from top-left */
}
.workspace-stage img:active {
  cursor: grabbing;
}
.workspace-stage .modal-crop-box {
  pointer-events: none; /* Crucial: Let middle clicks through */
}

.preview-stage img {
  max-width: none;
  max-height: none;
  pointer-events: none;
  user-select: none;
}

.modal-crop-box {
  position: absolute;
  border: 2px solid #00f2fe;
  box-shadow: 0 0 0 4000px rgba(0, 0, 0, 0.4);
  z-index: 20;
  pointer-events: none; /* Allow clicking through center */
}

/* Specific drag handles for the box edges */
.drag-handle-edge {
  position: absolute;
  pointer-events: all;
  cursor: move;
}
.de-n {
  top: -10px;
  left: 0;
  right: 0;
  height: 20px;
}
.de-s {
  bottom: -10px;
  left: 0;
  right: 0;
  height: 20px;
}
.de-e {
  right: -10px;
  top: 0;
  bottom: 0;
  width: 20px;
}
.de-w {
  left: -10px;
  top: 0;
  bottom: 0;
  width: 20px;
}

.drag-handle-edge:hover {
  background: rgba(0, 242, 254, 0.1);
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
  width: 300px;
  overflow-y: auto;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 25px;
  flex-shrink: 0;
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

.res-input-container {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.res-field {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.res-field input {
  background: none;
  border: none;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  width: 100%;
  padding: 0;
  outline: none;
}
.res-field span {
  font-size: 0.65rem;
  color: #64748b;
  font-weight: 700;
}
.res-link {
  font-size: 1rem;
}
.res-hint {
  font-size: 0.7rem;
  color: #475569;
  margin-top: 8px;
}
.settings-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin: 5px 0;
}
.start-export-btn {
  margin-top: auto;
  background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
  border: none;
  border-radius: 15px;
  padding: 18px;
  color: #ffffff;
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
.presets-container {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.preset-save-row {
  display: flex;
  gap: 8px;
}
.preset-save-row input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 0.8rem;
  outline: none;
}
.preset-save-row .save-btn {
  background: rgba(0, 242, 254, 0.1);
  border: 1px solid rgba(0, 242, 254, 0.3);
  color: #00f2fe;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}
.preset-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  max-height: 150px;
  overflow-y: auto;
  padding-right: 4px;
}
.preset-list::-webkit-scrollbar {
  width: 4px;
}
.preset-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
.preset-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.preset-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}
.p-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.p-name {
  font-size: 0.75rem;
  color: #e2e8f0;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.p-res {
  font-size: 0.6rem;
  color: #64748b;
}
.p-del {
  background: none;
  border: none;
  color: #475569;
  font-size: 1rem;
  cursor: pointer;
  padding: 0 4px;
}
.p-del:hover {
  color: #ef4444;
}
</style>
