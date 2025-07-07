import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { messages, scanData } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 })
    }

    // Shorter, more focused system prompt for faster processing
    const systemPrompt = `You are DhaViPa (Dynamic Host & Vulnerability Intelligence Partner), an AI cybersecurity expert.

IDENTITY: If asked about your name/identity: "I'm DhaViPa, your cybersecurity assistant."
CREATOR: If asked about your developer: "I was created by Ronit Paikray, cybersecurity researcher and founder of The Desi Digital Defender."

${
  scanData
    ? `SCAN DATA - ${scanData.ip}:
Ports: ${scanData.ports?.slice(0, 10).join(", ") || "None"}${scanData.ports?.length > 10 ? "..." : ""}
Vulns: ${scanData.vulns?.slice(0, 5).join(", ") || "None"}${scanData.vulns?.length > 5 ? "..." : ""}
Risk: ${scanData.riskLevel}

Provide concise, actionable security advice.`
    : ""
}

Be concise, clear, and security-focused.`

    // Convert messages to OpenRouter format
    const openRouterMessages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages.slice(-6).map((msg: any) => {
        // Only keep last 6 messages for faster processing
        let content = ""

        if (typeof msg.content === "string") {
          content = msg.content
        } else if (msg.parts && Array.isArray(msg.parts)) {
          content = msg.parts
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text)
            .join("")
        }

        return {
          role: msg.role,
          content: content.slice(0, 500), // Limit message length for faster processing
        }
      }),
    ]

    console.log("Sending request to OpenRouter with messages:", openRouterMessages.length)

    // Call OpenRouter API with optimized settings
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer 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",
        "HTTP-Referer": "https://dhavipa.netlify.app",
        "X-Title": "DhaViPa",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free", // fast model available on OpenRouter
        messages: openRouterMessages,
        temperature: 0.3, // Lower for faster, more focused responses
        max_tokens: 400, // Reduced for faster responses
        top_p: 0.9, // Optimize sampling
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        stream: false,
      }),
    })

    // Read body as text first
    const raw = await response.text()

    if (!response.ok) {
      console.error("OpenRouter API error:", response.status, raw)
      return NextResponse.json(
        { error: `OpenRouter error ${response.status}: ${raw || response.statusText}` },
        { status: response.status },
      )
    }

    let data: any
    try {
      data = JSON.parse(raw)
    } catch {
      console.error("Non-JSON response from OpenRouter:", raw)
      return NextResponse.json({ error: "Received invalid JSON from AI service" }, { status: 502 })
    }

    if (!data.choices?.[0]?.message?.content) {
      console.error("Unexpected JSON structure:", data)
      return NextResponse.json({ error: "Malformed response from AI service" }, { status: 502 })
    }

    const aiResponse = data.choices[0].message.content

    if (!aiResponse) {
      console.error("Empty response from OpenRouter")
      return NextResponse.json({ error: "Empty response from AI service" }, { status: 500 })
    }

    // Return response in the format expected by useChat hook
    return NextResponse.json({
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: aiResponse,
      parts: [{ type: "text", text: aiResponse }],
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error. Please try again." }, { status: 500 })
  }
}
