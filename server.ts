import { localApiOnly } from './local-api-guard.mjs';
import { GoogleGenAI } from "@google/genai";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const PORT = 3000;

async function startServer() {
  const app = express();
app.use('/api', localApiOnly(() => PORT));
  app.use(express.json());

  // API Route for generating the audio summary
  app.post("/api/summarize", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Step 1: Write the commute summary script
      console.log("Generating summary script...");
      const textResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are a professional commute news anchor. The user has provided the following raw news article text. Summarize it into a concise, engaging, and easy-to-listen-to audio script (about 1 to 2 minutes when read aloud). Start with a friendly welcoming sentence for their commute. Do not include any formatting like bold, italics, or brackets because this will be read by a TTS system directly. Just the plain words you want spoken.

Here is the news text:
${text}`,
      });

      const script = textResponse.text || "I'm sorry, I couldn't generate a summary for that text.";
      console.log("Script generated.", script.substring(0, 100) + "...");

      // Step 2: Generate speech from the script
      console.log("Generating audio...");
      const audioResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: script }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Zephyr" },
            },
          },
        },
      });

      const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        throw new Error("No audio generated from the model.");
      }

      res.json({ script, audioBase64: base64Audio });
    } catch (error: any) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: error.message || "Failed to generate summary" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
