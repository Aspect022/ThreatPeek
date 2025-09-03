import { useState, useEffect, useCallback, useRef } from 'react'
import { ScanProgress } from '@/components/ui/scan-progress-tracker'

interface UseScanProgressOptions {
  scanId: string
  pollingInterval?: number
  enableWebSocket?: boolean
  onComplete?: (progress: ScanProgress) => void
  onError?: (error: string) => void
}

interface ScanProgressHook {
  progress: ScanProgress | null
  isLoading: boolean
  error: string | null
  cancel: () => void
  retry: () => void
}

export function useScanProgress({
  scanId,
  pollingInterval = 2000,
  enableWebSocket = false,
  onComplete,
  onError
}: UseScanProgressOptions): ScanProgressHook {
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const isCancelledRef = useRef(false)

  const fetchProgress = useCallback(async () => {
    if (isCancelledRef.current) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scan/${scanId}/progress`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch progress: ${response.status}`)
      }

      const progressData: ScanProgress = await response.json()
      setProgress(progressData)
      setError(null)
      setIsLoading(false)

      // Check if scan is complete
      if (progressData.status === 'completed' || progressData.status === 'failed') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        
        if (progressData.status === 'completed' && onComplete) {
          onComplete(progressData)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setIsLoading(false)
      
      if (onError) {
        onError(errorMessage)
      }
    }
  }, [scanId, onComplete, onError])

  const setupWebSocket = useCallback(() => {
    if (!enableWebSocket) return

    try {
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:3001'}/scan/${scanId}/progress`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected for scan progress')
        setError(null)
      }

      ws.onmessage = (event) => {
        try {
          const progressData: ScanProgress = JSON.parse(event.data)
          setProgress(progressData)
          setIsLoading(false)

          if (progressData.status === 'completed' && onComplete) {
            onComplete(progressData)
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setError('WebSocket connection failed, falling back to polling')
        // Fall back to polling
        setupPolling()
      }

      ws.onclose = () => {
        console.log('WebSocket connection closed')
        wsRef.current = null
      }
    } catch (err) {
      console.error('Failed to setup WebSocket:', err)
      setError('WebSocket setup failed, using polling')
      setupPolling()
    }
  }, [scanId, enableWebSocket, onComplete])

  const setupPolling = useCallback(() => {
    // Initial fetch
    fetchProgress()

    // Set up polling interval
    pollingRef.current = setInterval(fetchProgress, pollingInterval)
  }, [fetchProgress, pollingInterval])

  const cancel = useCallback(async () => {
    isCancelledRef.current = true

    // Clean up polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Send cancel request to backend
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/scan/${scanId}/cancel`, {
        method: 'POST'
      })
    } catch (err) {
      console.error('Failed to cancel scan:', err)
    }

    // Update progress state
    if (progress) {
      setProgress({
        ...progress,
        status: 'cancelled'
      })
    }
  }, [scanId, progress])

  const retry = useCallback(() => {
    isCancelledRef.current = false
    setError(null)
    setIsLoading(true)
    
    if (enableWebSocket) {
      setupWebSocket()
    } else {
      setupPolling()
    }
  }, [enableWebSocket, setupWebSocket, setupPolling])

  // Initialize progress tracking
  useEffect(() => {
    if (!scanId) return

    isCancelledRef.current = false
    
    if (enableWebSocket) {
      setupWebSocket()
    } else {
      setupPolling()
    }

    // Cleanup function
    return () => {
      isCancelledRef.current = true
      
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [scanId, enableWebSocket, setupWebSocket, setupPolling])

  return {
    progress,
    isLoading,
    error,
    cancel,
    retry
  }
}

// Mock progress data generator for testing
export function generateMockProgress(scanId: string, scanType: 'url' | 'repository' | 'deep'): ScanProgress {
  const phases = [
    {
      id: 'initialization',
      name: 'Initialization',
      description: 'Setting up scan parameters and validating target',
      status: 'completed' as const,
      progress: 100,
      startTime: new Date(Date.now() - 30000).toISOString(),
      endTime: new Date(Date.now() - 25000).toISOString(),
      duration: 5000,
      confidence: 1.0
    },
    {
      id: 'url-scan',
      name: 'URL Analysis',
      description: 'Analyzing target URL and discovering resources',
      status: 'completed' as const,
      progress: 100,
      startTime: new Date(Date.now() - 25000).toISOString(),
      endTime: new Date(Date.now() - 20000).toISOString(),
      duration: 5000,
      confidence: 0.9
    },
    {
      id: 'secret-detection',
      name: 'Secret Detection',
      description: 'Scanning for exposed API keys, tokens, and credentials',
      status: 'running' as const,
      progress: 65,
      startTime: new Date(Date.now() - 20000).toISOString(),
      details: 'Analyzing JavaScript files for embedded secrets...',
      confidence: 0.85
    },
    {
      id: 'file-detection',
      name: 'File Detection',
      description: 'Checking for exposed sensitive files and directories',
      status: 'pending' as const,
      progress: 0
    },
    {
      id: 'header-analysis',
      name: 'Security Headers',
      description: 'Analyzing HTTP security headers and configurations',
      status: 'pending' as const,
      progress: 0
    }
  ]

  if (scanType === 'repository') {
    phases.unshift({
      id: 'repository-clone',
      name: 'Repository Clone',
      description: 'Cloning repository and preparing for analysis',
      status: 'completed' as const,
      progress: 100,
      startTime: new Date(Date.now() - 35000).toISOString(),
      endTime: new Date(Date.now() - 30000).toISOString(),
      duration: 5000,
      confidence: 1.0
    })
  }

  if (scanType === 'deep') {
    phases.push(
      {
        id: 'owasp-analysis',
        name: 'OWASP Analysis',
        description: 'Running OWASP Top 10 security checks',
        status: 'pending' as const,
        progress: 0
      },
      {
        id: 'ai-analysis',
        name: 'AI Analysis',
        description: 'Generating AI-powered insights and recommendations',
        status: 'pending' as const,
        progress: 0
      }
    )
  }

  const completedPhases = phases.filter(p => p.status === 'completed').length
  const runningPhases = phases.filter(p => p.status === 'running')
  const overallProgress = (completedPhases / phases.length) * 100 + 
    (runningPhases.reduce((sum, p) => sum + p.progress, 0) / phases.length)

  return {
    scanId,
    scanType,
    overallProgress: Math.min(overallProgress, 100),
    status: 'running',
    phases,
    startTime: new Date(Date.now() - 35000).toISOString(),
    estimatedTimeRemaining: 45,
    currentPhase: 'secret-detection',
    totalFindings: 3,
    errors: []
  }
}
