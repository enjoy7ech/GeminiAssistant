<script setup lang="ts">
import { ref, watch } from "vue";
import NeuralLoading from "./NeuralLoading.vue";
import ModelDropdown from "./ModelDropdown.vue";
import MattingWorkspace from "./MattingWorkspace.vue";
import GeminiWelcome from "./GeminiWelcome.vue";
import DrawingBoard from "./DrawingBoard.vue";

const props = defineProps<{
  prefix: string;
  prompt: string;
  isLoading: boolean;
  imageUrl: string;
  originalImageUrl: string;
  useGreenScreen: boolean;
  currentModel: string;
  allModels: any[];
  presets: any[];
  activePresetId: string;
  tolerance: number;
  smoothing: number;
  webpQuality: number;
  isContiguous: boolean;
  viewerState: any;
  targetColor: { r: number; g: number; b: number };
  erosion: number;
  feathering: number;
  sessions: any[];
  activeSessionId: string;
  inputImageUrls?: string[];
}>();

const emit = defineEmits([
  "update:prefix",
  "update:prompt",
  "update:useGreenScreen",
  "update:currentModel",
  "update:activePresetId",
  "update:tolerance",
  "update:smoothing",
  "update:webpQuality",
  "update:isContiguous",
  "update:targetColor",
  "update:erosion",
  "update:feathering",
  "update-matting",
  "generate",
  "reset-viewer",
  "handle-zoom",
  "start-drag",
  "add-preset",
  "remove-preset",
  "prepare-webp",
  "select-session",
  "delete-session",
  "rename-session",
  "update:inputImageUrls",
  "continue-generate",
  "update:originalImageUrl",
]);

const applyPreset = (p: any) => {
  emit("update:prefix", p.prompt);
  emit("update:activePresetId", p.id);
};

const fileInput = ref<HTMLInputElement | null>(null);
const activeModel = ref(props.currentModel);
watch(
  () => activeModel.value,
  (v) => emit("update:currentModel", v),
);
watch(
  () => props.currentModel,
  (v) => (activeModel.value = v),
);

const onPickColor = (color: { r: number; g: number; b: number }) => {
  emit("update:targetColor", color);
  emit("update-matting");
};

// Session Management logic (same as TextAssistant)
const editingSessionId = ref("");
const editingTitle = ref("");

const startEdit = (s: any) => {
  editingSessionId.value = s.id;
  editingTitle.value = s.title;
};

const finishEdit = () => {
  if (editingTitle.value && editingTitle.value.trim()) {
    emit("rename-session", editingSessionId.value, editingTitle.value.trim());
  }
  editingSessionId.value = "";
};

const handleDeleteSession = (s: any) => {
  emit("delete-session", s.id);
};

const isDrawingModalOpen = ref(false);
const currentImageIdx = ref(0);

const selectImage = (idx: number) => {
  currentImageIdx.value = idx;
};

const clearUpload = (index: number) => {
  const newUrls = [...(props.inputImageUrls || [])];
  newUrls.splice(index, 1);
  emit("update:inputImageUrls", newUrls);

  // Adjust current index
  if (currentImageIdx.value >= newUrls.length) {
    currentImageIdx.value = Math.max(0, newUrls.length - 1);
  }
};

const handleFileUpload = (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;

  const currentUrls = [...(props.inputImageUrls || [])];
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentUrls.push(ev.target?.result as string);
      if (
        currentUrls.length ===
        (props.inputImageUrls?.length || 0) + files.length
      ) {
        emit("update:inputImageUrls", currentUrls);
        currentImageIdx.value = currentUrls.length - 1;
      }
    };
    reader.readAsDataURL(file);
  });
};

// Continue / In-paint Dialog State
const continuePrompt = ref("");
const continueImageUrl = ref("");
const continueLayers = ref<any[]>([]);
const isInpaintMode = ref(false);

const openInpaintDraw = () => {
  isInpaintMode.value = true;
  isDrawingModalOpen.value = true;
};

const handleHandDraw = (dataUrl: string, layers?: any[]) => {
  if (isInpaintMode.value) {
    continueImageUrl.value = dataUrl;
    if (layers) continueLayers.value = layers;

    // Explicitly update parent's original image to trigger matting
    emit("update:originalImageUrl", dataUrl);
    emit("update-matting");
  } else {
    const newUrls = [...(props.inputImageUrls || []), dataUrl];
    emit("update:inputImageUrls", newUrls);
    currentImageIdx.value = newUrls.length - 1;
  }
  isDrawingModalOpen.value = false;
  isInpaintMode.value = false;
};

const handleContinueSend = () => {
  if (!continuePrompt.value) return;
  emit("continue-generate", {
    prompt: continuePrompt.value,
    editedImage: continueImageUrl.value,
  });
  continuePrompt.value = "";
  continueImageUrl.value = "";
};
</script>

<template>
  <div class="tool-columns">
    <!-- Sidebar Controls -->
    <div class="control-col">
      <div class="card glass-card">
        <div class="model-select-group">
          <label>生成模型</label>
          <ModelDropdown v-model="activeModel" :options="allModels" />
        </div>

        <div class="presets-section">
          <div class="section-header">
            <label>生图风格</label>
            <button @click="$emit('add-preset')">+ 新增</button>
          </div>
          <div class="preset-chips">
            <div
              v-for="p in presets"
              :key="p.id"
              class="chip"
              :class="{ active: activePresetId === p.id }"
              @click="applyPreset(p)"
            >
              <span>{{ p.icon }} {{ p.name }}</span>
              <i class="chip-close" @click.stop="$emit('remove-preset', p.id)"
                >×</i
              >
            </div>
          </div>
        </div>

        <div class="upload-section gallery-mode">
          <div class="section-header">
            <label
              >参考图片 (Optional)
              <span v-if="inputImageUrls?.length"
                >({{ inputImageUrls.length }})</span
              ></label
            >
            <div class="header-actions">
              <button
                class="mini-btn"
                @click="fileInput?.click()"
                title="上传图片"
              >
                📂
              </button>
              <button
                class="mini-btn"
                @click="
                  isDrawingModalOpen = true;
                  isInpaintMode = false;
                "
                title="手绘草图"
              >
                🎨
              </button>
            </div>
          </div>

          <div class="main-preview" v-if="inputImageUrls?.length">
            <img
              :src="inputImageUrls[currentImageIdx] || inputImageUrls[0]"
              class="big-preview"
            />
            <button
              class="remove-current-btn"
              @click="clearUpload(currentImageIdx)"
            >
              ×
            </button>
          </div>
          <div
            v-else
            class="upload-placeholder-empty"
            @click="fileInput?.click()"
          >
            <span class="icon">🖼️</span>
            <span>暂无参考图，点击添加</span>
          </div>

          <div class="thumb-tabs" v-if="inputImageUrls?.length">
            <div
              v-for="(url, idx) in inputImageUrls"
              :key="idx"
              class="thumb-tab"
              :class="{ active: currentImageIdx === idx }"
              @click="selectImage(idx)"
            >
              <img :src="url" />
            </div>
          </div>

          <input
            type="file"
            ref="fileInput"
            hidden
            multiple
            accept="image/*"
            @change="handleFileUpload"
          />
        </div>

        <div class="prompt-fields">
          <div class="input-field">
            <label>预设风格 (Prefix)</label>
            <input
              :value="prefix"
              @input="
                $emit(
                  'update:prefix',
                  ($event.target as HTMLInputElement).value,
                )
              "
              placeholder="请输入预设风格"
            />
          </div>
          <div class="input-field">
            <label>创意题词 (Main Prompt)</label>
            <textarea
              :value="prompt"
              @input="
                $emit(
                  'update:prompt',
                  ($event.target as HTMLInputElement).value,
                )
              "
              placeholder="描述想象中的画面..."
              rows="4"
              @keyup.ctrl.enter="$emit('generate')"
            ></textarea>
          </div>
        </div>

        <div class="generation-configs">
          <div class="config-options-stack">
            <label
              class="check-label"
              title="开启后生成纯绿幕背景，极大提升后期效果"
            >
              <input
                type="checkbox"
                :checked="useGreenScreen"
                @change="
                  $emit(
                    'update:useGreenScreen',
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              <span>锁定绿幕模式 (Green Screen)</span>
            </label>
          </div>
        </div>

        <button
          class="btn btn-primary"
          :disabled="isLoading"
          @click="$emit('generate')"
        >
          <span v-if="!isLoading">开始创作</span>
          <span v-else class="loading-dots">艺术生成中</span>
        </button>
      </div>
    </div>

    <!-- Result Canvas -->
    <div class="result-col">
      <div class="result-card">
        <div class="result-header chrome-shell" v-if="sessions?.length > 0">
          <div class="chrome-tabs">
            <div
              v-for="s in sessions"
              :key="s.id"
              class="chrome-tab"
              :class="{
                active: s.id === activeSessionId,
                editing: editingSessionId === s.id,
              }"
              @click="$emit('select-session', s.id)"
              @dblclick="startEdit(s)"
            >
              <template v-if="editingSessionId === s.id">
                <input
                  v-model="editingTitle"
                  class="tab-input"
                  @blur="finishEdit"
                  @keyup.enter="finishEdit"
                  autofocus
                />
              </template>
              <template v-else>
                <span class="tab-title">{{ s.title }}</span>
                <i class="tab-close" @click.stop="handleDeleteSession(s)">×</i>
              </template>
            </div>
          </div>

          <div class="v-actions">
            <!-- Image specific actions if any -->
          </div>
        </div>

        <div class="result-content">
          <div v-if="isLoading" class="loading-full">
            <NeuralLoading />
            <p>正在生成...</p>
          </div>
          <GeminiWelcome
            v-else-if="sessions.length === 0"
            title="开启艺术创作"
            subtitle="在这里，您的创意将通过 Gemini 转化为精彩的视觉艺术。开启新画板，开始您的第一张画作。"
            icon="🎨"
          />
          <MattingWorkspace
            v-else
            :imageUrl="imageUrl"
            :originalImageUrl="originalImageUrl"
            :tolerance="tolerance"
            :smoothing="smoothing"
            :isContiguous="isContiguous"
            :targetColor="targetColor"
            :erosion="erosion"
            :feathering="feathering"
            :viewerState="viewerState"
            :showActions="true"
            :hideFloatingControl="false"
            @update:tolerance="$emit('update:tolerance', $event)"
            @update:smoothing="$emit('update:smoothing', $event)"
            @update:targetColor="onPickColor"
            @update:erosion="$emit('update:erosion', $event)"
            @update:feathering="$emit('update:feathering', $event)"
            @update:isContiguous="$emit('update:isContiguous', $event)"
            @update-matting="$emit('update-matting')"
            @reset-viewer="$emit('reset-viewer', $event)"
            @handle-zoom="(type, e) => $emit('handle-zoom', type, e)"
            @start-drag="(type, e) => $emit('start-drag', type, e)"
            @prepare-export="(url, type) => $emit('prepare-webp', url, type)"
          />
        </div>

        <!-- Floating Continue/In-paint Bar -->
        <div
          v-if="sessions.length > 0 && !isLoading"
          class="continue-floating-bar-wrapper"
        >
          <div class="continue-floating-bar glass-card">
            <div class="continue-left">
              <div
                v-if="continueImageUrl"
                class="continue-preview-skew"
                @click="openInpaintDraw"
                title="再次修改"
              >
                <img :src="continueImageUrl" />
                <button class="mini-close" @click.stop="continueImageUrl = ''">
                  ×
                </button>
              </div>
              <button
                v-else
                class="btn-continue-draw"
                @click="openInpaintDraw"
                title="标记/续写草图"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    fill="currentColor"
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                  />
                </svg>
              </button>
            </div>

            <input
              v-model="continuePrompt"
              class="continue-input"
              placeholder="以此图为基础续写或修改..."
              @keyup.enter="handleContinueSend"
            />

            <button
              class="btn-continue-send"
              :disabled="!continuePrompt"
              @click="handleContinueSend"
              title="发送指令"
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Drawing Modal -->
    <div
      v-if="isDrawingModalOpen"
      class="modal-overlay"
      @click.self="isDrawingModalOpen = false"
    >
      <div class="draw-modal card glass-card">
        <div class="modal-header">
          <h3>创作参考草图</h3>
          <button class="close-btn" @click="isDrawingModalOpen = false">
            ×
          </button>
        </div>
        <DrawingBoard
          :width="1536"
          :height="1536"
          :initialImage="
            isInpaintMode ? continueImageUrl || originalImageUrl : ''
          "
          :initialLayers="isInpaintMode ? continueLayers : []"
          @confirm="handleHandDraw"
          @cancel="
            isDrawingModalOpen = false;
            isInpaintMode = false;
          "
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ImageAssistant is now purely layout-driven via global CSS */

/* Chrome Tabs UI - High Fidelity Refresh (Synced with TextAssistant) */
.chrome-shell {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 8px !important;
  background: rgba(15, 16, 22, 0.4) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  height: 44px;
  position: relative;
}
.chrome-tabs {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  overflow-x: auto;
  flex: 1;
  height: 100%;
  padding: 0 20px;
  scrollbar-width: none;
}
.chrome-tabs::-webkit-scrollbar {
  display: none;
}

.chrome-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 4px 16px;
  height: 34px;
  min-width: 140px;
  max-width: 240px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  border-radius: 10px 10px 0 0;
  margin-bottom: -1px;
  z-index: 1;
}

.chrome-tab:not(.active):not(:last-child)::after {
  content: "";
  position: absolute;
  right: 0;
  top: 25%;
  height: 50%;
  width: 1px;
  background: rgba(255, 255, 255, 0.15);
}

.chrome-tab:hover {
  color: rgba(255, 255, 255, 0.9);
}

.chrome-tab:not(.active):hover::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 6px;
  left: 2px;
  right: 2px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  z-index: 0;
}

.chrome-tab.active {
  background: #23252e;
  color: #fff;
  z-index: 10;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.2);
}

.chrome-tab.active::before,
.chrome-tab.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  width: 20px;
  height: 20px;
  background: transparent;
  pointer-events: none;
  z-index: 20;
}

.chrome-tab.active::before {
  left: -20px;
  border-bottom-right-radius: 12px;
  box-shadow: 10px 10px 0 0 #23252e;
}

.chrome-tab.active::after {
  right: -20px;
  border-bottom-left-radius: 12px;
  box-shadow: -10px 10px 0 0 #23252e;
}

.tab-title {
  font-size: 0.82rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  pointer-events: none;
  z-index: 2;
}

.tab-input {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--primary-cyan);
  border-radius: 4px;
  color: #fff;
  font-size: 0.8rem;
  width: 100%;
  padding: 1px 6px;
  outline: none;
  height: 22px;
}

.tab-close {
  font-size: 14px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s;
  opacity: 0;
}

.chrome-tab:hover .tab-close,
.chrome-tab.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ff5f56;
}

.v-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  height: 100%;
}

.v-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  height: 100%;
}

/* Multi-Image Gallery Styling (Refresh) */
.upload-section.gallery-mode {
  padding-bottom: 12px;
}
.header-actions {
  display: flex;
  gap: 6px;
}
.mini-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.mini-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: var(--primary-cyan);
}

.main-preview {
  width: 100%;
  aspect-ratio: 16/9;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 4px;
}
.big-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.remove-current-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: rgba(255, 95, 86, 0.8);
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  backdrop-filter: blur(4px);
}

.upload-placeholder-empty {
  width: 100%;
  height: 100px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}
.upload-placeholder-empty:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.2);
}

.thumb-tabs {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.thumb-tabs::-webkit-scrollbar {
  display: none;
}
.thumb-tab {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.6;
}
.thumb-tab:hover {
  opacity: 1;
}
.thumb-tab.active {
  border-color: var(--primary-cyan);
  opacity: 1;
  box-shadow: 0 0 8px rgba(0, 255, 242, 0.3);
}
.thumb-tab img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Drawing Modal Styling (Preserved) */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.draw-modal {
  width: 840px;
  height: auto !important;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.close-btn {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.8rem;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.close-btn:hover {
  opacity: 1;
  color: #ff5f56;
}

/* Floating Continue/In-paint Bar Styles */
.continue-floating-bar-wrapper {
  position: absolute;
  top: 112px; /* Below the chrome header */
  left: 12px;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}

.continue-floating-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  width: auto;
  min-width: 320px;
  max-width: 480px;
  background: rgba(35, 37, 46, 0.7) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 12px !important; /* Changed from pill to rounded rect for better fit in corner */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
  transition: all 0.3s;
}

.continue-floating-bar:focus-within {
  border-color: rgba(0, 255, 242, 0.4) !important;
  background: rgba(35, 37, 46, 0.9) !important;
  box-shadow: 0 8px 32px rgba(0, 255, 242, 0.1);
}

.continue-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-continue-draw {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-continue-draw:hover {
  background: rgba(0, 255, 242, 0.1);
  color: #00fff2;
  border-color: #00fff2;
}

.continue-preview-skew {
  width: 30px;
  height: 30px;
  position: relative;
}

.continue-preview-skew img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  transform: rotate(-12deg) translateY(2px);
  border: 1.5px solid #00fff2;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
}

.mini-close {
  position: absolute;
  top: -4px;
  right: -8px;
  width: 14px;
  height: 14px;
  font-size: 8px;
}

.continue-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.85rem;
  outline: none;
  padding: 6px 4px;
}

.btn-continue-send {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #00fff2;
  color: #000;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-continue-send:hover:not(:disabled) {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 0 15px rgba(0, 255, 242, 0.4);
}

.btn-continue-send:disabled {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.3);
  cursor: not-allowed;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.continue-floating-bar-wrapper {
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
