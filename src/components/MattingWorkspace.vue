<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  imageUrl: string;
  originalImageUrl: string;
  tolerance: number;
  smoothing: number;
  isContiguous: boolean;
  targetColor: { r: number; g: number; b: number };
  erosion: number;
  feathering: number;
  viewerState: any;
  showActions?: boolean;
  hideFloatingControl?: boolean;
}>();

const emit = defineEmits([
  "update:tolerance",
  "update:smoothing",
  "update:targetColor",
  "update:erosion",
  "update:feathering",
  "update:isContiguous",
  "update-matting",
  "reset-viewer",
  "handle-zoom",
  "start-drag",
  "prepare-export",
]);

const isPickingColor = ref(false);

const pickColor = (e: MouseEvent) => {
  if (!isPickingColor.value) return;
  const img = e.target as HTMLImageElement;
  const rect = img.getBoundingClientRect();
  const x = Math.floor(
    Math.max(
      0,
      Math.min(
        img.naturalWidth - 1,
        (e.clientX - rect.left) * (img.naturalWidth / rect.width),
      ),
    ),
  );
  const y = Math.floor(
    Math.max(
      0,
      Math.min(
        img.naturalHeight - 1,
        (e.clientY - rect.top) * (img.naturalHeight / rect.height),
      ),
    ),
  );

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const pixel = ctx.getImageData(x, y, 1, 1).data;

  emit("update:targetColor", { r: pixel[0], g: pixel[1], b: pixel[2] });
  isPickingColor.value = false;
  e.stopPropagation();
  emit("update-matting");
};

const onToleranceUpdate = (e: Event) => {
  emit("update:tolerance", parseFloat((e.target as HTMLInputElement).value));
  emit("update-matting");
};

const onErosionUpdate = (e: Event) => {
  emit("update:erosion", parseInt((e.target as HTMLInputElement).value));
  emit("update-matting");
};
const onFeatheringUpdate = (e: Event) => {
  emit("update:feathering", parseFloat((e.target as HTMLInputElement).value));
  emit("update-matting");
};
</script>

<template>
  <div class="matting-workspace">
    <div class="workspace-split-inner">
      <!-- Source View (Left) -->
      <div v-if="originalImageUrl" class="image-viewer-card source-viewer">
        <div class="viewer-header">
          <div class="vh-top">
            <span class="v-tag">源文件</span>
            <div class="v-actions" v-if="showActions">
              <button
                class="v-mini-btn"
                @click="$emit('reset-viewer', 'original')"
              >
                重置
              </button>
              <button
                class="v-mini-btn"
                @click="$emit('prepare-export', originalImageUrl, 'original')"
              >
                导出
              </button>
            </div>
          </div>
        </div>
        <div
          class="viewer-body"
          @wheel="$emit('handle-zoom', 'original', $event)"
          @mousedown="
            !isPickingColor && $emit('start-drag', 'original', $event)
          "
        >
          <img
            :src="originalImageUrl"
            draggable="false"
            :style="{
              transform: `translate(${viewerState.original.x}px, ${viewerState.original.y}px) scale(${viewerState.original.scale})`,
              cursor: isPickingColor ? 'crosshair' : 'grab',
            }"
            alt="Original"
            @click.stop="pickColor"
          />
        </div>
      </div>

      <!-- Floating Tool Panel -->
      <div
        v-if="originalImageUrl && !hideFloatingControl"
        class="tolerance-control glass-panel"
      >
        <div class="tc-top-row">
          <div
            class="tc-color-picker"
            @click="isPickingColor = !isPickingColor"
            :class="{ active: isPickingColor }"
          >
            <div
              class="color-preview"
              :style="{
                backgroundColor: `rgb(${targetColor.r}, ${targetColor.g}, ${targetColor.b})`,
              }"
            ></div>
            <div class="color-value">
              {{ isPickingColor ? "正在取色..." : "吸管取色" }}
            </div>
          </div>

          <div class="tc-divider"></div>
          <label class="tc-check">
            <input
              type="checkbox"
              :checked="isContiguous"
              @change="
                $emit(
                  'update:isContiguous',
                  ($event.target as HTMLInputElement).checked,
                );
                $emit('update-matting');
              "
            />
            <span>连续</span>
          </label>
        </div>

        <div class="tc-slider">
          <label
            >容差
            <span class="highlight-cyan">{{
              tolerance.toFixed(2)
            }}</span></label
          >
          <input
            type="range"
            :value="tolerance"
            @input="onToleranceUpdate"
            min="0.01"
            max="2.0"
            step="0.01"
          />
        </div>
        <div class="tc-slider">
          <label
            >腐蚀 <span class="highlight-cyan">{{ erosion }}</span></label
          >
          <input
            type="range"
            :value="erosion"
            @input="onErosionUpdate"
            min="0"
            max="20"
            step="1"
          />
        </div>
        <div class="tc-slider">
          <label
            >羽化
            <span class="highlight-cyan">{{
              feathering.toFixed(1)
            }}</span></label
          >
          <input
            type="range"
            :value="feathering"
            @input="onFeatheringUpdate"
            min="0"
            max="15"
            step="0.1"
          />
        </div>
        <div class="tc-slider">
          <label
            >平滑
            <span class="highlight-cyan">{{
              smoothing.toFixed(2)
            }}</span></label
          >
          <input
            type="range"
            :value="smoothing"
            @input="
              $emit(
                'update:smoothing',
                parseFloat(($event.target as HTMLInputElement).value),
              );
              $emit('update-matting');
            "
            min="0"
            max="1"
            step="0.01"
          />
        </div>
      </div>

      <!-- Result View (Right) -->
      <div class="image-viewer-card result-viewer">
        <div v-if="imageUrl" class="workspace-right-wrap">
          <div class="viewer-header">
            <div class="vh-top">
              <span class="v-tag">预览</span>
              <div class="v-actions" v-if="showActions">
                <button
                  class="v-mini-btn"
                  @click="$emit('reset-viewer', 'processed')"
                >
                  重置
                </button>
                <button
                  class="v-mini-btn highlight"
                  @click="$emit('prepare-export', imageUrl, 'processed')"
                >
                  导出
                </button>
              </div>
            </div>
          </div>
          <div
            class="viewer-body checkerboard-bg"
            @wheel="$emit('handle-zoom', 'processed', $event)"
            @mousedown="$emit('start-drag', 'processed', $event)"
          >
            <img
              :src="imageUrl"
              draggable="false"
              :style="{
                transform: `translate(${viewerState.processed.x}px, ${viewerState.processed.y}px) scale(${viewerState.processed.scale})`,
              }"
              alt="Processed"
            />
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="loading-full-static">
            <div class="empty-icon">🖼️</div>
            <p>等待分析图像数据...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.matting-workspace {
  flex: 1;
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
.workspace-split-inner {
  display: flex;
  width: 100%;
  height: 100%;
}

.tolerance-control.cropping-mode {
  padding-bottom: 12px;
}
.crop-ratio-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: auto;
}
.ratio-item {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.ratio-item:hover {
  background: rgba(26, 115, 232, 0.2);
}
.ratio-item.active {
  background: #1a73e8;
  border-color: #1a73e8;
  color: white;
}
.tc-crop-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}
.tc-crop-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}
.tc-crop-toggle.active {
  background: #1a73e8;
  color: white;
}

/* Crop Overlay */
.viewer-body {
  position: relative;
  overflow: hidden;
}
.crop-frame-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}
.crop-box {
  border: 1.5px solid #1a73e8;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
  position: relative;
}
.crop-box::after {
  content: "";
  position: absolute;
  inset: -1.5px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 15px rgba(26, 115, 232, 0.3);
}

.ratio-free {
  width: 80%;
  height: 80%;
  border-style: dashed;
}
.ratio-1-1 {
  width: min(80%, 400px);
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
.workspace-split-inner {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 16px;
  width: 100%;
  height: 100%;
}

.image-viewer-card {
  flex: 1;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.workspace-right-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.viewer-header {
  padding: 12px 16px;
  background: rgba(15, 20, 31, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  z-index: 5;
}
.vh-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.v-tag {
  font-size: 0.65rem;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: 800;
}

.v-mini-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  transition: 0.2s;
}
.v-mini-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.v-mini-btn.highlight {
  border-color: rgba(0, 255, 242, 0.3);
  color: var(--primary-cyan);
}

.viewer-body {
  flex: 1;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}
.viewer-body:active {
  cursor: grabbing;
}
.viewer-body img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: auto;
}

.checkerboard-bg {
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

.tolerance-control {
  position: absolute;
  left: 24px;
  bottom: 24px;
  width: 280px;
  background: rgba(10, 15, 25, 0.85);
  backdrop-filter: blur(20px);
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 100;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.6);
}

.tc-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 12px;
}
.tc-color-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.04);
  padding: 6px 12px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: 0.2s;
}
.tc-color-picker.active {
  border-color: var(--primary-cyan);
  background: rgba(0, 255, 242, 0.05);
  color: #fff;
}
.color-preview {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.tc-slider {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tc-slider label {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 800;
  display: flex;
  justify-content: space-between;
}
.tc-slider input[type="range"] {
  margin: 0;
}

.tc-check {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 700;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.loading-full-static {
  text-align: center;
  color: #334155;
}
.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.1;
}
</style>
