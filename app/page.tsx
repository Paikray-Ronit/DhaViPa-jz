"use client"

import type React from "react"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Shield, Search, MessageCircle, Globe, AlertTriangle, Send, Loader2 } from "lucide-react"

interface ScanResult {
  ip: string
  ports: number[]
  cpes: string[]
  hostnames: string[]
  tags: string[]
  vulns: string[]
  summary: string
  riskLevel: "Low" | "Medium" | "High" | "Critical"
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  parts?: { type: string; text: string }[]
}

export default function DhaViPa() {
  const [target, setTarget] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState("")
  const [showChat, setShowChat] = useState(false)
  const [showDetailedVulns, setShowDetailedVulns] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Memoized risk color function for better performance
  const getRiskColor = useMemo(() => {
    return (risk: string) => {
      switch (risk) {
        case "Low":
          return "bg-green-100 text-green-800"
        case "Medium":
          return "bg-yellow-100 text-yellow-800"
        case "High":
          return "bg-orange-100 text-orange-800"
        case "Critical":
          return "bg-red-100 text-red-800"
        default:
          return "bg-gray-100 text-gray-800"
      }
    }
  }, [])

  const handleScan = async () => {
    if (!target.trim()) return

    setIsScanning(true)
    setError("")
    setScanResult(null)
    setShowChat(false)
    setMessages([]) // Clear previous chat

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim() }),
      })

      if (!response.ok) {
        throw new Error("Scan failed")
      }

      const result = await response.json()
      setScanResult(result)
      setShowChat(true)
    } catch (err) {
      setError("Failed to scan target. Please check the IP/domain and try again.")
    } finally {
      setIsScanning(false)
    }
  }

  // Optimized chat submit with debouncing
  const handleChatSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() || isLoading) return

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: input.trim(),
        parts: [{ type: "text", text: input.trim() }],
      }

      const newMessages = [...messages, userMessage]
      setMessages(newMessages)
      setInput("")
      setIsLoading(true)

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.slice(-6), // Only send last 6 messages for faster processing
            scanData: scanResult,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to get response")
        }

        const aiResponse = await response.json()

        const assistantMessage: ChatMessage = {
          id: aiResponse.id || `assistant-${Date.now()}`,
          role: "assistant",
          content: aiResponse.content,
          parts: aiResponse.parts || [{ type: "text", text: aiResponse.content }],
        }

        setMessages([...newMessages, assistantMessage])
      } catch (err) {
        console.error("Chat error:", err)
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I'm having trouble responding right now. Please try again.",
          parts: [{ type: "text", text: "Sorry, I'm having trouble responding right now. Please try again." }],
        }
        setMessages([...newMessages, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, messages, scanResult],
  )

  const handleDownload = async (format: "json" | "txt") => {
    if (!scanResult) return

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanResult, format }),
      })

      if (!response.ok) throw new Error("Download failed")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dhavipa-scan-${scanResult.ip}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download failed:", err)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">DhaViPa</h1>
          </div>
          <p className="text-xl text-gray-600 mb-2">Dynamic Host & Vulnerability Intelligence Partner</p>
          <p className="text-gray-500">AI-powered network security analysis and vulnerability assessment</p>
        </div>

        {/* Introduction Card */}
        {!scanResult && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Welcome to DhaViPa!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                I'm your AI-powered security assistant. I can help you analyze IP addresses and domains for:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span>Open ports and services</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span>Known vulnerabilities (CVEs) - Security flaws that need patching</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  <span>Security risk assessment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-purple-500" />
                  <span>Detailed reports</span>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Enter an IP address or domain name below to get started with your security analysis.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Scan Input */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Target Analysis
            </CardTitle>
            <CardDescription>
              Enter an IP address or domain name to scan for vulnerabilities and open ports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter IP address or domain (e.g., 8.8.8.8 or google.com)"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleScan()}
                className="flex-1"
              />
              <Button onClick={handleScan} disabled={isScanning || !target.trim()} className="min-w-[120px]">
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  "Scan Target"
                )}
              </Button>
            </div>
            {error && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Scan Results */}
        {scanResult && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Scan Results</span>
                  <Badge className={getRiskColor(scanResult.riskLevel)}>{scanResult.riskLevel} Risk</Badge>
                </CardTitle>
                <CardDescription>Analysis for {scanResult.ip}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">📍 IP Address</h4>
                  <p className="text-sm text-gray-600">{scanResult.ip}</p>
                </div>

                {scanResult.hostnames.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">🌍 Hostnames</h4>
                    <div className="flex flex-wrap gap-1">
                      {scanResult.hostnames.map((hostname, i) => (
                        <Badge key={i} variant="outline">
                          {hostname}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {scanResult.ports.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">📡 Open Ports ({scanResult.ports.length})</h4>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {scanResult.ports.map((port, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {port}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {scanResult.cpes && scanResult.cpes.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">🧩 CPE Information ({scanResult.cpes.length})</h4>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {scanResult.cpes.slice(0, 3).map((cpe, i) => (
                        <div key={i} className="text-xs bg-gray-100 p-2 rounded font-mono">
                          {cpe}
                        </div>
                      ))}
                      {scanResult.cpes.length > 3 && (
                        <div className="text-xs text-gray-500">+{scanResult.cpes.length - 3} more CPE entries</div>
                      )}
                    </div>
                  </div>
                )}

                {scanResult.vulns.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">🔐 Vulnerabilities (CVEs) - {scanResult.vulns.length} Found</h4>
                      <Button variant="ghost" size="sm" onClick={() => setShowDetailedVulns(!showDetailedVulns)}>
                        {showDetailedVulns ? "Show Less" : "Show All CVEs"}
                      </Button>
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                      CVE = Common Vulnerabilities and Exposures - Known security flaws
                    </div>

                    {!showDetailedVulns ? (
                      <div className="flex flex-wrap gap-1">
                        {scanResult.vulns.slice(0, 6).map((vuln, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">
                            {vuln}
                          </Badge>
                        ))}
                        {scanResult.vulns.length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{scanResult.vulns.length - 6} more CVEs
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                          <h5 className="font-semibold text-red-800 text-sm mb-1">⚠️ Security Alert</h5>
                          <p className="text-xs text-red-700">
                            This system has <strong>{scanResult.vulns.length} known vulnerabilities</strong> that could
                            be exploited by attackers. Each CVE represents a specific security flaw that should be
                            patched immediately.
                          </p>
                        </div>
                        <ScrollArea className="h-40 w-full border rounded p-2">
                          <div className="grid grid-cols-1 gap-1">
                            {scanResult.vulns.map((vuln, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between bg-red-50 p-2 rounded border-l-4 border-red-400"
                              >
                                <Badge variant="destructive" className="text-xs">
                                  {vuln}
                                </Badge>
                                <span className="text-xs text-gray-500">Vulnerability #{i + 1}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                )}

                {scanResult.tags.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">🏷️ Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {scanResult.tags.map((tag, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={
                            tag === "eol-product"
                              ? "border-red-300 text-red-700"
                              : tag === "self-signed"
                                ? "border-yellow-300 text-yellow-700"
                                : ""
                          }
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  <Button onClick={() => handleDownload("json")} variant="outline" size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    JSON Report
                  </Button>
                  <Button onClick={() => handleDownload("txt")} variant="outline" size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Text Report
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Chat Interface */}
            {showChat && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    AI Analysis Chat
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                  </CardTitle>
                  <CardDescription>
                    Ask me questions about the scan results, vulnerabilities, or security recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] mb-4 p-4 border rounded-lg">
                    {messages.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Ask me anything about the scan results!</p>
                        <p className="text-sm mt-1">
                          Try: "What are the security risks?" or "Explain the vulnerabilities"
                        </p>
                      </div>
                    )}
                    {messages.map((message) => (
                      <div key={message.id} className="mb-4">
                        <div
                          className={`p-3 rounded-lg ${
                            message.role === "user" ? "bg-blue-100 ml-8" : "bg-gray-100 mr-8"
                          }`}
                        >
                          <div className="font-semibold text-sm mb-1">
                            {message.role === "user" ? "You" : "DhaViPa AI"}
                          </div>
                          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="bg-gray-100 mr-8 p-3 rounded-lg">
                        <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                          DhaViPa AI
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </div>
                        <div className="text-sm">Analyzing security data...</div>
                      </div>
                    )}
                  </ScrollArea>

                  <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about vulnerabilities, risks, or recommendations..."
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Developer Information Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              About DhaViPa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">🚀 What is DhaViPa?</h4>
                <p className="text-sm text-gray-600 mb-4">
                  DhaViPa (Dynamic Host & Vulnerability Intelligence Partner) is an AI-powered cybersecurity tool that
                  helps identify vulnerabilities, analyze network security, and provide actionable insights for better
                  protection against cyber threats.
                </p>

                <h4 className="font-semibold mb-2">🔧 Key Features</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Real-time vulnerability scanning</li>
                  <li>• AI-powered security analysis</li>
                  <li>• Comprehensive reporting (JSON/TXT)</li>
                  <li>• Interactive chat for security guidance</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">👨‍💻 Developer</h4>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm mb-2">
                    <strong>Ronit Paikray</strong> - Cybersecurity Researcher & Developer
                  </p>
                  <p className="text-xs text-gray-600 mb-3">
                    Passionate developer, cybersecurity enthusiast, and creator of The Desi Digital Defender. Ronit
                    specializes in ethical hacking, security research, and building advanced AI-powered cybersecurity
                    tools.
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">Ethical Hacker</Badge>
                    <Badge variant="outline">AI Developer</Badge>
                    <Badge variant="outline">Security Researcher</Badge>
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  <p>🛡️ Founder: The Desi Digital Defender</p>
                  <p>🔬 Focus: Advanced cybersecurity tools & AI systems</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
