<template>
  <div class="neural-loading">
    <div class="neural-core">
      <div class="orbit-1"></div>
      <div class="orbit-2"></div>
      <div class="pulse-core"></div>
    </div>
    <div class="loading-progress-bar">
      <div class="progress-fill"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.neural-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5rem;
  padding: 4rem 0;
}

.neural-core {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.pulse-core {
  position: absolute;
  width: 24px;
  height: 24px;
  background: #00fff2;
  border-radius: 50%;
  box-shadow: 0 0 30px #00fff2, 0 0 60px rgba(0, 255, 242, 0.4);
  animation: pulse-aura 1.5s ease-in-out infinite;
  z-index: 5;
}

.orbit-1, .orbit-2 {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 2px solid rgba(0, 255, 242, 0.2);
  border-top-color: #00fff2;
  border-radius: 50%;
}

.orbit-1 {
  width: 70px;
  height: 70px;
  margin-top: -35px;
  margin-left: -35px;
  animation: spin 2.5s linear infinite;
}

.orbit-2 {
  width: 110px;
  height: 110px;
  margin-top: -55px;
  margin-left: -55px;
  border-right-color: #7c3aed;
  animation: spin 4s linear reverse infinite;
}

.neural-text {
  text-align: center;
}

.neural-text .main-msg {
  font-family: 'Outfit', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
}

.neural-text .sub-msg {
  font-size: 0.85rem;
  color: #94a3b8;
  opacity: 0.7;
}

.loading-progress-bar {
  width: 140px;
  height: 3px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, #00fff2, transparent);
  animation: data-stream 2s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse-aura {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.5); opacity: 1; box-shadow: 0 0 40px #00fff2, 0 0 80px rgba(0, 255, 242, 0.6); }
}

@keyframes data-stream {
  0% { transform: translateX(-150%); }
  100% { transform: translateX(150%); }
}
</style>
