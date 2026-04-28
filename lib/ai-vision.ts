import Anthropic from "@anthropic-ai/sdk";

export interface AIScoreSuggestion {
  score: number;
  scoreText: string;
  confidence: "high" | "medium" | "low";
  explanation: string;
  observations: string[];
  warnings: string[];
}

interface RequestParams {
  imageUrl: string;
  itemName: string;
  module: string;
  scaleMin: number;
  scaleMax: number;
  fieldType: "score" | "numeric" | "sex";
  scaleDescription?: string;
  feedback?: string;
  previousScore?: number;
}

function buildPrompt(p: RequestParams): string {
  const scaleHint = p.scaleDescription
    ? `Reference scale:\n${p.scaleDescription}\n`
    : `Score range: ${p.scaleMin} to ${p.scaleMax} (higher = more severe).`;

  let feedbackBlock = "";
  if (p.feedback && p.feedback.trim() !== "") {
    feedbackBlock = `

The veterinarian provided this feedback on your previous analysis (score: ${p.previousScore ?? "unknown"}):
"${p.feedback.trim()}"

Re-analyze the image taking this feedback into account. Be specific about what you see now.`;
  }

  return `You are an experienced poultry veterinarian assisting another vet during necropsy scoring. The vet has uploaded an image of a finding and wants a second opinion on the score.

ITEM TO SCORE: ${p.itemName} (module: ${p.module})
${scaleHint}
${feedbackBlock}

Analyze the image carefully and respond with ONLY a valid JSON object in this exact format:

{
  "score": <integer between ${p.scaleMin} and ${p.scaleMax}>,
  "scoreText": "<the score as string, or 'M'/'F' for sex items>",
  "confidence": "<high | medium | low>",
  "explanation": "<one or two sentences explaining the score, in clinical language>",
  "observations": ["<specific finding 1>", "<specific finding 2>", "..."],
  "warnings": ["<image quality issue if any>", "..."]
}

Rules:
- Be honest about confidence. If the image is blurry, oblique, or doesn't clearly show the finding, set confidence to "low" and add a warning.
- Use specific clinical terminology (e.g. "hyperkeratosis", "necrotic lesion", "petechiae") when relevant.
- For sex items, use scoreText "M" for male, "F" for female; score should be 0 for F, 1 for M.
- For numeric items (like body weight in grams), put the value in score and scoreText.
- If you cannot determine the score from the image at all, return score 0, confidence "low", and explain why in observations.
- Output only the JSON object. No prose before or after.`;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
  if (contentType.includes("png")) mediaType = "image/png";
  else if (contentType.includes("gif")) mediaType = "image/gif";
  else if (contentType.includes("webp")) mediaType = "image/webp";

  return { data: base64, mediaType };
}

export async function requestAIScore(params: RequestParams): Promise<AIScoreSuggestion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  const image = await fetchImageAsBase64(params.imageUrl);
  const prompt = buildPrompt(params);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType,
              data: image.data,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find(function (b) { return b.type === "text"; });
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI");
  }

  let raw = textBlock.text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
  }

  let parsed: AIScoreSuggestion;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed.score !== "number" || parsed.score < params.scaleMin || parsed.score > params.scaleMax) {
    parsed.score = Math.max(params.scaleMin, Math.min(params.scaleMax, Math.round(parsed.score ?? 0)));
  }

  parsed.confidence = parsed.confidence ?? "medium";
  parsed.explanation = parsed.explanation ?? "No explanation provided.";
  parsed.observations = Array.isArray(parsed.observations) ? parsed.observations : [];
  parsed.warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];

  return parsed;
}
