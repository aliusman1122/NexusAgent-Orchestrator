"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Bot,
  Sparkles,
  Briefcase,
  Smile,
  Terminal,
  Shield,
  ArrowRight,
  Info,
} from "lucide-react";
import { createAgent as createAgentLocal, Agent, PersonaTone } from "@/lib/admin-store";
import { createAgent as createAgentApi } from "@/services/api";
import { CreateAgentPayload } from "@/types/chat";

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentCreated?: (agent: Agent) => void;
}

export function CreateAgentModal({ isOpen, onClose, onAgentCreated }: CreateAgentModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<PersonaTone>("Executive");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate slug when name changes, unless user manually edited slug
  useEffect(() => {
    if (!isSlugManuallyEdited && name) {
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      setSlug(generated);
    }
  }, [name, isSlugManuallyEdited]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Agent name is required.");
      return;
    }

    const finalSlug = (slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!finalSlug) {
      setError("A valid identifier slug is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateAgentPayload = {
        name: name.trim(),
        slug: finalSlug,
        description: description.trim() || "Enterprise AI agent configured for custom knowledge retrieval.",
        persona: tone,
        tone: tone,
      };

      let newAgent: Agent;
      try {
        newAgent = await createAgentApi(payload);
      } catch (apiErr) {
        console.warn("Backend API createAgent failed, using local store fallback:", apiErr);
        newAgent = createAgentLocal({
          name: name.trim(),
          slug: finalSlug,
          description: description.trim() || "Enterprise AI agent configured for custom knowledge retrieval.",
          tone,
        });
      }

      // Also ensure local store has it for offline caching
      try {
        createAgentLocal({
          name: newAgent.name,
          slug: newAgent.slug,
          description: newAgent.description,
          tone: (newAgent.tone || newAgent.persona || "Executive") as PersonaTone,
        });
      } catch {
        // Ignore if already cached
      }

      onClose();
      if (onAgentCreated) {
        onAgentCreated(newAgent);
      }
      // Immediately navigate to its knowledge base page
      router.push(`/admin/agents/${newAgent.slug || newAgent.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create agent";
      setError(message);
      setIsSubmitting(false);
    }
  };

  const tones: {
    value: PersonaTone;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "Executive",
      label: "Executive",
      desc: "Polished, strategic, corporate-ready",
      icon: <Briefcase className="w-4 h-4 text-[#FF6A00]" />,
    },
    {
      value: "Casual",
      label: "Casual",
      desc: "Friendly, empathetic, conversational",
      icon: <Smile className="w-4 h-4 text-emerald-400" />,
    },
    {
      value: "Technical",
      label: "Technical",
      desc: "Rigorous, analytical, code & specs oriented",
      icon: <Terminal className="w-4 h-4 text-cyan-400" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#161B22] border border-[#30363D] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#30363D] flex items-center justify-between bg-[#161B22]/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF6A00]/15 border border-[#FF6A00]/30 flex items-center justify-center text-[#FF6A00]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Create New Enterprise Agent
              </h2>
              <p className="text-xs text-[#8B949E]">
                Configure bot profile, tone, and identifier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8B949E] hover:text-white hover:bg-[#30363D]/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bot Name */}
          <div>
            <label className="block text-xs font-semibold text-[#E6EDF3] uppercase tracking-wider mb-1.5">
              Bot Name <span className="text-[#FF6A00]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Real Estate Advisor"
              className="w-full px-3.5 py-2.5 bg-[#0E1117] border border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-sm text-white placeholder-[#484F58] outline-none transition-all"
            />
          </div>

          {/* Bot Identifier / Slug */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#E6EDF3] uppercase tracking-wider">
                Bot Identifier / Slug
              </label>
              <span className="text-[11px] text-[#8B949E] font-mono">
                Auto-generated
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8B949E] font-mono text-xs">
                agent:
              </div>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setIsSlugManuallyEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                }}
                placeholder="real_estate_advisor"
                className="w-full pl-16 pr-3.5 py-2.5 bg-[#0E1117] border border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-sm text-[#FF6A00] font-mono placeholder-[#484F58] outline-none transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-[#8B949E]">
              Unique machine identifier used for vector collection indexing.
            </p>
          </div>

          {/* Description / Purpose */}
          <div>
            <label className="block text-xs font-semibold text-[#E6EDF3] uppercase tracking-wider mb-1.5">
              Description / Purpose
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this bot specializes in, key knowledge areas, or target users..."
              className="w-full px-3.5 py-2.5 bg-[#0E1117] border border-[#30363D] focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00] rounded-xl text-sm text-white placeholder-[#484F58] outline-none transition-all resize-none"
            />
          </div>

          {/* Persona Tone */}
          <div>
            <label className="block text-xs font-semibold text-[#E6EDF3] uppercase tracking-wider mb-1.5">
              Persona Tone
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {tones.map((t) => {
                const isSelected = tone === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTone(t.value)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-[#FF6A00]/10 border-[#FF6A00] ring-1 ring-[#FF6A00]/50"
                        : "bg-[#0E1117] border-[#30363D] hover:border-[#484F58] text-[#8B949E]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {t.icon}
                      <span
                        className={`text-xs font-semibold ${
                          isSelected ? "text-white" : "text-[#E6EDF3]"
                        }`}
                      >
                        {t.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8B949E] leading-snug">
                      {t.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Footer / Action */}
          <div className="pt-4 border-t border-[#30363D] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#8B949E] hover:text-white rounded-xl hover:bg-[#30363D]/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#E55F00] hover:from-[#FF7B1A] hover:to-[#FF6A00] text-white font-semibold text-xs shadow-lg shadow-[#FF6A00]/25 transition-all active:scale-95 disabled:opacity-50"
            >
              <span>{isSubmitting ? "Creating..." : "Create & Configure KB"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
