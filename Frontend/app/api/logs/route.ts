import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

type CSVLogEntry = {
  service: string
  event: string
  user?: string
  filename?: string
  mime_type?: string
  timestamp: string
  query?: string
  duration_ms?: string
  endpoint?: string
  method?: string
  user_id?: string
  ip?: string
  status_code?: string
  latency_ms?: string
  level?: string
  commit_hash?: string
  label?: string
  secret_name?: string
  table?: string
  rows_count?: string
  reason?: string
  path?: string
  attempt_count?: string
  exception_type?: string
  stack_trace?: string
  message?: string
  file_count?: string
  time_window_min?: string
  action?: string
  locations?: string
  time_diff_sec?: string
  key?: string
  detected_mime?: string
}

type LogEntry = {
  id: string
  ts: string
  type: "auth" | "api" | "error" | "db" | "file" | "config" | "user"
  message: string
  level?: "info" | "warn" | "error"
  isAnomaly?: boolean
}

function mapServiceToType(service: string): LogEntry['type'] {
  switch (service.toLowerCase()) {
    case 'auth-server':
      return 'auth'
    case 'api-gateway':
      return 'api'
    case 'app-server':
    case 'app-frontend':
    case 'app-backend':
      return 'api'
    case 'db-monitor':
      return 'db'
    case 'file-service':
      return 'file'
    case 'config-manager':
    case 'ci-cd-pipeline':
      return 'config'
    case 'payment-api':
      return 'api'
    default:
      return 'user'
  }
}

function mapEventToMessage(entry: CSVLogEntry): string {
  const { service, event, user, endpoint, method, status_code, ip, query, reason, filename, message } = entry
  
  switch (event) {
    case 'login_success':
      return `Successful login for user ${user} (IP ${ip})`
    case 'login_failure':
      return `Failed login attempt for user ${user} (IP ${ip}) - ${reason}`
    case 'api_request':
      return `${method} ${endpoint} ${status_code} ${entry.latency_ms}ms`
    case 'query_executed':
      return `Database query: ${query} (${entry.duration_ms}ms)`
    case 'file_upload':
      return `File upload: ${filename} (${entry.mime_type})`
    case 'malicious_upload':
      return `Malicious file upload detected: ${filename} (${entry.detected_mime})`
    case 'download_spike':
      return `Download spike detected from IP ${ip} (${entry.file_count} files in ${entry.time_window_min}min)`
    case 'suspicious_query':
      return `Suspicious SQL pattern detected: ${query}`
    case 'large_export':
      return `Large data export: ${entry.rows_count} rows from ${entry.table}`
    case 'unauthorized_request':
      return `Unauthorized access attempt to ${endpoint} (IP ${ip})`
    case 'rate_limit_violation':
      return `Rate limit exceeded for ${endpoint} (IP ${ip})`
    case 'internal_server_error':
      return `Internal server error: ${endpoint} returned ${status_code}`
    case 'uncaught_exception':
      return `Unhandled exception: ${entry.exception_type} at ${entry.stack_trace}`
    case 'database_failure':
      return `Database connection lost`
    case 'secret_modified':
      return `Secret modified: ${entry.secret_name} by ${user}`
    case 'privilege_escalation_attempt':
      return `Privilege escalation attempt: ${entry.action} by ${user}`
    case 'unusual_navigation':
      return `Unusual navigation: ${user} accessed ${entry.path}`
    case 'failed_payment_attempts':
      return `Failed payment attempts: ${entry.attempt_count} attempts by ${user}`
    case 'suspicious_access':
      return `Suspicious access pattern: ${user} from ${entry.locations}`
    case 'code_deployment':
      return `Code deployment completed by ${user} (commit: ${entry.commit_hash})`
    case 'checkout_request':
      return `Checkout request processed: ${endpoint}`
    default:
      return message || `${event} from ${service}`
  }
}

function isAnomaly(entry: CSVLogEntry): boolean {
  return entry.label === 'anomaly' || 
         entry.level === 'ERROR' || 
         entry.level === 'CRITICAL' ||
         entry.level === 'WARN' ||
         entry.event.includes('failure') ||
         entry.event.includes('error') ||
         entry.event.includes('unauthorized') ||
         entry.event.includes('malicious') ||
         entry.event.includes('suspicious') ||
         entry.event.includes('large_export') ||
         entry.event.includes('privilege_escalation')
}

function mapLevel(entry: CSVLogEntry): LogEntry['level'] {
  if (entry.level === 'ERROR' || entry.level === 'CRITICAL') return 'error'
  if (entry.level === 'WARN') return 'warn'
  return 'info'
}

function parseCSV(csvText: string): CSVLogEntry[] {
  const lines = csvText.trim().split('\n')
  const headers = lines[0].split(',')
  
  return lines.slice(1).map(line => {
    const values = line.split(',')
    const entry: any = {}
    headers.forEach((header, index) => {
      entry[header.trim()] = values[index]?.trim() || ''
    })
    return entry as CSVLogEntry
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'merged' // 'good', 'bad', or 'merged'
    
    const csvPath = path.join(process.cwd(), '..', 'Resources', `${type}_logs.csv`)
    
    const csvContent = await fs.readFile(csvPath, 'utf-8')
    const csvEntries = parseCSV(csvContent)
    
    const logEntries: LogEntry[] = csvEntries.map((entry, index) => ({
      id: `${Date.now()}-${index}`,
      ts: new Date(entry.timestamp).toISOString(),
      type: mapServiceToType(entry.service),
      message: mapEventToMessage(entry),
      level: mapLevel(entry),
      isAnomaly: isAnomaly(entry)
    }))
    
    return NextResponse.json({ logs: logEntries })
  } catch (error) {
    console.error('Error reading CSV file:', error)
    return NextResponse.json({ error: 'Failed to read log data' }, { status: 500 })
  }
}
