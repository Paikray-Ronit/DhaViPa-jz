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
  try {
    console.log(`Attempting to resolve domain: ${target}`)
    const response = await fetch(`https://dns.google/resolve?name=${target}&type=A`, {
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`DNS resolution failed with status: ${response.status}`)
    }

    const data = await response.json()
    console.log("DNS response:", data)

    if (data.Answer && data.Answer.length > 0) {
      const ip = data.Answer[0].data
      console.log(`Resolved ${target} to ${ip}`)
      return ip
    }
  } catch (error) {
    console.error("DNS resolution failed:", error)
    throw new Error(`Could not resolve domain ${target} to IP address`)
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
    const body = await request.json()
    const { target } = body

    console.log("Scan request received for target:", target)

    if (!target || typeof target !== "string") {
      console.log("Invalid target provided:", target)
      return NextResponse.json({ error: "Target is required and must be a string" }, { status: 400 })
    }

    const trimmedTarget = target.trim()
    if (!trimmedTarget) {
      return NextResponse.json({ error: "Target cannot be empty" }, { status: 400 })
    }

    // Basic validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/

    if (!ipRegex.test(trimmedTarget) && !domainRegex.test(trimmedTarget)) {
      return NextResponse.json({ error: "Invalid IP address or domain name format" }, { status: 400 })
    }

    // Resolve domain to IP if necessary
    let ip: string
    try {
      ip = await resolveToIP(trimmedTarget)
      console.log("Target resolved to IP:", ip)
    } catch (error) {
      console.error("Resolution error:", error)
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to resolve target",
        },
        { status: 400 },
      )
    }

    // Fetch data from InternetDB
    console.log("Fetching data from InternetDB for IP:", ip)
    const internetDbUrl = `https://internetdb.shodan.io/${ip}`

    let response: Response
    try {
      response = await fetch(internetDbUrl, {
        method: "GET",
        headers: {
          "User-Agent": "DhaViPa-Security-Scanner/1.0",
          Accept: "application/json",
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })
    } catch (error) {
      console.error("Network error when fetching from InternetDB:", error)
      return NextResponse.json(
        {
          error: "Network error: Unable to connect to security database. Please try again.",
        },
        { status: 503 },
      )
    }

    console.log("InternetDB response status:", response.status)

    if (!response.ok) {
      if (response.status === 404) {
        console.log("No data found for IP:", ip)
        // Return empty result instead of error for 404
        const emptyResult = {
          ip: ip,
          ports: [],
          cpes: [],
          hostnames: [],
          tags: [],
          vulns: [],
          summary: `📍 IP Address: ${ip}\n🔐 Vulnerabilities (CVEs): No known security flaws detected\n⚠️ Risk Level: Low`,
          riskLevel: "Low" as const,
        }
        return NextResponse.json(emptyResult)
      }

      const errorText = await response.text().catch(() => "Unknown error")
      console.error("InternetDB API error:", response.status, errorText)
      return NextResponse.json(
        {
          error: `Security database error (${response.status}). Please try again later.`,
        },
        { status: 502 },
      )
    }

    let data: InternetDBResponse
    try {
      const responseText = await response.text()
      console.log("Raw InternetDB response:", responseText.substring(0, 500))
      data = JSON.parse(responseText)
    } catch (error) {
      console.error("Failed to parse InternetDB response:", error)
      return NextResponse.json(
        {
          error: "Invalid response from security database. Please try again.",
        },
        { status: 502 },
      )
    }

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

    console.log("Scan completed successfully for:", ip, "Vulnerabilities found:", result.vulns.length)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Unexpected scan error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? `Scan failed: ${error.message}` : "Unexpected error occurred during scan",
      },
      { status: 500 },
    )
  }
}
