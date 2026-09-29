"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Globe, Layers } from "lucide-react";
import { SourceCitation } from "@/types/chat";

interface SourceAccordionProps {
  sources: SourceCitation[];
}

export const SourceAccordion: React.FC<SourceAccordionProps> = ({ sources }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  if (!sources || sources.length === 0) {
    return null;
  }

  const toggleItem = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div className="mt-2.5 rounded-lg border border-[#30363D] bg-[#12161E] overflow-hidden text-xs transition-all duration-200">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#1A202C] text-[#94A3B8] transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Layers className="w-3.5 h-3.5 text-[#FF6A00]" />
          <span>Verified Grounding Citations</span>
          <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold bg-[#21262D] text-[#FF6A00] rounded-full border border-[#30363D]">
            {sources.length} {sources.length === 1 ? "source" : "sources"}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
        )}
      </button>

      {isOpen && (
        <div className="p-2 space-y-2 border-t border-[#30363D] bg-[#0E1117]/80 divide-y divide-[#30363D]/50">
          {sources.map((item, idx) => {
            const isWeb =
              item.source.startsWith("http://") ||
              item.source.startsWith("https://") ||
              item.source.includes("a7logics.com");
            const isItemExpanded = expandedIndices[idx] ?? false;

            return (
              <div key={idx} className={idx > 0 ? "pt-2" : ""}>
                <div
                  onClick={(e) => toggleItem(idx, e)}
                  className="flex items-center justify-between cursor-pointer py-1 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {isWeb ? (
                      <Globe className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                    )}
                    <span className="font-semibold text-[#E6EDF3] truncate max-w-[200px]" title={item.source}>
                      {item.source}
                    </span>
                    {item.section && item.section !== "General" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161B22] text-[#94A3B8] border border-[#30363D] shrink-0">
                        {item.section}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#FF6A00] hover:underline shrink-0">
                    {isItemExpanded ? "Hide" : "Inspect chunk"}
                  </span>
                </div>

                {isItemExpanded && (
                  <div className="mt-1 p-2 rounded bg-[#161B22] border border-[#30363D] text-[#CBD5E1] text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {item.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
