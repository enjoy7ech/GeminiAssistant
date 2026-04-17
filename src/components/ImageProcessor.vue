<script setup lang="ts">
import { ref } from "vue";
import MattingWorkspace from "./MattingWorkspace.vue";
import GeminiWelcome from "./GeminiWelcome.vue";

const props = defineProps<{
  imageUrl: string;
  originalImageUrl: string;
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
  "update:imageUrl",
  "update:originalImageUrl",
  "update:tolerance",
  "update:smoothing",
  "update:webpQuality",
  "update:isContiguous",
  "update:targetColor",
  "update:erosion",
  "update:feathering",
  "update-matting",
  "reset-viewer",
  "handle-zoom",
  "start-drag",
  "prepare-webp",
  "reprocess",
  "select-session",
  "delete-session",
  "rename-session",
  "new-session",
]);

const fileInput = ref<HTMLInputElement | null>(null);
const triggerUpload = () => fileInput.value?.click();

const handleFile = (file: File) => {
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const res = e.target?.result as string;
    emit("update:originalImageUrl", res);
    emit("update-matting");
  };
  reader.readAsDataURL(file);
};

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) handleFile(file);
};

// Session Management logic (synced with ImageAssistant)
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
</script>

<template>
  <div class="image-processor">
    <div class="proc-header chrome-shell">
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
        <button
          class="new-proc-btn"
          @click="$emit('new-session')"
          title="新建处理会话"
        >
          +
        </button>
      </div>
      <div class="v-actions">
        <!-- Reusable actions area -->
      </div>
    </div>

    <div class="proc-content">
      <GeminiWelcome
        v-if="sessions.length === 0"
        title="图片处理中心"
        subtitle="在这里，您可以对现有图片进行精确的背景抠除和平滑处理。点击上方 + 号开启您的第一个处理任务。"
        icon="✂️"
        @click="$emit('new-session')"
        style="cursor: pointer"
      />
      <div
        v-else-if="!originalImageUrl"
        class="upload-card"
        @click="triggerUpload"
      >
        <div class="upload-icon-wrapper">📁</div>
        <h3>上传图片开始处理</h3>
        <p>点击或拖拽文件到此处</p>
        <p class="upload-hint">支持 JPG, PNG, WebP 等通用图像格式</p>
        <input
          type="file"
          ref="fileInput"
          @change="onFileChange"
          accept="image/*"
          hidden
        />
      </div>

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
        @update:tolerance="$emit('update:tolerance', $event)"
        @update:smoothing="$emit('update:smoothing', $event)"
        @update:targetColor="$emit('update:targetColor', $event)"
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
</template>

<style scoped>
.image-processor {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: radial-gradient(
    circle at center,
    rgba(0, 255, 242, 0.03) 0%,
    transparent 70%
  );
}

.proc-header {
  flex-shrink: 0;
}

.proc-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  background: #23252e;
}

/* Chrome Tabs UI - Reused from Assistant */
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

.new-proc-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 20px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  margin-bottom: 4px;
}
.new-proc-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.upload-card {
  width: 520px;
  padding: 60px 40px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.upload-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0, 255, 242, 0.1), transparent);
  opacity: 0;
  transition: opacity 0.4s;
}

.upload-card:hover {
  transform: translateY(-8px);
  border-color: rgba(0, 255, 242, 0.4);
  background: rgba(15, 23, 42, 0.8);
  box-shadow: 0 30px 60px rgba(0, 255, 242, 0.1);
}

.upload-card:hover::before {
  opacity: 1;
}

.upload-icon-wrapper {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  margin-bottom: 24px;
  transition: all 0.3s;
  z-index: 1;
}

.upload-card:hover .upload-icon-wrapper {
  transform: scale(1.1) rotate(5deg);
  background: rgba(0, 255, 242, 0.1);
  border-color: #00fff2;
  box-shadow: 0 0 20px rgba(0, 255, 242, 0.2);
}

.upload-card h3 {
  font-size: 1.25rem;
  color: #fff;
  margin: 0 0 8px 0;
  z-index: 1;
}

.upload-card p {
  font-size: 0.9rem;
  color: #64748b;
  margin: 0;
  z-index: 1;
}

.upload-hint {
  margin-top: 32px !important;
  font-size: 0.75rem !important;
  color: rgba(148, 163, 184, 0.4) !important;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  z-index: 1;
}
</style>
