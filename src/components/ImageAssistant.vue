<script setup lang="ts">
import { ref, watch } from "vue";
import NeuralLoading from "./NeuralLoading.vue";
import ModelDropdown from "./ModelDropdown.vue";
import MattingWorkspace from "./MattingWorkspace.vue";
import GeminiWelcome from "./GeminiWelcome.vue";

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
]);

const applyPreset = (p: any) => {
  emit("update:prefix", p.prompt);
  emit("update:activePresetId", p.id);
};

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
  if (confirm(`确定要删除此生图记录 "${s.title}" 吗？`)) {
    emit("delete-session", s.id);
  }
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
</style>
