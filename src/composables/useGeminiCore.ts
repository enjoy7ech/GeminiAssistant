import { ref } from 'vue'
import { GeminiService } from '../libs/GeminiService'

// Shared state between components
export function useGeminiUI(apiKey: string, textModel: string, imageModel: string) {
  const gemini = new GeminiService(apiKey, textModel, imageModel)
  const isLoading = ref(false)
  const statusMessage = ref('')

  const showStatus = (msg: string) => {
    statusMessage.value = msg
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)
  }

  return {
    gemini,
    isLoading,
    statusMessage,
    showStatus
  }
}
