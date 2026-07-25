/**
 * API 連接配置與工具函數
 */

// API 基礎 URL
// 開發模式指向本地 8765；生產模式預設同源（前後端同一個 process/port），
// 不寫死正式網域，換網域或本機測試 build 都不用改程式碼。
const isProd = import.meta.env.PROD
const sameOriginWs = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : ''

export const API_BASE_URL = import.meta.env.VITE_API_URL || (isProd ? '' : 'http://localhost:8765')
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || (isProd ? sameOriginWs : 'ws://localhost:8765')

/**
 * 檢查 API 健康狀態
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    const data = await response.json()
    return data.sherpa_ready === true
  } catch {
    return false
  }
}

/**
 * 獲取服務狀態
 */
export async function getStatus() {
  const response = await fetch(`${API_BASE_URL}/status`)
  if (!response.ok) {
    throw new Error('Failed to get status')
  }
  return response.json()
}

/**
 * 上傳音訊檔案進行辨識
 */
export async function transcribeFile(file: Blob): Promise<{
  success: boolean
  text: string
  error?: string
}> {
  const formData = new FormData()
  formData.append('file', file, 'audio.wav')

  const response = await fetch(`${API_BASE_URL}/transcribe/file`, {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

/**
 * 使用 Base64 編碼辨識音訊
 */
export async function transcribeBase64(
  audioData: string,
  format: string = 'wav'
): Promise<{
  success: boolean
  text: string
  error?: string
}> {
  const response = await fetch(`${API_BASE_URL}/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_data: audioData,
      format,
    }),
  })

  return response.json()
}

/**
 * 獲取熱詞配置
 */
export async function getHotwords() {
  const response = await fetch(`${API_BASE_URL}/hotwords`)
  return response.json()
}

/**
 * 設置熱詞配置
 */
export async function setHotwords(config: {
  enabled: boolean
  score: number
  words: string[]
}) {
  const response = await fetch(`${API_BASE_URL}/hotwords`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  })

  return response.json()
}
