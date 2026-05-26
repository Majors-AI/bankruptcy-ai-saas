import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Zillow Zestimate — multiple strategies ────────────────────────────────
async function fetchZillowZestimate(
  street: string, city: string, state: string, zip: string
): Promise<{ value: number | null; url: string }> {

  // Build the cleanest possible full address
  const parts = [street, city, state, zip].map(s => s?.trim()).filter(Boolean);
  const fullAddress = parts.join(", ");
  const encoded = encodeURIComponent(fullAddress);
  const zillowUrl = `https://www.zillow.com/homes/${encoded}_rb/`;

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };

  const jsonHeaders = {
    ...browserHeaders,
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.zillow.com/",
    "Origin": "https://www.zillow.com",
  };

  // ── Strategy 1: Zillow autocomplete → property zpid → Zestimate ──────────
  try {
    const acResp = await fetch(
      `https://www.zillow.com/ajax/autocomplete/autocomplete?q=${encodeURIComponent(fullAddress)}&abKey=&session=&resultCount=5`,
      { headers: jsonHeaders }
    );
    if (acResp.ok) {
      const acData = await acResp.json();
      const results: Array<{ metaData?: { zpid?: number | string } }> = acData?.results || [];
      const zpid = results[0]?.metaData?.zpid;
      if (zpid) {
        // Fetch property detail via GraphQL
        const gqlBody = JSON.stringify({
          operationName: "ForSaleDoubleScrollFullRenderQuery",
          variables: { zpid: Number(zpid), contactFormRenderParameter: {} },
          clientVersion: "home-details/6.1.1944.master.exp",
          query: `query ForSaleDoubleScrollFullRenderQuery($zpid:BigInt!){property(zpid:$zpid){zestimate}}`,
        });
        const gqlResp = await fetch("https://www.zillow.com/graphql/", {
          method: "POST",
          headers: { ...jsonHeaders, "Content-Type": "application/json" },
          body: gqlBody,
        });
        if (gqlResp.ok) {
          const gqlData = await gqlResp.json();
          const zest = gqlData?.data?.property?.zestimate;
          if (zest && zest > 1000) return { value: zest, url: zillowUrl };
        }
      }
    }
  } catch (_) { /* continue */ }

  // ── Strategy 2: GetSearchPageState with full address as search term ───────
  try {
    const searchState = {
      pagination: {},
      isMapVisible: false,
      mapBounds: { west: -180, east: 180, south: -90, north: 90 },
      filterState: { isAllHomes: { value: true } },
      isListVisible: true,
      usersSearchTerm: fullAddress,
    };
    const apiUrl =
      `https://www.zillow.com/search/GetSearchPageState.htm` +
      `?searchQueryState=${encodeURIComponent(JSON.stringify(searchState))}` +
      `&wants=${encodeURIComponent(JSON.stringify({ cat1: ["listResults"] }))}` +
      `&requestId=2`;

    const apiResp = await fetch(apiUrl, { headers: jsonHeaders });
    if (apiResp.ok) {
      const json = await apiResp.json();
      const results: Array<{ hdpData?: { homeInfo?: { zestimate?: number } }; zestimate?: number }> =
        json?.cat1?.searchResults?.listResults || [];
      for (const r of results) {
        const z = r?.hdpData?.homeInfo?.zestimate ?? r?.zestimate;
        if (z && z > 1000) return { value: z, url: zillowUrl };
      }
    }
  } catch (_) { /* continue */ }

  // ── Strategy 3: HTML page parse — __NEXT_DATA__ or inline JSON ───────────
  try {
    const htmlResp = await fetch(zillowUrl, { headers: browserHeaders });
    if (htmlResp.ok) {
      const html = await htmlResp.text();

      // Extract __NEXT_DATA__ blob
      const ndMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (ndMatch) {
        try {
          const nd = JSON.parse(ndMatch[1]);
          const str = JSON.stringify(nd);
          // Look for zestimate field
          const m = str.match(/"zestimate"\s*:\s*(\d{5,9})/);
          if (m) return { value: parseInt(m[1]), url: zillowUrl };
        } catch (_) { /* continue */ }
      }

      // Inline script patterns
      const patterns = [
        /"zestimate"\s*:\s*(\d{5,9})/,
        /"price"\s*:\s*(\d{5,9})/,
        /,"price":(\d{5,9}),/,
      ];
      for (const pat of patterns) {
        const m = html.match(pat);
        if (m && parseInt(m[1]) > 10000) return { value: parseInt(m[1]), url: zillowUrl };
      }
    }
  } catch (_) { /* continue */ }

  return { value: null, url: zillowUrl };
}

// ── KBB redirect URL builder ───────────────────────────────────────────────
function buildKbbUrl(params: {
  year?: string; make?: string; model?: string;
  plate?: string; plateState?: string; vehicleType?: string;
}): string {
  const { year, make, model, plate, plateState, vehicleType } = params;

  if (plate && plateState) {
    const stateCode = (plateState.length === 2 ? plateState : plateState.slice(0, 2)).toLowerCase();
    return `https://www.kbb.com/license-plate-search/?plate=${encodeURIComponent(plate)}&state=${stateCode}`;
  }

  if (year && make && model) {
    const type = (vehicleType || "").toLowerCase();
    const kbbCategory =
      type.includes("motorcycle") ? "motorcycle" :
      type.includes("rv") || type.includes("motorhome") || type.includes("trailer") ? "recreational-vehicles" :
      "car";
    const makeSlug = make.toLowerCase().replace(/\s+/g, "-");
    const modelSlug = model.toLowerCase().replace(/\s+/g, "-");
    return `https://www.kbb.com/${kbbCategory}/${makeSlug}/${year}/${modelSlug}/`;
  }

  return `https://www.kbb.com/whats-my-car-worth/`;
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type } = body;

    if (type === "zillow") {
      const { street, city, state, zip } = body;
      if (!street && !city) {
        return new Response(JSON.stringify({ error: "street and city required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await fetchZillowZestimate(street || "", city || "", state || "", zip || "");
      return new Response(
        JSON.stringify({ value: result.value, url: result.url, autoFilled: result.value !== null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "kbb") {
      const { year, make, model, plate, plateState, vehicleType } = body;
      const url = buildKbbUrl({ year, make, model, plate, plateState, vehicleType });
      return new Response(
        JSON.stringify({ url, autoFilled: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "type must be zillow or kbb" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
