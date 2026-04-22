/**
 * Plan Cover Image Generation
 * Uses xAI's grok-imagine-image to generate cover images for learning plans.
 * API ref: https://docs.x.ai/developers/rest-api-reference/inference/images
 */

const XAI_IMAGE_URL = "https://api.x.ai/v1/images/generations";
const IMAGE_MODEL = "grok-imagine-image";

/**
 * Generate a cinematic cover image for a learning plan.
 * Returns base64-encoded PNG data (without the data URL prefix).
 */
export async function generatePlanCoverImage(description: string): Promise<{
  base64: string;
  mimeType: string;
} | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error("[plan-image] XAI_API_KEY not configured");
    return null;
  }

  const prompt = `Cinematic, visually stunning cover image for a learning plan about: "${description}". Atmospheric, dramatic lighting, rich colors. Movie poster or high-end editorial photography aesthetic. Wide composition. No text, letters, words, or watermarks. Subject matter should visually represent the topic in an abstract or metaphorical way.`;

  try {
    const response = await fetch(XAI_IMAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        aspect_ratio: "16:9",
        response_format: "b64_json",
        n: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[plan-image] xAI image generation failed:", response.status, errorText);
      return null;
    }

    const result = await response.json();
    const item = result.data?.[0];

    if (!item?.b64_json) {
      console.error("[plan-image] No b64_json in response:", JSON.stringify(result).slice(0, 500));
      return null;
    }

    return {
      mimeType: item.mime_type || "image/png",
      base64: item.b64_json,
    };
  } catch (error) {
    console.error("[plan-image] Image generation error:", error);
    return null;
  }
}

/**
 * Upload a plan cover image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadPlanCover(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { storage: { from: (bucket: string) => { upload: any; getPublicUrl: any } } },
  userId: string,
  planId: string,
  base64Data: string,
  mimeType: string
): Promise<string | null> {
  try {
    const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
    const path = `${userId}/${planId}.${ext}`;

    const buffer = Buffer.from(base64Data, "base64");

    const { error } = await supabase.storage
      .from("plan-covers")
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error("[plan-image] Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("plan-covers")
      .getPublicUrl(path);

    return urlData?.publicUrl || null;
  } catch (error) {
    console.error("[plan-image] Upload error:", error);
    return null;
  }
}

/**
 * Generate and upload a cover image for a plan.
 * Updates the plan's cover_image_url in the database.
 * This is designed to be called as a fire-and-forget async operation.
 */
export async function generateAndStorePlanCover(
  supabase: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storage: { from: (bucket: string) => { upload: any; getPublicUrl: any } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => { update: any };
  },
  userId: string,
  planId: string,
  description: string
): Promise<string | null> {
  const imageData = await generatePlanCoverImage(description);
  if (!imageData) return null;

  const publicUrl = await uploadPlanCover(
    supabase,
    userId,
    planId,
    imageData.base64,
    imageData.mimeType
  );

  if (!publicUrl) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("learning_plans") as any)
    .update({ cover_image_url: publicUrl })
    .eq("id", planId);

  return publicUrl;
}
