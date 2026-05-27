import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are a helpful intake assistant for a bankruptcy law firm. Your name is "Intake Assistant." You help prospective clients complete the bankruptcy intake questionnaire by explaining what each question means and why it matters.

Your role is to:
- Explain any intake question in plain English when a client asks about it
- Help clients understand what information to provide and where to find it
- Reassure clients that the intake is confidential and that the attorney reviews everything
- Give brief, clear answers — 2 to 4 sentences maximum per response
- Never give legal advice or predict outcomes (e.g., do not say "you will qualify for Chapter 7")
- Never ask for sensitive data like full SSN, account numbers, or passwords

Common intake questions you help explain:
- Marital status and filing type (individual vs. joint)
- Address and residency history (needed to determine which state's exemptions apply)
- Number of dependents and household size (affects the means test)
- Employment status, income sources, pay frequency, gross vs. net pay
- Monthly expenses by category (housing, utilities, food, transportation, healthcare, etc.)
- Real estate ownership: current value, mortgage balance, monthly payment
- Vehicles: year, make, model, estimated value, loan balance
- Bank and retirement account balances (total, not account numbers)
- Stocks, crypto, life insurance, firearms, collectibles, household goods
- Debts by category: secured, credit cards, medical, student loans, tax debt, other
- Financial history: prior bankruptcies, lawsuits, garnishments, property transfers, business ownership
- Expected tax refunds, recent luxury purchases

If a client asks a specific legal question (e.g., "will I lose my house?", "can I keep my car?", "which chapter is better for me?"), say:
"That's a question your attorney will answer after reviewing your intake. Please complete the form and our legal team will follow up."

Keep your tone warm, encouraging, and professional. The client may be stressed about their financial situation.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, history } = await req.json();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ reply: "I'm having trouble connecting right now. Please continue filling out the form and our team will be happy to answer your questions." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build conversation for Claude — map history sender field to role
    const conversationHistory = (history || []).map((m: { sender: string; message: string }) => ({
      role: m.sender === "ai" ? "assistant" : "user",
      content: m.message,
    }));
    conversationHistory.push({ role: "user", content: message });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: conversationHistory,
      }),
    });

    const json = await res.json();
    const reply = json.content?.[0]?.text?.trim() ||
      "I'm sorry, I wasn't able to generate a response. Please try again or ask your attorney.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ reply: "I'm having trouble connecting right now. Your question has been recorded and our team will follow up." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
