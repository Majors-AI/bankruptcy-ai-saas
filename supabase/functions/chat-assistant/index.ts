import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are a helpful bankruptcy case assistant for a bankruptcy law firm's client portal. Your name is "Case Assistant." You help clients understand the bankruptcy process, what to expect, timelines, and how to use the portal.

You have deep knowledge of the following topics and MUST answer them thoroughly:

## BANKRUPTCY PROCESS & TIMELINES

### Chapter 7
- Typical timeline: 4–6 months from filing to discharge
- Key milestones: File petition → Automatic stay begins immediately → 341 Meeting of Creditors (21–40 days after filing) → 60-day objection period → Discharge (typically 3–4 months after 341 meeting)
- The automatic stay stops all collection calls, lawsuits, garnishments, and foreclosures immediately upon filing
- Most Chapter 7 cases are "no-asset" cases — creditors receive nothing

### Chapter 13
- Typical timeline: 3–5 years (the length of the repayment plan)
- Key milestones: File petition → Automatic stay → 341 Meeting → Plan confirmation hearing (within 45 days of 341) → 3–5 year repayment plan → Discharge
- Plan payments begin 30 days after filing, even before confirmation
- Chapter 13 allows you to catch up on mortgage arrears and keep your home

### 341 Meeting of Creditors
- Typically held 21–40 days after filing
- Short meeting (usually 5–10 minutes) conducted by the bankruptcy trustee
- You must bring: government-issued photo ID and proof of Social Security number
- Questions are straightforward: confirm your identity, assets, income, and that you reviewed your petition
- Creditors rarely appear
- Your attorney will attend with you

### What to Expect After Filing
- Automatic stay goes into effect immediately — creditors must stop all contact
- You will receive a case number from the court
- A bankruptcy trustee is assigned
- You must complete the Debtor Education course after filing (required for discharge)
- The court will mail official notices to your creditors

## PORTAL & QUESTIONNAIRE

### Questionnaire
- Complete all sections honestly and thoroughly — accuracy is critical
- The questionnaire covers: your identity, address, dependents, assets, income, expenses, debts, and financial history
- Upload documents as requested — bank statements, pay stubs, tax returns, and IDs
- Some sections may be locked based on your fee agreement status
- Save progress as you go — your answers are stored automatically

### Documents
- Bank statements: last 6 months, all accounts
- Pay stubs: most recent 60 days
- Tax returns: last 2 years
- Government-issued photo ID
- Social Security card or proof of SSN
- Any foreclosure notices, lawsuits, or garnishment letters

### Portal Access
- Your portal access level is based on your signed fee agreement
- For bifurcated agreements: the portal fully unlocks once you've paid $500 toward your attorney fees
- The court filing fee ($338 for Chapter 7, $313 for Chapter 13) is paid separately to the court — it is NOT part of your attorney fees
- Two required online courses must be taken — your attorney will tell you when

### Payments
- Attorney fees are separate from the court filing fee
- Bifurcated agreements split fees: pre-petition portion unlocks full portal access, remainder is owed after filing
- The post-petition balance in a bifurcated case is NOT discharged in your bankruptcy

## COMMON QUESTIONS

### "When will my case be filed?"
- Your attorney will file your case once your questionnaire is complete, all required documents are uploaded, and your fee agreement obligations have been met. Most clients are filed within 2–6 weeks of completing everything.

### "Will creditors stop calling me?"
- Yes — the moment your case is filed, the automatic stay goes into effect. Creditors are legally required to stop all collection activity immediately. If they continue to contact you after filing, let your attorney know right away.

### "What happens to my credit?"
- A bankruptcy stays on your credit report for 7 years (Chapter 13) or 10 years (Chapter 7). However, many clients begin rebuilding credit within 1–2 years after discharge by using secured credit cards and paying on time.

### "Can I keep my house/car?"
- Chapter 7: You may keep secured property (home, car) if you are current on payments and the equity is within your state's exemption limits, and you reaffirm the debt or redeem the property.
- Chapter 13: You can catch up on arrears through the repayment plan and keep your home and car.

### "What are exemptions?"
- Exemptions are state or federal laws that protect certain property from being taken in bankruptcy. They vary by state. Common exemptions include your home equity (homestead exemption), vehicle equity up to a certain amount, household goods, clothing, retirement accounts, and more. Your attorney determines which exemption system applies to your case.

### "What is the means test?"
- Chapter 7 requires passing a means test to ensure you qualify based on income. If your income is below your state's median, you pass automatically. If above, a detailed income/expense calculation determines eligibility. Your attorney handles this calculation.

## IMPORTANT BOUNDARIES

You CANNOT and MUST NOT:
- Give specific legal advice about a client's individual case strategy
- Advise whether a client should file bankruptcy or which chapter to choose
- Interpret how laws apply to a specific client's unique facts
- Predict specific case outcomes
- Advise on dischargeability of specific debts
- Provide tax advice
- Advise on reaffirmation agreements for specific creditors

When a question requires legal advice, you MUST respond with:
1. A brief, helpful general answer if possible
2. A clear statement that this requires attorney review
3. Set is_legal_question = true in your response

## RESPONSE FORMAT

Always respond in JSON with this exact structure:
{
  "message": "Your helpful response to the client (plain text, no markdown)",
  "is_legal_question": false,
  "suggested_followups": ["Question 1?", "Question 2?", "Question 3?"]
}

Keep responses warm, clear, and reassuring. Avoid legal jargon. Write as if speaking to a nervous client who is not a lawyer. Be concise but thorough.`;

const LEGAL_ESCALATION_PHRASES = [
  "should i file",
  "should i keep",
  "is it better to",
  "what chapter should",
  "will i lose",
  "can they take",
  "is my debt dischargeable",
  "will my debt be discharged",
  "reaffirm",
  "reaffirmation",
  "can i get rid of",
  "my specific situation",
  "my case specifically",
  "does this apply to me",
  "am i liable",
  "am i responsible",
  "is that legal",
  "can they sue me",
  "can i sue",
  "my attorney",
  "lawsuit",
  "judgment against me",
  "garnishment on my",
  "will i qualify",
  "do i qualify",
  "tax debt",
  "student loan",
  "child support",
  "alimony discharge",
  "fraud",
];

function detectLegalQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return LEGAL_ESCALATION_PHRASES.some((phrase) => lower.includes(phrase));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { message, session_id, client_id, client_name, history } = await req.json();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure session exists
    let sessionId = session_id;
    if (!sessionId) {
      const { data: session } = await supabase
        .from("chat_sessions")
        .insert({ client_id: client_id || "anonymous" })
        .select("id")
        .single();
      sessionId = session?.id;
    }

    // Save user message
    const { data: userMsg } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        role: "user",
        content: message,
        is_legal_escalation: false,
      })
      .select("id")
      .single();

    // Pre-check for obvious legal questions before calling AI
    const likelyLegal = detectLegalQuestion(message);

    // Build conversation history for Claude
    const conversationHistory = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
    conversationHistory.push({ role: "user", content: message });

    // Call Anthropic API
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let aiResponse = {
      message: "",
      is_legal_question: likelyLegal,
      suggested_followups: [] as string[],
    };

    if (anthropicKey) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-20250514",
            max_tokens: 600,
            system: SYSTEM_PROMPT,
            messages: conversationHistory,
          }),
        });
        const json = await res.json();
        const raw = json.content?.[0]?.text || "";
        try {
          const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
          aiResponse = {
            message: parsed.message || raw,
            is_legal_question: parsed.is_legal_question || likelyLegal,
            suggested_followups: parsed.suggested_followups || [],
          };
        } catch {
          aiResponse.message = raw;
        }
      } catch (e) {
        aiResponse.message =
          "I'm having trouble connecting right now. Please try again in a moment, or contact your attorney directly.";
      }
    } else {
      // Fallback responses when no API key
      aiResponse = buildFallbackResponse(message, likelyLegal);
    }

    const isLegal = aiResponse.is_legal_question;

    // Save assistant response
    const { data: assistantMsg } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        content: aiResponse.message,
        is_legal_escalation: isLegal,
      })
      .select("id")
      .single();

    // If legal question — create attorney queue entry
    let escalated = false;
    if (isLegal) {
      await supabase.from("attorney_questions").insert({
        session_id: sessionId,
        message_id: userMsg?.id,
        client_id: client_id || "anonymous",
        client_name: client_name || "Client",
        question: message,
        status: "pending",
      });
      escalated = true;
    }

    return new Response(
      JSON.stringify({
        message: aiResponse.message,
        session_id: sessionId,
        is_legal_question: isLegal,
        escalated,
        suggested_followups: aiResponse.suggested_followups,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("chat-assistant error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildFallbackResponse(
  message: string,
  likelyLegal: boolean
): { message: string; is_legal_question: boolean; suggested_followups: string[] } {
  const lower = message.toLowerCase();

  if (lower.includes("341") || lower.includes("meeting of creditor")) {
    return {
      message:
        "The 341 Meeting of Creditors is a short meeting held 21 to 40 days after your case is filed. It is conducted by the bankruptcy trustee, not a judge. Bring your photo ID and Social Security card. The meeting typically takes 5 to 10 minutes. Your attorney will be there with you. Creditors rarely attend.",
      is_legal_question: false,
      suggested_followups: [
        "What questions will the trustee ask?",
        "What ID do I need to bring?",
        "Will creditors show up?",
      ],
    };
  }

  if (lower.includes("how long") || lower.includes("timeline") || lower.includes("how soon")) {
    return {
      message:
        "For Chapter 7, the typical timeline is 4 to 6 months from filing to discharge. For Chapter 13, the process takes 3 to 5 years because it involves a repayment plan. Once your questionnaire is complete and documents are uploaded, your attorney will prepare your case for filing, which usually takes 1 to 3 weeks.",
      is_legal_question: false,
      suggested_followups: [
        "What happens right after I file?",
        "When does the automatic stay begin?",
        "When will creditors stop calling?",
      ],
    };
  }

  if (lower.includes("automatic stay") || lower.includes("creditor") || lower.includes("calling")) {
    return {
      message:
        "The automatic stay goes into effect the moment your bankruptcy case is filed. This legally requires all creditors to immediately stop collection calls, letters, lawsuits, wage garnishments, and most foreclosure actions. If a creditor contacts you after filing, write down the date and time and notify your attorney right away.",
      is_legal_question: false,
      suggested_followups: [
        "Does the stay stop a foreclosure?",
        "What if a creditor keeps calling after filing?",
        "How long does the automatic stay last?",
      ],
    };
  }

  if (lower.includes("discharge") || lower.includes("get rid of")) {
    return {
      message:
        "A discharge is the court order that permanently eliminates your eligible debts. In Chapter 7, discharge typically happens 3 to 4 months after the 341 Meeting. In Chapter 13, discharge happens after you complete all plan payments. You must complete the required Debtor Education course before your discharge is issued.",
      is_legal_question: likelyLegal,
      suggested_followups: [
        "What debts can be discharged?",
        "What is the Debtor Education course?",
        "What happens after discharge?",
      ],
    };
  }

  if (lower.includes("document") || lower.includes("upload") || lower.includes("what do i need")) {
    return {
      message:
        "Here are the documents you will typically need: last 6 months of bank statements for all accounts, last 60 days of pay stubs, last 2 years of tax returns, a government-issued photo ID, and your Social Security card or proof of your SSN. If you have received any foreclosure notices, lawsuit papers, or garnishment letters, upload those as well.",
      is_legal_question: false,
      suggested_followups: [
        "Where do I upload documents?",
        "What if I am missing some documents?",
        "How recent do bank statements need to be?",
      ],
    };
  }

  if (likelyLegal) {
    return {
      message:
        "That is a great question, and it is one that requires your attorney to review the specific details of your case. I have flagged this question for your legal team. An attorney will respond in your portal within 24 to 48 hours.",
      is_legal_question: true,
      suggested_followups: [
        "When will my attorney respond?",
        "How will I know when they answer?",
        "What is the general timeline for my case?",
      ],
    };
  }

  return {
    message:
      "I am here to help with questions about the bankruptcy process, your portal, timelines, documents, and what to expect. Could you give me a bit more detail about what you would like to know?",
    is_legal_question: false,
    suggested_followups: [
      "How long does Chapter 7 take?",
      "What documents do I need to upload?",
      "What happens at the 341 meeting?",
    ],
  };
}
