import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Mic, MicOff, ArrowLeft, Trash2, Loader2, Maximize2, Wifi, WifiOff, Minimize2 } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

type RecordingState = 'idle' | 'connecting' | 'recording' | 'processing'

export default function DualDisplayPage() {
  const [state, setState] = useState<RecordingState>('idle')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const {
    isConnected,
    connectionState,
    partialText,
    finalText,
    error: wsError,
    connect,
    startRecording: wsStartRecording,
    stopRecording: wsStopRecording,
    sendAudio,
    clearText,
  } = useWebSocket()

  const {
    isRecording,
    volumeLevel,
    error: recorderError,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    onAudioData,
  } = useAudioRecorder()

  // 設置音訊數據回調
  useEffect(() => {
    onAudioData((data) => {
      if (isConnected && isRecording) {
        sendAudio(data)
      }
    })
  }, [onAudioData, sendAudio, isConnected, isRecording])

  // 監聽全螢幕變化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // 組合顯示文字
  const displayText = partialText
    ? `${finalText}${finalText ? '\n' : ''}${partialText}`
    : finalText

  const error = wsError || recorderError

  // connectionState 的即時值，供 handleMicClick 內的輪詢讀取（同 VoicePage 的 stale closure 修法）
  const connectionStateRef = useRef(connectionState)
  useEffect(() => {
    connectionStateRef.current = connectionState
  }, [connectionState])

  const handleMicClick = useCallback(async () => {
    if (state === 'recording') {
      // 停止錄音
      setState('processing')
      stopAudioRecording()
      wsStopRecording()

      setTimeout(() => {
        setState('idle')
      }, 500)
    } else if (state === 'idle') {
      // 開始錄音
      setState('connecting')

      try {
        // 先連接 WebSocket
        if (!isConnected) {
          connect()
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('連接超時')), 5000)
            const checkConnection = setInterval(() => {
              if (connectionStateRef.current === 'connected') {
                clearInterval(checkConnection)
                clearTimeout(timeout)
                resolve()
              } else if (connectionStateRef.current === 'error') {
                clearInterval(checkConnection)
                clearTimeout(timeout)
                reject(new Error('連接失敗'))
              }
            }, 100)
          })
        }

        await startAudioRecording()
        wsStartRecording()
        setState('recording')
      } catch (err) {
        console.error('Failed to start recording:', err)
        setState('idle')
      }
    }
  }, [state, isConnected, connectionState, connect, startAudioRecording, stopAudioRecording, wsStartRecording, wsStopRecording])

  const handleClear = useCallback(() => {
    clearText()
  }, [clearText])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  // 狀態提示文字
  const statusText = {
    idle: '點擊麥克風開始',
    connecting: '正在連接...',
    recording: '正在聆聽...',
    processing: '處理中...',
  }[state]

  return (
    // 100dvh：手機瀏覽器的 100vh 含網址列高度，會把底部控制列擠出畫面（要往下捲才看得到麥克風）
    // 不支援 dvh 的舊瀏覽器會忽略 inline style，退回 h-screen
    <div className="h-screen flex flex-col bg-black" style={{ height: '100dvh' }}>
      {/* Header - hide in fullscreen */}
      {!isFullscreen && (
        <header className="shrink-0 p-3 flex items-center justify-between border-b border-neutral-800 bg-neutral-900">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </Link>
          <h1 className="font-title text-lg font-bold text-white">
            雙向顯示模式
          </h1>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 text-xs ${
              isConnected ? 'text-green-500' : 'text-neutral-500'
            }`}>
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            </div>
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              title="全螢幕"
            >
              <Maximize2 className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        </header>
      )}

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/50 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Top Half - Flipped 180° for person across */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-6 border-b border-neutral-800 overflow-auto">
        <div className="text-flipped w-full max-w-4xl">
          {displayText ? (
            <p className="font-content text-2xl md:text-4xl text-white leading-relaxed text-center whitespace-pre-wrap">
              {displayText}
              {partialText && <span className="text-neutral-500 animate-pulse">|</span>}
            </p>
          ) : (
            <p className="font-content text-2xl md:text-3xl text-neutral-500 text-center">
              {statusText}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Half - Normal for self */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-auto">
        <div className="w-full max-w-4xl">
          {displayText ? (
            <p className="font-content text-2xl md:text-4xl text-white leading-relaxed text-center whitespace-pre-wrap">
              {displayText}
              {partialText && <span className="text-neutral-500 animate-pulse">|</span>}
            </p>
          ) : (
            <p className="font-content text-2xl md:text-3xl text-neutral-500 text-center">
              {statusText}
            </p>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="shrink-0 p-4 flex items-center justify-center gap-4 bg-neutral-900 border-t border-neutral-800">
        {/* Clear Button */}
        <button
          onClick={handleClear}
          className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-full transition-colors"
          title="清除"
        >
          <Trash2 className="w-5 h-5 text-neutral-300" />
        </button>

        {/* Volume Indicator */}
        {state === 'recording' && (
          <div className="w-16 h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-75"
              style={{ width: `${volumeLevel * 100}%` }}
            />
          </div>
        )}

        {/* Mic Button */}
        <button
          onClick={handleMicClick}
          disabled={state === 'processing' || state === 'connecting'}
          className={`
            w-16 h-16 rounded-full flex items-center justify-center transition-all
            ${state === 'idle'
              ? 'bg-white hover:bg-neutral-200 text-black'
              : state === 'recording'
              ? 'bg-red-500 text-white recording-pulse recording-glow'
              : 'bg-neutral-600 text-white cursor-not-allowed'
            }
          `}
        >
          {state === 'processing' || state === 'connecting' ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : state === 'recording' ? (
            <MicOff className="w-7 h-7" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
        </button>

        {/* Fullscreen Toggle (always visible) */}
        <button
          onClick={toggleFullscreen}
          className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-full transition-colors"
          title={isFullscreen ? '退出全螢幕' : '全螢幕'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-5 h-5 text-neutral-300" />
          ) : (
            <Maximize2 className="w-5 h-5 text-neutral-300" />
          )}
        </button>
      </div>
    </div>
  )
}
