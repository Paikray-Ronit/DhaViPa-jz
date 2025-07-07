import { type NextRequest, NextResponse } from "next/server"

interface InternetDBResponse {
  ip: string
  ports?: number[]
  cpes?: string[]
  hostnames?: string[]
  tags?: string[]
  vulns?: string[]
}

async function resolveToIP(target: string): Promise<string> {
  // Simple IP validation regex
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

  if (ipRegex.test(target)) {
    return target
  }

  // For domains, we'll use a DNS resolution approach
  // In a real implementation, you might want to use a proper DNS library
  try {
    const response = await fetch(`https://dns.google/resolve?name=${target}&type=A`)
    const data = await response.json()

    if (data.Answer && data.Answer.length > 0) {
      return data.Answer[0].data
    }
  } catch (error) {
    console.error("DNS resolution failed:", error)
  }

  throw new Error("Could not resolve domain to IP address")
}

function calculateRiskLevel(data: InternetDBResponse): "Low" | "Medium" | "High" | "Critical" {
  const vulnCount = data.vulns?.length || 0
  const portCount = data.ports?.length || 0

  if (vulnCount >= 10 || portCount >= 20) return "Critical"
  if (vulnCount >= 5 || portCount >= 10) return "High"
  if (vulnCount >= 1 || portCount >= 5) return "Medium"
  return "Low"
}

function generateSummary(data: InternetDBResponse): string {
  const parts = []

  parts.push(`📍 IP Address: ${data.ip}`)

  if (data.hostnames && data.hostnames.length > 0) {
    parts.push(`🌍 Hostnames: ${data.hostnames.join(", ")}`)
  }

  if (data.ports && data.ports.length > 0) {
    parts.push(`📡 Open Ports: ${data.ports.join(", ")}`)
  }

  if (data.vulns && data.vulns.length > 0) {
    parts.push(
      `🔐 Vulnerabilities (CVEs): ${data.vulns.length} security flaws found - ${data.vulns.slice(0, 3).join(", ")}${data.vulns.length > 3 ? ` (+${data.vulns.length - 3} more)` : ""}`,
    )
  } else {
    parts.push(`🔐 Vulnerabilities (CVEs): No known security flaws detected`)
  }

  if (data.cpes && data.cpes.length > 0) {
    parts.push(`🧩 CPE: ${data.cpes.slice(0, 2).join(", ")}`)
  }

  if (data.tags && data.tags.length > 0) {
    parts.push(`🏷️ Tags: ${data.tags.join(", ")}`)
  }

  const riskLevel = calculateRiskLevel(data)
  parts.push(`⚠️ Risk Level: ${riskLevel}`)

  return parts.join("\n")
}

export async function POST(request: NextRequest) {
  try {
    const { target } = await request.json()

    if (!target) {
      return NextResponse.json({ error: "Target is required" }, { status: 400 })
    }

    // Resolve domain to IP if necessary
    const ip = await resolveToIP(target)

    // Fetch data from InternetDB
    const response = await fetch(`https://internetdb.shodan.io/${ip}`)

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "No information found for this IP address" }, { status: 404 })
      }
      throw new Error("Failed to fetch scan data")
    }

    const data: InternetDBResponse = await response.json()

    // Process and format the results
    const result = {
      ip: data.ip,
      ports: data.ports || [],
      cpes: data.cpes || [],
      hostnames: data.hostnames || [],
      tags: data.tags || [],
      vulns: data.vulns || [],
      summary: generateSummary(data),
      riskLevel: calculateRiskLevel(data),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Scan error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Scan failed" }, { status: 500 })
  }
}
