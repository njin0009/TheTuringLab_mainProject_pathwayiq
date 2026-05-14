export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.GROQ_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, style, careerTitle } = body;

  const systemPrompt = `You are a career guide AI built into PathwayIQ, helping Victorian Year 10–12 students understand their personalised career report. The student's style profile is "${style ?? "balanced"}". They are exploring the career: "${careerTitle ?? "this career"}". Be warm, encouraging, and practical. Focus on what the report means for them and concrete next steps. Keep every reply under 120 words.`;

  const groqMessages = [
    { role: "system", content: systemPrompt },
    ...messages.slice(1).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
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
      let detail = `Groq ${response.status}`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.error?.message) detail = errJson.error.message;
      } catch { /* ignore */ }
      return new Response(JSON.stringify({ error: detail }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Failed to reach Groq API: ${err.message}` }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
