"use client"

import type React from "react"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
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
  ChevronDown,
  ChevronUp,
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

  // UI state
  const [isMobile, setIsMobile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
      console.log("Starting scan for target:", target.trim())

      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim() }),
      })

      console.log("Scan response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log("Scan completed successfully:", result)
      setScanResult(result)
      setShowChat(true)
    } catch (err) {
      console.error("Scan error:", err)
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(`SCAN_ERROR: ${errorMessage}`)
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
    <div className="min-h-screen bg-black matrix-bg font-mono">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-[#00FF00]/30 px-4 py-3 md:py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-2 md:gap-3">
            <Shield className="h-6 w-6 md:h-8 md:w-8 text-[#00BFFF] cyber-glow-blue animate-pulse" />
            <h1 className="text-2xl md:text-4xl font-bold text-[#00FF00] cyber-glow tracking-wider">DhaViPa</h1>
            <Terminal className="h-4 w-4 md:h-6 md:w-6 text-[#00BFFF] cyber-glow-blue" />
          </div>
          <p className="text-center text-sm md:text-lg text-[#00BFFF] mt-1 font-semibold tracking-wide">
            Dynamic Host & Vulnerability Intelligence Partner
          </p>
          <p className="text-center text-xs md:text-sm text-gray-400 mt-1 font-mono leading-relaxed">
            AI-powered network security analysis and vulnerability assessment
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 pb-20 md:pb-8">
        {/* Introduction Card */}
        {!scanResult && (
          <Card className="mb-6 md:mb-8 bg-gray-900/50 border-[#00FF00]/30 cyber-glow backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-[#00BFFF] text-lg md:text-xl">
                <MessageCircle className="h-5 w-5" />
                [WELCOME_TO_DHAVIPA_SYSTEM]
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-4 font-mono text-sm md:text-base leading-relaxed">
                &gt; INITIALIZING_AI_SECURITY_ASSISTANT...
                <br />
                &gt; LOADING_VULNERABILITY_DATABASE...
                <br />
                &gt; SYSTEM_READY_FOR_ANALYSIS
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded terminal-border">
                  <Globe className="h-4 w-4 text-[#00BFFF] flex-shrink-0" />
                  <span className="text-gray-300 text-xs md:text-sm">PORT_SCANNING & SERVICE_DETECTION</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded terminal-border">
                  <AlertTriangle className="h-4 w-4 text-[#FF3C3C] flex-shrink-0" />
                  <span className="text-gray-300 text-xs md:text-sm">CVE_VULNERABILITY_ANALYSIS</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded terminal-border">
                  <Shield className="h-4 w-4 text-[#00FF00] flex-shrink-0" />
                  <span className="text-gray-300 text-xs md:text-sm">SECURITY_RISK_ASSESSMENT</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded terminal-border">
                  <Download className="h-4 w-4 text-[#00BFFF] flex-shrink-0" />
                  <span className="text-gray-300 text-xs md:text-sm">DETAILED_REPORT_GENERATION</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 font-mono leading-relaxed">
                [INFO] Enter target IP address or domain name to initiate security scan...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Scan Input */}
        <Card className="mb-6 md:mb-8 bg-gray-900/50 border-[#00BFFF]/30 cyber-glow-blue backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-[#00FF00] text-lg md:text-xl">
              <Search className="h-5 w-5" />
              [TARGET_ANALYSIS_MODULE]
            </CardTitle>
            <CardDescription className="text-gray-400 font-mono text-sm md:text-base">
              &gt; INPUT: IP_ADDRESS || DOMAIN_NAME
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <Input
                placeholder="192.168.1.1 || example.com || 8.8.8.8"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleScan()}
                className="flex-1 bg-gray-800/50 border-[#00FF00]/50 text-[#00FF00] placeholder-gray-500 font-mono cyber-glow text-base md:text-sm h-12 md:h-10"
              />
              <Button
                onClick={handleScan}
                disabled={isScanning || !target.trim()}
                className="w-full sm:w-auto min-w-[140px] h-12 md:h-10 bg-[#00BFFF]/20 border border-[#00BFFF] text-[#00BFFF] hover:bg-[#00BFFF]/30 cyber-glow-blue font-mono text-sm md:text-xs"
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
                <AlertDescription className="text-[#FF3C3C] font-mono text-sm md:text-xs break-words">
                  [ERROR] {error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Scan Results */}
        {scanResult && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-8">
            <Card className="bg-gray-900/50 border-[#00FF00]/30 cyber-glow backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between text-[#00FF00] text-lg md:text-xl">
                  <span className="font-mono">[SCAN_RESULTS]</span>
                  <Badge className={`${getRiskColor(scanResult.riskLevel)} font-mono border text-xs md:text-sm`}>
                    {scanResult.riskLevel.toUpperCase()}_RISK
                  </Badge>
                </CardTitle>
                <CardDescription className="text-gray-400 font-mono text-sm md:text-base break-all">
                  TARGET: {scanResult.ip}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-gray-800/30 rounded terminal-border">
                  <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono text-sm md:text-base">📍 IP_ADDRESS</h4>
                  <p className="text-sm text-[#00FF00] font-mono break-all">{scanResult.ip}</p>
                </div>

                {scanResult.hostnames.length > 0 && (
                  <div className="p-3 bg-gray-800/30 rounded terminal-border">
                    <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono text-sm md:text-base">🌍 HOSTNAMES</h4>
                    <div className="flex flex-wrap gap-1">
                      {scanResult.hostnames.map((hostname, i) => (
                        <Badge
                          key={i}
                          className="bg-gray-700/50 text-[#00FF00] border-[#00FF00]/30 font-mono text-xs break-all"
                        >
                          {hostname}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {scanResult.ports.length > 0 && (
                  <div className="p-3 bg-gray-800/30 rounded terminal-border">
                    <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono text-sm md:text-base">
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
                      <h4 className="font-semibold text-[#FF3C3C] font-mono text-sm md:text-base">
                        🔐 VULNERABILITIES ({scanResult.vulns.length})
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDetailedVulns(!showDetailedVulns)}
                        className="text-[#FF3C3C] hover:bg-red-900/30 font-mono text-xs h-8 px-2"
                      >
                        {showDetailedVulns ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {showDetailedVulns ? "HIDE" : "SHOW"}
                      </Button>
                    </div>

                    <div className="text-xs text-gray-400 mb-2 font-mono">
                      [CVE_DATABASE] Common Vulnerabilities and Exposures
                    </div>

                    {!showDetailedVulns ? (
                      <div className="flex flex-wrap gap-1">
                        {scanResult.vulns.slice(0, 6).map((vuln, i) => (
                          <Badge
                            key={i}
                            className="bg-red-900/30 text-[#FF3C3C] border-[#FF3C3C]/50 font-mono text-xs break-all"
                          >
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
                              <Badge className="bg-red-900/30 text-[#FF3C3C] border-[#FF3C3C]/50 font-mono text-xs break-all flex-1 mr-2">
                                {vuln}
                              </Badge>
                              <span className="text-xs text-gray-500 font-mono flex-shrink-0">#{i + 1}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}

                <Separator className="bg-[#00FF00]/30" />

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => handleDownload("json")}
                    className="flex-1 h-12 md:h-10 bg-gray-800/50 border border-[#00BFFF]/50 text-[#00BFFF] hover:bg-[#00BFFF]/20 font-mono text-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    JSON_EXPORT
                  </Button>
                  <Button
                    onClick={() => handleDownload("txt")}
                    className="flex-1 h-12 md:h-10 bg-gray-800/50 border border-[#00BFFF]/50 text-[#00BFFF] hover:bg-[#00BFFF]/20 font-mono text-sm"
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
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-[#00BFFF] text-lg md:text-xl">
                    <MessageCircle className="h-5 w-5" />
                    [AI_INTELLIGENCE_TERMINAL]
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-[#00FF00]" />}
                  </CardTitle>
                  <CardDescription className="text-gray-400 font-mono text-sm md:text-base">
                    &gt; QUERY_AI_FOR_SECURITY_ANALYSIS
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col h-[500px] md:h-[400px]">
                  {/* Chat Messages Area */}
                  <ScrollArea className="flex-1 mb-4 p-3 md:p-4 border border-[#00FF00]/30 rounded-lg bg-black/50 terminal-border">
                    {messages.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="font-mono text-sm md:text-base">[READY] AI_SYSTEM_ONLINE</p>
                        <p className="text-xs md:text-sm mt-1 font-mono leading-relaxed">
                          &gt; TRY: "analyze vulnerabilities" || "security recommendations"
                        </p>
                      </div>
                    )}
                    {messages.map((message, index) => (
                      <div
                        key={message.id}
                        className={`mb-4 animate-in fade-in-50 duration-300 ${index === messages.length - 1 ? "slide-in-from-bottom-2" : ""}`}
                      >
                        <div
                          className={`p-3 rounded-lg font-mono text-sm md:text-base leading-relaxed ${
                            message.role === "user"
                              ? "bg-[#00BFFF]/10 ml-4 md:ml-8 border border-[#00BFFF]/30"
                              : "bg-[#00FF00]/10 mr-4 md:mr-8 border border-[#00FF00]/30"
                          }`}
                        >
                          <div className="font-semibold text-xs mb-1">
                            {message.role === "user" ? "[USER]" : "[DHAVIPA_AI]"}
                          </div>
                          <div className="whitespace-pre-wrap break-words">{message.content}</div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="bg-[#00FF00]/10 mr-4 md:mr-8 p-3 rounded-lg border border-[#00FF00]/30 animate-in fade-in-50 duration-300">
                        <div className="font-semibold text-sm mb-1 flex items-center gap-2 font-mono">
                          [DHAVIPA_AI]
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </div>
                        <div className="text-sm font-mono">&gt; PROCESSING_SECURITY_DATA...</div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </ScrollArea>

                  {/* Chat Input - Sticky at bottom */}
                  <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <Input
                      ref={chatInputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="&gt; query_ai_system..."
                      disabled={isLoading}
                      className="flex-1 bg-gray-800/50 border-[#00FF00]/50 text-[#00FF00] placeholder-gray-500 font-mono text-base md:text-sm h-12 md:h-10"
                    />
                    <Button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className="w-12 h-12 md:w-10 md:h-10 bg-[#00FF00]/20 border border-[#00FF00] text-[#00FF00] hover:bg-[#00FF00]/30 cyber-glow flex-shrink-0"
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
        <Card className="mb-6 md:mb-8 bg-gray-900/50 border-[#00BFFF]/30 cyber-glow-blue backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-[#00FF00] text-lg md:text-xl">
              <Lock className="h-5 w-5" />
              [SYSTEM_INFORMATION]
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <div className="p-4 bg-gray-800/30 rounded terminal-border">
                <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono text-sm md:text-base">🚀 DHAVIPA_SYSTEM</h4>
                <p className="text-sm text-gray-300 mb-4 font-mono leading-relaxed">
                  <span className="text-[#00FF00] font-semibold">
                    Dynamic Host & Vulnerability Intelligence Partner
                  </span>
                  <br />
                  <span className="text-[#00BFFF]">
                    AI-powered network security analysis and vulnerability assessment
                  </span>
                </p>

                <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono text-sm md:text-base">🔧 CAPABILITIES</h4>
                <ul className="text-sm text-gray-300 space-y-1 font-mono leading-relaxed">
                  <li>&gt; Real-time vulnerability scanning</li>
                  <li>&gt; AI-powered security analysis</li>
                  <li>&gt; Comprehensive threat reporting</li>
                  <li>&gt; Interactive security guidance</li>
                </ul>
              </div>

              <div className="p-4 bg-gray-800/30 rounded terminal-border">
                <h4 className="font-semibold mb-2 text-[#00BFFF] font-mono text-sm md:text-base">👨‍💻 DEVELOPER</h4>
                <div className="bg-[#00FF00]/10 p-4 rounded-lg border border-[#00FF00]/30">
                  <p className="text-sm mb-2 font-mono">
                    <strong className="text-[#00FF00]">RONIT_PAIKRAY</strong> - CYBERSECURITY_RESEARCHER
                  </p>
                  <p className="text-xs text-gray-400 mb-3 font-mono leading-relaxed">
                    &gt; ETHICAL_HACKER & AI_DEVELOPER
                    <br />
                    &gt; FOUNDER: THE_DESI_DIGITAL_DEFENDER
                    <br />
                    &gt; SPECIALIZATION: ADVANCED_CYBERSECURITY_TOOLS
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
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
