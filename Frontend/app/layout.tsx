import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { SiteHeader } from "@/components/site-header"

// ✅ put viewport in its own export
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1f2937",
}

// ✅ keep metadata clean
export const metadata: Metadata = {
  metadataBase: new URL("https://threat-peek.vercel.app"),
  title: "ThreatPeek - AI-Powered Threat Detection at a Glance",
  description:
    "Advanced security scanner that detects exposed API keys, secrets, and vulnerabilities in web applications using AI-powered analysis. Protect your applications from security threats.",
  keywords:
    "security scanner, API key detection, vulnerability scanner, threat detection, web security, cybersecurity, AI security analysis",
  authors: [{ name: "ThreatPeek Team" }],
  creator: "Aspect022",
  publisher: "Jayesh RL",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://threat-peek.vercel.app/",
    title: "ThreatPeek - AI-Powered Threat Detection at a Glance",
    description:
      "Advanced security scanner that detects exposed API keys, secrets, and vulnerabilities in web applications using AI-powered analysis.",
    siteName: "ThreatPeek",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ThreatPeek - AI-Powered Security Scanner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ThreatPeek - AI-Powered Threat Detection at a Glance",
    description:
      "Advanced security scanner that detects exposed API keys, secrets, and vulnerabilities in web applications.",
    images: ["/og-image.png"],
    creator: "@aspect022",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", sizes: "16x16", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#1f2937" }],
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://threat-peek.vercel.app/" />
        <meta
          name="google-site-verification"
          content="3GE1m3-R_XNICm5gEvZhqkEecTNsIuqbwEclp3jWAAU"
        />
      </head>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  )
}
