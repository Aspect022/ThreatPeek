import { getFirestoreDb } from "@/lib/firebase"
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"

const ORG_ID = "defaultOrg"
const PROJECT_ID = "defaultProject"

export type SeverityCounts = {
  critical: number
  high: number
  medium: number
  low: number
}

export type ScanRecord = {
  status: string
  startedAt?: string | Date
  endedAt?: string | Date
  severityCounts: SeverityCounts
  aiSummary?: string
  findings: any[]
  reportLink?: string
}

export function scanDocRef(scanId: string) {
  const db = getFirestoreDb()
  return doc(db, `orgs/${ORG_ID}/projects/${PROJECT_ID}/scans/${scanId}`)
}

export async function upsertScanRecord(scanId: string, data: ScanRecord) {
  await setDoc(
    scanDocRef(scanId),
    {
      ...data,
      // also keep server timestamps for querying in Firestore
      startedAtServer: serverTimestamp(),
      endedAtServer: data.endedAt ? serverTimestamp() : null,
    },
    { merge: true },
  )
}

export async function updateScanSummary(scanId: string, aiSummary: string) {
  await updateDoc(scanDocRef(scanId), { aiSummary })
}

export async function updateScanReportLink(scanId: string, reportLink: string) {
  await updateDoc(scanDocRef(scanId), { reportLink })
}
