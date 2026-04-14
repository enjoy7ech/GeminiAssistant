<script setup lang="ts">
import { ref, watch } from "vue";
import MarkdownIt from "markdown-it";
import ModelDropdown from "./ModelDropdown.vue";
import GeminiWelcome from "./GeminiWelcome.vue";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
});

const props = defineProps<{
  prefix: string;
  prompt: string;
  isLoading: boolean;
  chatHistory: any[];
  currentModel: string;
  allModels: any[];
  presets: any[];
  activePresetId: string;
  sessions: any[];
  activeSessionId: string;
  currentCacheName?: string;
  isCaching?: boolean;
}>();

const emit = defineEmits([
  "update:prefix",
  "update:prompt",
  "update:currentModel",
  "update:activePresetId",
  "generate",
  "follow-up",
  "clear-chat",
  "copy-result",
  "remove-preset",
  "add-preset",
  "create-cache",
  "clear-cache",
  "select-session",
  "delete-session",
  "new-session",
  "rename-session",
  "delete-message",
  "regenerate-message",
]);

const localPrefix = ref(props.prefix);
const localPrompt = ref(props.prompt);
const activeModel = ref(props.currentModel);
const followUpInput = ref("");

watch(
  () => props.prefix,
  (v) => (localPrefix.value = v),
);
watch(
  () => props.prompt,
  (v) => (localPrompt.value = v),
);
watch(
  () => props.currentModel,
  (v) => (activeModel.value = v),
);

watch(localPrefix, (v) => emit("update:prefix", v));
watch(localPrompt, (v) => emit("update:prompt", v));
watch(activeModel, (v) => emit("update:currentModel", v));

const applyPreset = (p: any) => {
  localPrefix.value = p.prompt;
  emit("update:activePresetId", p.id);
};

const handleGenerate = () => emit("generate");
const handleFollowUp = () => {
  if (!followUpInput.value) return;
  emit("follow-up", followUpInput.value);
  followUpInput.value = "";
};

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

const renderMarkdown = (text: string) => {
  if (!text) return "";
  return md.render(text);
};

const handleDeleteSession = (s: any) => {
  emit("delete-session", s.id);
};
</script>

<template>
  <div class="tool-columns sessions-layout">
    <!-- Left: Sidebar Controls -->
    <div class="control-col">
      <div class="card glass-card">
        <div class="model-select-group">
          <label>生成模型</label>
          <ModelDropdown v-model="activeModel" :options="allModels" />
        </div>

        <div class="presets-section">
          <div class="section-header">
            <label>文本预设</label>
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
              <span>{{ p.name }}</span>
              <i @click.stop="$emit('remove-preset', p.id)">×</i>
            </div>
          </div>
        </div>

        <div class="prompt-fields">
          <div class="input-field">
            <label>预设背景 (System Context)</label>
            <textarea
              v-model="localPrefix"
              placeholder="在此输入背景信息..."
              rows="5"
            ></textarea>
          </div>
          <div class="input-field">
            <label>对话指令 (Prompt)</label>
            <textarea
              v-model="localPrompt"
              placeholder="说点什么..."
              rows="4"
              @keyup.ctrl.enter="handleGenerate"
            ></textarea>
          </div>
        </div>

        <button
          class="btn btn-primary"
          :disabled="isLoading"
          @click="handleGenerate"
        >
          <span v-if="!isLoading">开始生成</span>
          <span v-else class="loading-dots">数据处理中</span>
        </button>
      </div>
    </div>

    <!-- Right: Main Conversation Area -->
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
            <button
              v-if="chatHistory.length > 5 && !currentCacheName"
              class="btn-cache"
              :disabled="isCaching"
              @click="$emit('create-cache')"
            >
              {{ isCaching ? "正在缓存..." : "🚀 缓存" }}
            </button>
            <div v-if="currentCacheName" class="cache-active-badge">
              ⚡ 已缓存
              <i @click="$emit('clear-cache')">×</i>
            </div>
          </div>
        </div>

        <div
          class="result-content"
          :class="{ empty: chatHistory.length === 0 }"
        >
          <div v-if="chatHistory.length > 0" class="chat-container">
            <div
              v-for="(msg, idx) in chatHistory"
              :key="idx"
              class="chat-bubble-row"
              :class="msg.role"
            >
              <div class="chat-bubble-content">
                <div class="bubble-header">
                  <span class="bubble-role">
                    {{ msg.role === "user" ? "YOU" : "GEMINI" }}
                  </span>
                  <div class="bubble-actions">
                    <button
                      v-if="msg.role === 'model'"
                      class="btn-msg-refresh"
                      @click="$emit('regenerate-message', idx)"
                      title="重新生成"
                    >
                      ↻
                    </button>
                    <button
                      class="btn-msg-delete"
                      @click="$emit('delete-message', idx)"
                      title="删除此消息"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div v-if="msg.role === 'user'" class="text-content">
                  {{ msg.content }}
                </div>
                <div
                  v-else
                  v-html="renderMarkdown(msg.content)"
                  class="markdown-body"
                ></div>
              </div>
            </div>
          </div>
          <GeminiWelcome
            v-else
            title="您好，我是 Gemini"
            subtitle="今天我能帮您做些什么？从开启一个新对话开始，体验人工智能的无限可能。"
          />
        </div>

        <!-- Bottom Follow-up Box -->
        <div v-if="chatHistory.length > 0" class="chat-footer">
          <div class="chat-input-wrapper">
            <input
              v-model="followUpInput"
              placeholder="输入追加指令..."
              @keyup.enter="handleFollowUp"
              :disabled="isLoading"
            />
            <button
              @click="handleFollowUp"
              :disabled="isLoading || !followUpInput"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Only Chat Bubbles Specific Logic */
/* Chrome Tabs UI - High Fidelity Refresh */
.chrome-shell {
  display: flex;
  align-items: flex-end; /* Align tabs to bottom */
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
  padding: 0 16px 4px 16px; /* Lift content up slightly */
  height: 34px;
  min-width: 140px;
  max-width: 240px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  border-radius: 10px 10px 0 0;
  margin-bottom: -1px; /* Overlap the bottom border */
  z-index: 1;
}

/* Inactive Tab Separator */
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
  bottom: 6px; /* Floating gap at bottom */
  left: 2px;
  right: 2px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  z-index: 0;
}

.chrome-tab.active {
  background: #23252e; /* Exact match with result-card */
  color: #fff;
  z-index: 10;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.2);
}

/* The "Chrome" Curve Connectors for Active Tab */
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
  pointer-events: none; /* Let dblclick pass to parent */
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
  opacity: 0; /* Hide by default */
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

.chat-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
}

.chat-bubble-row {
  display: flex;
  width: 100%;
  position: relative;
  transition: background 0.2s;
  padding: 8px 0;
  border-radius: 8px;
}

.chat-bubble-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.chat-bubble-content {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  max-width: 95%;
  animation: slide-up 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.chat-bubble-row.user .chat-bubble-content {
  background: rgba(0, 255, 242, 0.03);
  border-color: rgba(0, 255, 242, 0.08);
}

.bubble-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.bubble-role {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.3);
}

.chat-bubble-row.user .bubble-role {
  color: rgba(0, 255, 242, 0.4);
}

.bubble-actions {
  opacity: 0;
  transition: opacity 0.2s;
  position: absolute;
  top: -12px;
  right: 12px;
  background: #23252e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 2px 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 10;
  display: flex;
  flex-direction: row;
  gap: 2px;
}

.chat-bubble-row:hover .bubble-actions {
  opacity: 1;
}

.btn-msg-refresh {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-msg-refresh:hover {
  background: rgba(0, 255, 242, 0.1);
  color: #00fff2;
}

.btn-msg-delete {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-msg-delete:hover {
  background: rgba(255, 95, 86, 0.1);
  color: #ff5f56;
}

.text-content {
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.5;
  white-space: pre-wrap;
  font-size: 0.95rem;
}

.bubble-info {
  font-size: 0.65rem;
  color: #64748b;
  font-weight: 800;
  margin-bottom: 8px;
  letter-spacing: 0.15em;
}
.chat-bubble.user .bubble-info {
  text-align: right;
  color: rgba(0, 255, 242, 0.6);
}

.chat-footer {
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.chat-input-wrapper {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  display: flex;
  padding: 4px;
}
.chat-input-wrapper input {
  flex: 1;
  background: transparent;
  border: none;
  color: #fff;
  padding: 10px 16px;
  outline: none;
}
.chat-input-wrapper button {
  background: #00fff2;
  color: #000;
  border: none;
  padding: 0 20px;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;
  transition: 0.2s;
}
.chat-input-wrapper button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(0, 255, 242, 0.3);
}

.empty-state-text {
  color: rgba(255, 255, 255, 0.2);
  text-align: center;
  margin-top: 40px;
  font-style: italic;
}
.btn-cache {
  background: rgba(0, 255, 242, 0.1);
  color: var(--primary-cyan);
  border: 1px solid rgba(0, 255, 242, 0.2);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.7rem;
  cursor: pointer;
  font-weight: 700;
  transition: 0.2s;
}
.btn-cache:hover {
  background: rgba(0, 255, 242, 0.2);
}
.cache-active-badge {
  background: rgba(0, 255, 242, 0.05);
  color: #00fff2;
  border: 1px solid rgba(0, 255, 242, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cache-active-badge i {
  cursor: pointer;
  opacity: 0.6;
  font-style: normal;
}
.cache-active-badge i:hover {
  opacity: 1;
  color: #ff6e6e;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Markdown Content Styling (Deep) */
:deep(.markdown-body) {
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  word-wrap: break-word;
}
:deep(.markdown-body p) {
  margin-top: 0;
  margin-bottom: 16px;
}
:deep(.markdown-body strong),
:deep(.markdown-body b) {
  font-weight: 800;
  color: #fff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
}
:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
  color: #fff;
}
:deep(.markdown-body h1) {
  font-size: 1.6rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.3em;
}
:deep(.markdown-body h2) {
  font-size: 1.4rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.3em;
}
:deep(.markdown-body h3) {
  font-size: 1.25rem;
}

:deep(.markdown-body hr) {
  height: 2px;
  padding: 0;
  margin: 24px 0;
  background-color: rgba(255, 255, 255, 0.1);
  border: 0;
}
:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  padding-left: 1.5em;
  margin-bottom: 16px;
}
:deep(.markdown-body li) {
  margin-bottom: 4px;
}
:deep(.markdown-body code) {
  padding: 0.2em 0.4em;
  font-size: 85%;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-family: "Fira Code", monospace;
}
:deep(.markdown-body pre) {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: rgba(0, 0, 0, 0.4);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 16px;
}
</style>
