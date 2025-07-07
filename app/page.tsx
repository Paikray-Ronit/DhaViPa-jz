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
import {
  Download,
  Shield,
  Search,
  MessageCircle,
  Globe,
  AlertTriangle,
  Send,
  Loader2,
  Terminal,
  Zap,
  Lock,
} from "lucide-react"

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

  // Memoized risk color function for cybersecurity theme
  const getRiskColor = useMemo(() => {
    return (risk: string) => {
      switch (risk) {
        case "Low":
          return "bg-green-900/30 text-green-400 border-green-500/50 cyber-glow"
        case "Medium":
          return "bg-yellow-900/30 text-yellow-400 border-yellow-500/50"
        case "High":
          return "bg-orange-900/30 text-orange-400 border-orange-500/50"
        case "Critical":
          return "bg-red-900/30 text-red-400 border-red-500/50 cyber-glow-red"
        default:
          return "bg-gray-900/30 text-gray-400 border-gray-500/50"
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
      setError("SCAN_ERROR: Failed to analyze target. Check IP/domain and retry.")
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
          content: "ERROR: AI_RESPONSE_FAILED - Connection to intelligence network interrupted. Retry operation.",
          parts: [
            {
              type: "text",
              text: "ERROR: AI_RESPONSE_FAILED - Connection to intelligence network interrupted. Retry operation.",
            },
          ],
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
    <div className="min-h-screen bg-black matrix-bg p-4 font-mono">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <div className="absolute inset-0 scan-line opacity-20"></div>
          <div className="flex items-center justify-center gap-3 mb-4 relative z-10">
            <Shield className="h-12 w-12 text-[#00BFFF] cyber-glow-blue animate-pulse" />
            <h1 className="text-5xl font-bold text-[#00FF00] cyber-glow tracking-wider">DhaViPa</h1>
            <Terminal className="h-8 w-8 text-[#00BFFF] cyber-glow-blue" />
          </div>
          <p className="text-xl text-[#00BFFF] mb-2 font-semibold tracking-wide">
            &gt; DYNAMIC_HOST_&_VULNERABILITY_INTELLIGENCE_PARTNER
          </p>
          <p className="text-gray-400 font-mono text-sm">
            [SYSTEM_ONLINE] AI-powered network security analysis and vulnerability assessment
          </p>
        </div>

        {/* Introduction Card */}
        {!scanResult && (
          <Card className="mb-8 bg-gray-900/50 border-[#00FF00]/30 cyber-glow backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#00BFFF]">
                <MessageCircle className="h-5 w-5" />
                [WELCOME_TO_DHAVIPA_SYSTEM]
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-4 font-mono">
                &gt; INITIALIZING_AI_SECURITY_ASSISTANT...
                <br />
                &gt; LOADING_VULNERABILITY_DATABASE...
                <br />
                &gt; SYSTEM_READY_FOR_ANALYSIS
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2 p-2 bg-gray-800/30 rounded terminal-border">
                  <Globe className="h-4 w-4 text-[#00BFFF]" />
                  <span className="text-gray-300 text-sm">PORT_SCANNING & SERVICE_DETECTION</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-800/30 rounded terminal-border">
                  <AlertTriangle className="h-4 w-4 text-[#FF3C3C]" />
                  <span className="text-gray-300 text-sm">CVE_VULNERABILITY_ANALYSIS</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-800/30 rounded terminal-border">
                  <Shield className="h-4 w-4 text-[#00FF00]" />
                  <span className="text-gray-300 text-sm">SECURITY_RISK_ASSESSMENT</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-800/30 rounded terminal-border">
                  <Download className="h-4 w-4 text-[#00BFFF]" />
                  <span className="text-gray-300 text-sm">DETAILED_REPORT_GENERATION</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 font-mono">
                [INFO] Enter target IP address or domain name to initiate security scan...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Scan Input */}
        <Card className="mb-8 bg-gray-900/50 border-[#00BFFF]/30 cyber-glow-blue backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#00FF00]">
              <Search className="h-5 w-5" />
              [TARGET_ANALYSIS_MODULE]
            </CardTitle>
            <CardDescription className="text-gray-400 font-mono">&gt; INPUT: IP_ADDRESS || DOMAIN_NAME</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="192.168.1.1 || example.com || 8.8.8.8"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleScan()}
                className="flex-1 bg-gray-800/50 border-[#00FF00]/50 text-[#00FF00] placeholder-gray-500 font-mono cyber-glow"
              />
              <Button
                onClick={handleScan}
                disabled={isScanning || !target.trim()}
                className="min-w-[140px] bg-[#00BFFF]/20 border border-[#00BFFF] text-[#00BFFF] hover:bg-[#00BFFF]/30 cyber-glow-blue font-mono"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    SCANNING...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    EXECUTE_SCAN
                  </>
                )}
              </Button>
            </div>
            {error && (
              <Alert className="mt-4 bg-red-900/30 border-[#FF3C3C]/50 cyber-glow-red">
                <AlertTriangle className="h-4 w-4 text-[#FF3C3C]" />
                <AlertDescription className="text-[#FF3C3C] font-mono">[ERROR] {error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Scan Results */}
        {scanResult && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <Card className="bg-gray-900/50 border-[#00FF00]/30 cyber-glow backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-[#00FF00]">
                  <span className="font-mono">[SCAN_RESULTS]</span>
                  <Badge className={`${getRiskColor(scanResult.riskLevel)} font-mono border`}>
                    {scanResult.riskLevel.toUpperCase()}_RISK
                  </Badge>
                </CardTitle>
                <CardDescription className="text-gray-400 font-mono">TARGET: {scanResult.ip}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-gray-800/30 rounded terminal-border">
                  <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono">📍 IP_ADDRESS</h4>
                  <p className="text-sm text-[#00FF00] font-mono">{scanResult.ip}</p>
                </div>

                {scanResult.hostnames.length > 0 && (
                  <div className="p-3 bg-gray-800/30 rounded terminal-border">
                    <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono">🌍 HOSTNAMES</h4>
                    <div className="flex flex-wrap gap-1">
                      {scanResult.hostnames.map((hostname, i) => (
                        <Badge key={i} className="bg-gray-700/50 text-[#00FF00] border-[#00FF00]/30 font-mono text-xs">
                          {hostname}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {scanResult.ports.length > 0 && (
                  <div className="p-3 bg-gray-800/30 rounded terminal-border">
                    <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono">
                      📡 OPEN_PORTS ({scanResult.ports.length})
                    </h4>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {scanResult.ports.map((port, i) => (
                        <Badge key={i} className="bg-blue-900/30 text-[#00BFFF] border-[#00BFFF]/30 font-mono text-xs">
                          {port}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {scanResult.vulns.length > 0 && (
                  <div className="p-3 bg-red-900/20 rounded border border-[#FF3C3C]/30 cyber-glow-red">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-[#FF3C3C] font-mono">
                        🔐 VULNERABILITIES ({scanResult.vulns.length})
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDetailedVulns(!showDetailedVulns)}
                        className="text-[#FF3C3C] hover:bg-red-900/30 font-mono text-xs"
                      >
                        {showDetailedVulns ? "HIDE" : "SHOW_ALL"}
                      </Button>
                    </div>

                    <div className="text-xs text-gray-400 mb-2 font-mono">
                      [CVE_DATABASE] Common Vulnerabilities and Exposures
                    </div>

                    {!showDetailedVulns ? (
                      <div className="flex flex-wrap gap-1">
                        {scanResult.vulns.slice(0, 6).map((vuln, i) => (
                          <Badge key={i} className="bg-red-900/30 text-[#FF3C3C] border-[#FF3C3C]/50 font-mono text-xs">
                            {vuln}
                          </Badge>
                        ))}
                        {scanResult.vulns.length > 6 && (
                          <Badge className="bg-gray-700/50 text-gray-400 border-gray-500/30 font-mono text-xs">
                            +{scanResult.vulns.length - 6}_MORE
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <ScrollArea className="h-40 w-full border border-[#FF3C3C]/30 rounded p-2 bg-black/30">
                        <div className="grid grid-cols-1 gap-1">
                          {scanResult.vulns.map((vuln, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between bg-red-900/20 p-2 rounded border-l-4 border-[#FF3C3C]"
                            >
                              <Badge className="bg-red-900/30 text-[#FF3C3C] border-[#FF3C3C]/50 font-mono text-xs">
                                {vuln}
                              </Badge>
                              <span className="text-xs text-gray-500 font-mono">VULN_#{i + 1}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}

                <Separator className="bg-[#00FF00]/30" />

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload("json")}
                    className="flex-1 bg-gray-800/50 border border-[#00BFFF]/50 text-[#00BFFF] hover:bg-[#00BFFF]/20 font-mono text-xs"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    JSON_EXPORT
                  </Button>
                  <Button
                    onClick={() => handleDownload("txt")}
                    className="flex-1 bg-gray-800/50 border border-[#00BFFF]/50 text-[#00BFFF] hover:bg-[#00BFFF]/20 font-mono text-xs"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    TXT_EXPORT
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Chat Interface */}
            {showChat && (
              <Card className="bg-gray-900/50 border-[#00BFFF]/30 cyber-glow-blue backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#00BFFF]">
                    <MessageCircle className="h-5 w-5" />
                    [AI_INTELLIGENCE_TERMINAL]
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-[#00FF00]" />}
                  </CardTitle>
                  <CardDescription className="text-gray-400 font-mono">
                    &gt; QUERY_AI_FOR_SECURITY_ANALYSIS
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] mb-4 p-4 border border-[#00FF00]/30 rounded-lg bg-black/50 terminal-border">
                    {messages.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="font-mono">[READY] AI_SYSTEM_ONLINE</p>
                        <p className="text-sm mt-1 font-mono">
                          &gt; TRY: "analyze vulnerabilities" || "security recommendations"
                        </p>
                      </div>
                    )}
                    {messages.map((message) => (
                      <div key={message.id} className="mb-4">
                        <div
                          className={`p-3 rounded-lg font-mono text-sm ${
                            message.role === "user"
                              ? "bg-[#00BFFF]/10 ml-8 border border-[#00BFFF]/30"
                              : "bg-[#00FF00]/10 mr-8 border border-[#00FF00]/30"
                          }`}
                        >
                          <div className="font-semibold text-xs mb-1">
                            {message.role === "user" ? "[USER]" : "[DHAVIPA_AI]"}
                          </div>
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="bg-[#00FF00]/10 mr-8 p-3 rounded-lg border border-[#00FF00]/30">
                        <div className="font-semibold text-sm mb-1 flex items-center gap-2 font-mono">
                          [DHAVIPA_AI]
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </div>
                        <div className="text-sm font-mono">&gt; PROCESSING_SECURITY_DATA...</div>
                      </div>
                    )}
                  </ScrollArea>

                  <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="&gt; query_ai_system..."
                      disabled={isLoading}
                      className="flex-1 bg-gray-800/50 border-[#00FF00]/50 text-[#00FF00] placeholder-gray-500 font-mono"
                    />
                    <Button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className="bg-[#00FF00]/20 border border-[#00FF00] text-[#00FF00] hover:bg-[#00FF00]/30 cyber-glow"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Developer Information Section */}
        <Card className="mb-8 bg-gray-900/50 border-[#00BFFF]/30 cyber-glow-blue backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#00FF00]">
              <Lock className="h-5 w-5" />
              [SYSTEM_INFORMATION]
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-800/30 rounded terminal-border">
                <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono">🚀 DHAVIPA_SYSTEM</h4>
                <p className="text-sm text-gray-300 mb-4 font-mono">
                  &gt; DYNAMIC_HOST_&_VULNERABILITY_INTELLIGENCE_PARTNER
                  <br />
                  &gt; AI-POWERED_CYBERSECURITY_ANALYSIS_PLATFORM
                  <br />
                  &gt; REAL-TIME_THREAT_ASSESSMENT_ENGINE
                </p>

                <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono">🔧 CAPABILITIES</h4>
                <ul className="text-sm text-gray-300 space-y-1 font-mono">
                  <li>&gt; VULNERABILITY_SCANNING</li>
                  <li>&gt; AI_SECURITY_ANALYSIS</li>
                  <li>&gt; COMPREHENSIVE_REPORTING</li>
                  <li>&gt; INTERACTIVE_AI_GUIDANCE</li>
                </ul>
              </div>

              <div className="p-4 bg-gray-800/30 rounded terminal-border">
                <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono">👨‍💻 DEVELOPER</h4>
                <div className="bg-[#00FF00]/10 p-4 rounded-lg border border-[#00FF00]/30">
                  <p className="text-sm mb-2 font-mono">
                    <strong className="text-[#00FF00]">RONIT_PAIKRAY</strong> - CYBERSECURITY_RESEARCHER
                  </p>
                  <p className="text-xs text-gray-400 mb-3 font-mono">
                    &gt; ETHICAL_HACKER & AI_DEVELOPER
                    <br />
                    &gt; FOUNDER: THE_DESI_DIGITAL_DEFENDER
                    <br />
                    &gt; SPECIALIZATION: ADVANCED_CYBERSECURITY_TOOLS
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge className="bg-[#00FF00]/20 text-[#00FF00] border-[#00FF00]/50 font-mono">
                      ETHICAL_HACKER
                    </Badge>
                    <Badge className="bg-[#00BFFF]/20 text-[#00BFFF] border-[#00BFFF]/50 font-mono">AI_DEV</Badge>
                    <Badge className="bg-[#FF3C3C]/20 text-[#FF3C3C] border-[#FF3C3C]/50 font-mono">SEC_RESEARCH</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
