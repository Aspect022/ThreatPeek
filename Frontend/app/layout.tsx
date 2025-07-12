import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "ThreatPeek - AI-Powered Threat Detection at a Glance",
  description:
    "Advanced security scanner that detects exposed API keys, secrets, and vulnerabilities in web applications using AI-powered analysis. Protect your applications from security threats.",
  keywords:
    "security scanner, API key detection, vulnerability scanner, threat detection, web security, cybersecurity, AI security analysis",
  authors: [{ name: "ThreatPeek Team" }],
  creator: "ThreatPeek",
  publisher: "ThreatPeek",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://threatpeek.com",
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
    creator: "@threatpeek",
  },
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#1f2937",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", sizes: "16x16", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#1f2937" }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://threatpeek.com" />
        <meta name="google-site-verification" content="your-google-verification-code" />
      </head>
      <body>{children}</body>
    </html>
  )
}
