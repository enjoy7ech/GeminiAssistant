<script setup lang="ts">
defineProps<{
  title: string;
  subtitle: string;
}>();
</script>

<template>
  <div class="welcome-container">
    <div class="gemini-star-wrapper">
      <div class="gemini-star"></div>
      <div class="gemini-star-glow"></div>
    </div>
    <h1 class="welcome-title">{{ title }}</h1>
    <p class="welcome-subtitle">{{ subtitle }}</p>
  </div>
</template>

<style scoped>
.welcome-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px;
  animation: fadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  background: radial-gradient(
    circle at center,
    rgba(26, 115, 232, 0.05) 0%,
    transparent 70%
  );
}

.gemini-star-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gemini-star {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #1a73e8, #9b27b0, #ff4081);
  mask: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2L14.85 8.65L22 9.24L16.5 14L18.18 21L12 17.27L5.82 21L7.5 14L2 9.24L9.15 8.65L12 2Z'/%3E%3C/svg%3E")
    no-repeat center;
  -webkit-mask: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2L14.85 8.65L22 9.24L16.5 14L18.18 21L12 17.27L5.82 21L7.5 14L2 9.24L9.15 8.65L12 2Z'/%3E%3C/svg%3E")
    no-repeat center;
  animation:
    float 4s ease-in-out infinite,
    rotate 12s linear infinite;
  z-index: 2;
}

.gemini-star-glow {
  position: absolute;
  width: 140px;
  height: 140px;
  background: radial-gradient(
    circle,
    rgba(26, 115, 232, 0.3) 0%,
    rgba(155, 39, 176, 0.1) 50%,
    transparent 70%
  );
  filter: blur(20px);
  animation: pulse 3s ease-in-out infinite;
  z-index: 1;
}

.welcome-title {
  font-size: 2.8rem;
  font-weight: 700;
  background: linear-gradient(to right, #ffffff, #a0aec0);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 16px 0;
  letter-spacing: -1px;
}

.welcome-subtitle {
  font-size: 1.1rem;
  color: #a0aec0;
  max-width: 500px;
  line-height: 1.6;
  margin-bottom: 40px;
}

.btn-start-chat {
  background: linear-gradient(135deg, #2a2d3e 0%, #1a1c2a 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  padding: 16px 32px;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 50px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.btn-start-chat:hover {
  transform: translateY(-3px);
  background: linear-gradient(135deg, #32364a 0%, #22253a 100%);
  border-color: rgba(66, 153, 225, 0.5);
  box-shadow: 0 15px 40px rgba(66, 153, 225, 0.2);
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
