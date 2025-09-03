"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2,
  Globe,
  FileText,
  Shield,
  Search,
  GitBranch,
  Settings,
  Zap
} from "lucide-react"

export interface ScanPhase {
  id: string
  name: string
  description: string
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  startTime?: string
  endTime?: string
  duration?: number
  details?: string
  confidence?: number
}

export interface ScanProgress {
  scanId: string
  scanType: "url" | "repository" | "deep"
  overallProgress: number
  status: "initializing" | "running" | "completed" | "failed" | "cancelled"
  phases: ScanPhase[]
  startTime: string
  estimatedTimeRemaining?: number
  currentPhase?: string
  totalFindings?: number
  errors?: string[]
}

interface ScanProgressTrackerProps {
  progress: ScanProgress
  onCancel?: () => void
  showDetails?: boolean
}

export function ScanProgressTracker({ 
  progress, 
  onCancel, 
  showDetails = true 
}: ScanProgressTrackerProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (progress.status === "running") {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(progress.startTime).getTime()) / 1000)
        setElapsedTime(elapsed)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [progress.status, progress.startTime])

  const getPhaseIcon = (phase: ScanPhase) => {
    switch (phase.status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getPhaseTypeIcon = (phaseId: string) => {
    switch (phaseId) {
      case "initialization":
        return <Settings className="h-4 w-4" />
      case "url-scan":
        return <Globe className="h-4 w-4" />
      case "file-detection":
        return <FileText className="h-4 w-4" />
      case "secret-detection":
        return <Shield className="h-4 w-4" />
      case "header-analysis":
        return <Search className="h-4 w-4" />
      case "repository-clone":
        return <GitBranch className="h-4 w-4" />
      case "owasp-analysis":
        return <AlertCircle className="h-4 w-4" />
      case "ai-analysis":
        return <Zap className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case "running":
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>
      default:
        return <Badge variant="outline">Initializing</Badge>
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A"
    const seconds = Math.floor(ms / 1000)
    return formatTime(seconds)
  }

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "text-gray-500"
    if (confidence >= 0.8) return "text-green-600"
    if (confidence >= 0.6) return "text-yellow-600"
    return "text-red-600"
  }

  const completedPhases = progress.phases.filter(p => p.status === "completed").length
  const totalPhases = progress.phases.length

  return (
    <div className="space-y-4">
      {/* Overall Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                  {progress.status === "running" && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                  {progress.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                  {progress.status === "failed" && <AlertCircle className="h-5 w-5 text-red-600" />}
                  <span>
                    {progress.scanType === "deep" ? "Deep Security Scan" : 
                     progress.scanType === "repository" ? "Repository Scan" : "URL Scan"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge(progress.status)}
              {onCancel && progress.status === "running" && (
                <button
                  onClick={onCancel}
                  className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <CardDescription>
            Scan ID: {progress.scanId} • Started: {new Date(progress.startTime).toLocaleTimeString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{Math.round(progress.overallProgress)}%</span>
            </div>
            <Progress value={progress.overallProgress} className="h-2" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Phases:</span>
              <span className="font-medium ml-1">{completedPhases}/{totalPhases}</span>
            </div>
            <div>
              <span className="text-gray-600">Elapsed:</span>
              <span className="font-medium ml-1">{formatTime(elapsedTime)}</span>
            </div>
            {progress.estimatedTimeRemaining && (
              <div>
                <span className="text-gray-600">Remaining:</span>
                <span className="font-medium ml-1">{formatTime(progress.estimatedTimeRemaining)}</span>
              </div>
            )}
            {progress.totalFindings !== undefined && (
              <div>
                <span className="text-gray-600">Findings:</span>
                <span className="font-medium ml-1">{progress.totalFindings}</span>
              </div>
            )}
          </div>

          {/* Current Phase */}
          {progress.currentPhase && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Currently: {progress.phases.find(p => p.id === progress.currentPhase)?.name || progress.currentPhase}
                </span>
              </div>
            </div>
          )}

          {/* Errors */}
          {progress.errors && progress.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Errors Encountered</span>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {progress.errors.map((error, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span>•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Phase Progress */}
      {showDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Phases</CardTitle>
            <CardDescription>Detailed progress for each scan phase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {progress.phases.map((phase, index) => (
                <div key={phase.id} className="flex items-center space-x-4 p-3 rounded-lg border">
                  {/* Phase Number */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>

                  {/* Phase Icon */}
                  <div className="flex-shrink-0">
                    {getPhaseTypeIcon(phase.id)}
                  </div>

                  {/* Phase Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900">{phase.name}</h4>
                      {getPhaseIcon(phase)}
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{phase.description}</p>
                    
                    {/* Progress Bar for Running Phase */}
                    {phase.status === "running" && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{Math.round(phase.progress)}%</span>
                        </div>
                        <Progress value={phase.progress} className="h-1" />
                      </div>
                    )}

                    {/* Phase Details */}
                    {phase.details && (
                      <p className="text-xs text-gray-500 mt-1">{phase.details}</p>
                    )}
                  </div>

                  {/* Phase Stats */}
                  <div className="flex-shrink-0 text-right space-y-1">
                    {phase.duration && (
                      <div className="text-xs text-gray-500">
                        {formatDuration(phase.duration)}
                      </div>
                    )}
                    {phase.confidence && (
                      <div className={`text-xs font-medium ${getConfidenceColor(phase.confidence)}`}>
                        {Math.round(phase.confidence * 100)}% confidence
                      </div>
                    )}
                    {phase.status === "completed" && (
                      <div className="text-xs text-green-600 font-medium">
                        ✓ Complete
                      </div>
                    )}
                    {phase.status === "failed" && (
                      <div className="text-xs text-red-600 font-medium">
                        ✗ Failed
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
