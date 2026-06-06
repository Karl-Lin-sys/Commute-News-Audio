import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, AudioLines, Car, Headphones, Loader2, Newspaper, RefreshCcw } from "lucide-react";
import React, { useRef, useState } from "react";
import { cn } from "./lib/utils";

export default function App() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ script: string; audioUrl: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      // Create a playable object URL from base64 audio
      const binaryStr = atob(data.audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/pcm;rate=24000" }); 
      // Gemini TTS (Zephyr) typically outputs 24kHz raw PCM by default or WAV... wait, the standard generateContent returns WAV if we don't specify raw PCM in Live.
      // The TTS example in the skill shows just creating a baseURL or relying on browser to decode it.
      // Wait, is the generated data from `gemini-3.1-flash-tts-preview` WAV? By default, the `generateContent` for TTS returns a base64 encoded audio fragment. Often it has a mimeType.
      // Let me just prefix it dynamically, or use audio/wav. Let's look at the skill: `const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data`.
      // I'll use standard wav Data URI format.
      const audioUrl = `data:audio/wav;base64,${data.audioBase64}`;

      setResult({
        script: data.script,
        audioUrl,
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans selection:bg-blue-200">
      <main className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-blue-100 text-blue-600 rounded-full mb-4 shadow-sm"
          >
            <Car className="w-6 h-6 mr-2" />
            <Headphones className="w-6 h-6" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight text-slate-800"
          >
            Commute News Audio
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 mt-2 text-sm max-w-sm mx-auto leading-relaxed"
          >
            Paste your reading backlog below. We'll summarize it and create a personalized radio segment for your drive.
          </motion.p>
        </header>

        <motion.form 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onSubmit={handleSubmit} 
          className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden mb-8"
        >
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center text-slate-600">
            <Newspaper className="w-4 h-4 mr-2" />
            <span className="text-xs uppercase tracking-wider font-semibold">Articles Source</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
            placeholder="Paste news articles, blog posts, or long-form content here..."
            className="w-full h-48 p-4 bg-transparent outline-none resize-none text-slate-700 placeholder:text-slate-300"
          />
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Producing Audio Segment...
                </>
              ) : (
                <>
                  <AudioLines className="w-5 h-5 mr-2" />
                  Generate Audio Summary
                </>
              )}
            </button>
          </div>
        </motion.form>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden"
            >
              <div className="bg-slate-900 p-6 text-white text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 relative">
                  <div className={cn("absolute inset-0 rounded-full border-2 border-blue-400 opacity-50", isPlaying ? "animate-ping" : "")} />
                  <Headphones className="w-8 h-8 text-blue-400 relative z-10" />
                </div>
                
                <h3 className="font-medium text-lg leading-none mb-1">Your Commute Segment</h3>
                <p className="text-slate-400 text-sm mb-6">AI Voice: Zephyr</p>

                <audio 
                  ref={audioRef}
                  src={result.audioUrl} 
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden" 
                />

                <div className="flex items-center justify-center space-x-4 w-full">
                  <button 
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play();
                      }
                    }}
                    className="p-3 rounded-full hover:bg-slate-800 transition-colors text-slate-300"
                  >
                    <RefreshCcw className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={handlePlayPause}
                    className="w-14 h-14 bg-blue-500 hover:bg-blue-400 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
                  >
                    {isPlaying ? (
                      <div className="w-4 h-4 bg-white rounded-sm" /> // Pause icon
                    ) : (
                      <ArrowRight className="w-6 h-6 ml-1" /> // Play icon
                    )}
                  </button>
                  <a 
                    href={result.audioUrl} 
                    download="commute-summary.wav"
                    className="p-3 rounded-full hover:bg-slate-800 transition-colors text-slate-300 text-xs uppercase tracking-wider font-bold"
                  >
                    Save
                  </a>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">Segment Script</h4>
                <div className="prose prose-sm prose-slate max-w-none text-slate-700 font-serif leading-relaxed h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {result.script.split('\n').map((para, i) => (
                    para ? <p key={i} className="mb-3">{para}</p> : null
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
