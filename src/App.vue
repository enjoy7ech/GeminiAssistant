<script setup lang="ts">
import { ref } from "vue";
import GeminiTools from "./components/GeminiTools.vue";

const activeTab = ref("text");
const sideBarCollapsed = ref(false);

const setTab = (tab: string) => {
  activeTab.value = tab;
};
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sideBarCollapsed }">
    <aside class="sidebar">
      <div class="logo-container">
        <div class="logo-icon">G</div>
        <span class="logo-text">Gemini Assistant</span>
      </div>

      <nav class="nav-menu">
        <button
          class="nav-item"
          :class="{ active: activeTab === 'text' }"
          @click="setTab('text')"
        >
          <div class="nav-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              />
            </svg>
          </div>
          <span>文本生成</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeTab === 'image' }"
          @click="setTab('image')"
        >
          <div class="nav-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <span>图像生成</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeTab === 'matting' }"
          @click="setTab('matting')"
        >
          <div class="nav-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M20 7h-9m3 3H5m12 12V11M7 21v-6" />
            </svg>
          </div>
          <span>手动抠像</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <button
          class="nav-item"
          :class="{ active: activeTab === 'config' }"
          @click="setTab('config')"
        >
          <div class="nav-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </div>
          <span>参数配置</span>
        </button>
      </div>
    </aside>

    <main class="main-content">
      <GeminiTools v-model:activeTab="activeTab" />
    </main>
  </div>
</template>

<style>
:root {
  font-family: "Outfit", "Inter", system-ui, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: dark;
  color: #f1f5f9;
  background-color: #0f111a;
}

* {
  box-sizing: border-box; /* Crucial fix for overflow issues */
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#app {
  width: 100vw;
  height: 100vh;
}

.app-shell {
  display: flex;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(
      circle at 80% 10%,
      rgba(0, 255, 242, 0.08),
      transparent 45%
    ),
    radial-gradient(
      circle at 20% 90%,
      rgba(124, 58, 237, 0.1),
      transparent 50%
    ),
    radial-gradient(circle at 50% 50%, rgba(15, 17, 26, 1), #090a0f); /* Gradient to give depth */
}

.sidebar {
  width: 260px;
  background: rgba(20, 22, 33, 0.7); /* Brightened and more transparent */
  backdrop-filter: blur(30px);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  z-index: 100;
  box-shadow: 10px 0 30px rgba(0, 0, 0, 0.2);
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 3rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #00fff2 0%, #7c3aed 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 1.4rem;
  color: white;
  box-shadow: 0 0 25px rgba(0, 255, 242, 0.4);
}

.logo-text {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0.85rem 1.25rem;
  border-radius: 14px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 1rem;
  font-weight: 600;
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  transform: translateX(4px);
}

.nav-item.active {
  background: linear-gradient(
    90deg,
    rgba(0, 255, 242, 0.15),
    rgba(0, 255, 242, 0.02)
  );
  color: #00fff2;
  box-shadow: inset 0 0 0 1px rgba(0, 255, 242, 0.2);
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.nav-icon svg {
  width: 22px;
  height: 22px;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden; /* Changed from auto to support independent scrolling */
  background: transparent;
}

/* Animations */
.nav-item.active .nav-icon {
  filter: drop-shadow(0 0 8px rgba(0, 255, 242, 0.5));
}

@media (max-width: 768px) {
  .sidebar {
    width: 80px;
    padding: 1rem;
    align-items: center;
  }
  .logo-text,
  .nav-item span {
    display: none;
  }
  .nav-item {
    justify-content: center;
    padding: 0.75rem;
  }
}
</style>
