import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface RequestBody {
  message: string;
  style?: string;
  careerTitle?: string;
  messages: ChatMessage[];
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, style, careerTitle, messages } = body;

  const systemPrompt = `You are a career guide AI built into PathwayIQ, helping Victorian Year 10–12 students understand their personalised career report. The student's style profile is "${style ?? "balanced"}". They are exploring the career: "${careerTitle ?? "this career"}". Be warm, encouraging, and practical. Focus on what the report means for them and concrete next steps. Keep every reply under 120 words.`;

  // Build conversation history for Groq (OpenAI-compatible format)
  const groqMessages = [
    { role: "system", content: systemPrompt },
    // Skip the initial assistant greeting (index 0), include the rest
    ...messages.slice(1).map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    })),
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      let detail = `Groq ${response.status}`;
      try {
        const errJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errJson.error?.message) detail = errJson.error.message;
      } catch { /* ignore */ }
      return NextResponse.json({ error: detail }, { status: 502 });
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const reply =
      data?.choices?.[0]?.message?.content ??
      "I couldn't generate a response. Please try again.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Groq fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to reach Groq API" },
      { status: 503 },
    );
  }
}
