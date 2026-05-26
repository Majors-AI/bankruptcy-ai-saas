import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are a bankruptcy paralegal assistant. You will be given text or images extracted from a credit report. The report may be from Experian, TransUnion, Equifax, or a tri-merge bankruptcy-specific credit report.

Extract ALL tradelines/accounts you can find. Do not skip any account regardless of status (open, closed, collections, paid, charged-off, etc.).

SCHEDULE CLASSIFICATION (set "suggestedSchedule"):
- "D" = Secured: mortgages, car loans, secured credit lines, any debt with collateral
- "E/F-priority" = Priority unsecured: IRS/state taxes, domestic support, alimony, child support
- "E/F-unsecured" = General unsecured: credit cards, medical, personal loans, student loans, collections, utilities
- "G" = Unexpired leases/executory contracts (auto leases, apartment leases)
- "H" = Co-debtors (if co-signer info visible)
- "unknown" = Cannot determine

Return ONLY valid JSON — no markdown, no extra text — in this exact shape:

{
  "reportSource": "experian|transunion|equifax|unknown",
  "reportDate": "date pulled or null",
  "subjectName": "person's name or null",
  "accounts": [
    {
      "reportSection": "section label or null",
      "creditorName": "creditor or collection agency name",
      "originalCreditor": "original creditor if collection, else null",
      "accountNumber": "account number as shown (may be masked), or null",
      "ownershipType": "Individual|Joint|Authorized User|null",
      "accountType": "mortgage|auto_loan|auto_lease|credit_card|personal_loan|student_loan|medical|collection|tax_debt|utility|other",
      "suggestedSchedule": "D|E/F-priority|E/F-unsecured|G|H|unknown",
      "status": "account status text or null",
      "loanType": "loan type description or null",
      "currentBalance": "balance with $ or null",
      "highCredit": "high credit/credit limit or null",
      "dateOpened": "date opened or null",
      "lastReported": "last reported date or null",
      "lastActivity": "last activity date or null",
      "monthlyPayment": "monthly payment with $ or null",
      "pastDue": "past due amount or null",
      "payHistory": "payment history string or null",
      "bkAddr1": "BK noticing street address (Stretto only) or null",
      "bkCity": null,
      "bkState": null,
      "bkZip": null,
      "bkPhone": null,
      "bureauAddr1": "bureau reported address or null",
      "bureauCity": null,
      "bureauState": null,
      "bureauZip": null,
      "bureauPhone": null,
      "source": "which bureaus: TU, EX, EQ, or null"
    }
  ]
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? Deno.env.get("anthropic_api_key");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured. Please add it in your Supabase project secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // Health-check ping
    if (body._ping) {
      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pageImages: string[] = body.pageImages ?? (body.fileBase64 ? [body.fileBase64] : []);
    const mediaType: string = body.mediaType ?? "image/jpeg";

    if (pageImages.length === 0 && !body.reportText) {
      return new Response(
        JSON.stringify({ error: "Missing pageImages or reportText in request body." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let messageContent: unknown;

    if (pageImages.length > 0) {
      // Cap at 15 pages to stay comfortably within Supabase's 150s wall-clock limit
      const pages = pageImages.slice(0, 15);
      messageContent = [
        { type: "text", text: `Analyze these ${pages.length} credit report page(s) and extract all accounts.` },
        ...pages.map((b64) => ({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: b64 },
        })),
      ];
    } else {
      messageContent = String(body.reportText).slice(0, 200_000);
    }

    // Use streaming so Supabase doesn't time out waiting for the first byte
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(
        JSON.stringify({ error: `Anthropic API error ${anthropicRes.status}: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect the full streamed text from SSE events
    const reader = anthropicRes.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const evt = JSON.parse(jsonStr);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            fullText += evt.delta.text;
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }

    const rawText = fullText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response.", raw: rawText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        reportSource: parsed.reportSource ?? "unknown",
        reportDate:   parsed.reportDate ?? null,
        subjectName:  parsed.subjectName ?? null,
        accounts:     Array.isArray(parsed.accounts) ? parsed.accounts : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
