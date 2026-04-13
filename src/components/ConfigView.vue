<template>
  <div class="config-view">
    <div class="card glass-card">
      <h3>核心接口配置</h3>
      <div class="input-field" style="margin-bottom: 1.5rem;">
        <label>Google AI API Key</label>
        <div class="pw-input-wrapper">
          <input 
            :type="showKey ? 'text' : 'password'" 
            :value="apiKey" 
            @input="$emit('update:apiKey', ($event.target as HTMLInputElement).value)"
            placeholder="在此输入您的 API Key..." 
          />
          <i class="pw-icon" @click="showKey = !showKey">{{ showKey ? '👁️' : '🙈' }}</i>
        </div>
      </div>

      <div class="input-field" style="margin-bottom: 2rem;">
        <label>API Base URL (代理地址)</label>
        <div class="pw-input-wrapper">
          <input 
            type="text" 
            :value="apiBaseUrl" 
            :class="{ 'error-border': urlError }"
            @input="handleUrlInput"
            placeholder="默认 (https://generativelanguage.googleapis.com)" 
          />
        </div>
        <p v-if="urlError" class="field-error-msg">{{ urlError }}</p>
        <p class="field-hint">提示：请以 https:// 开头，不要包含末尾的 /v1beta 或 /</p>
      </div>

      <button class="btn btn-primary" @click="handleSave">保存并验证配置</button>
    </div>

    <div class="card glass-card">
      <h3>可用模型概览</h3>
      <div class="model-list">
        <div v-for="m in models" :key="m.name" class="model-status-item">
          <div>
            <span class="m-name">{{ m.displayName }}</span>
            <span class="m-id">{{ m.name }}</span>
          </div>
          <span class="m-status">Ready</span>
        </div>
        <div v-if="models.length === 0" class="empty-models">暂无模型数据，请先配置并保存 API Key</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  apiKey: string
  apiBaseUrl: string
  textModel: string
  imageModel: string
  models: any[]
}>()

const emit = defineEmits(['update:apiKey', 'update:apiBaseUrl', 'save', 'toggle-dropdown'])

const showKey = ref(false)
const urlError = ref('')

const validateUrl = (val: string): boolean => {
  if (!val) {
    urlError.value = ''
    return true
  }
  
  try {
    const url = new URL(val)
    if (url.protocol !== 'https:' && window.location.protocol === 'https:') {
      urlError.value = '安全限制：当前页面为 HTTPS，建议代理也使用 https://'
      return false
    } else if (val.endsWith('/')) {
      urlError.value = '提示：请移除末尾的斜杠'
      return false
    } else if (val.includes('/v1')) {
      urlError.value = '提示：通常不需要包含 /v1beta 或 /v1 路径'
      return false
    }
    urlError.value = ''
    return true
  } catch (e) {
    urlError.value = '请输入有效的 URL (包含 http:// 或 https://)'
    return false
  }
}

const handleUrlInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  emit('update:apiBaseUrl', val)
  validateUrl(val)
}

const handleSave = () => {
  if (validateUrl(props.apiBaseUrl)) {
    emit('save')
  }
}
</script>

<style scoped>
.config-view { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; max-width: 1000px; margin: 0 auto; width: 100%; height: fit-content; }
.pw-input-wrapper { position: relative; }
.pw-input-wrapper input { width: 100%; padding: 12px 16px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; color: #fff; }
.pw-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; opacity: 0.5; }

.model-list { background: rgba(0, 0, 0, 0.2); border-radius: 12px; max-height: 400px; overflow-y: auto; padding: 0.5rem; }
.model-status-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.m-name { display: block; font-weight: 600; font-size: 0.9rem; color: #fff; }
.m-id { font-size: 0.75rem; color: #64748b; }
.m-status { font-size: 0.7rem; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 4px; }
.empty-models { padding: 2rem; text-align: center; color: #64748b; font-size: 0.9rem; }
.error-border { border-color: #ef4444 !important; }
.field-error-msg { color: #ef4444; font-size: 0.75rem; margin-top: 6px; font-weight: 600; }
.field-hint { color: #64748b; font-size: 0.7rem; margin-top: 6px; }
</style>
