"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { QRCodeModal } from "./QRCodeModal";

export type Tool = "chat" | "canvas" | "notebook" | "grokipedia" | "exercise" | "reading" | "help" | "data-input" | "logs" | "plan-resources";

interface ToolsPanelProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  problem: string;
  className?: string;
  errorNotification?: boolean;
  sessionId?: string;
  planId?: string;
  disabledTools?: Tool[];
}

function ToolIcon({ id }: { id: Tool }) {
  switch (id) {
    case "chat":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      );
    case "canvas":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      );
    case "notebook":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case "grokipedia":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "exercise":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    case "reading":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "help":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "data-input":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "logs":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "plan-resources":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
      );
  }
}

const bottomTools: Tool[] = ["help", "data-input", "logs"];

export function ToolsPanel({ 
  activeTool, onToolChange, problem, className = "", errorNotification = false,
  sessionId, planId, disabledTools = [],
}: ToolsPanelProps) {
  const { t } = useI18n();
  const baseMainTools: Tool[] = ["chat", "canvas", "notebook", "grokipedia", "exercise", "reading"];
  const mainTools: Tool[] = planId ? [...baseMainTools, "plan-resources"] : baseMainTools;
  const [showQRModal, setShowQRModal] = useState(false);

  const getToolLabel = (id: Tool): string => {
    switch (id) {
      case "chat": return t('tools.helios');
      case "canvas": return t('tools.canvas');
      case "notebook": return t('tools.notebook');

      case "grokipedia": return t('tools.grokipedia');
      case "exercise": return t('tools.practice');
      case "reading": return t('tools.theory');
      case "help": return t('tools.help');
      case "data-input": return t('tools.dataInput');
      case "logs": return t('tools.logs');
      case "plan-resources": return t('tools.planResources');
    }
  };

  return (
    <div className={`w-52 shrink-0 flex flex-col p-3 bg-neutral-900/50 border-r border-neutral-800 ${className}`}>
      <div className="flex flex-col gap-1">
        <div className="text-[10px] uppercase tracking-wider font-medium text-neutral-500 mb-1 px-1">
          {t('tools.tools')}
        </div>
        {mainTools.map((toolId) => {
          const isDisabled = disabledTools.includes(toolId);
          return (
          <button
            key={toolId}
            onClick={() => !isDisabled && onToolChange(toolId)}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isDisabled
                ? "bg-neutral-800/30 text-neutral-600 border border-neutral-800/30 cursor-not-allowed"
                : activeTool === toolId
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-neutral-800/50 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300"
            }`}
          >
            <ToolIcon id={toolId} />
            <span>{getToolLabel(toolId)}</span>
            {toolId === "logs" && errorNotification && (
              <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 mt-auto pt-3 border-t border-neutral-800">
        {bottomTools.map((toolId) => (
          <button
            key={toolId}
            onClick={() => onToolChange(toolId)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTool === toolId
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-neutral-800/50 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300"
            }`}
          >
            <ToolIcon id={toolId} />
            <span>{getToolLabel(toolId)}</span>
            {toolId === "logs" && errorNotification && (
              <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        ))}

        {/* Mobile / QR button */}
        {sessionId && (
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all bg-neutral-800/50 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300"
            title={t('session.openOnSmartphone')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>{t('tools.mobile')}</span>
          </button>
        )}
      </div>

      {/* QR Code Modal */}
      {sessionId && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}
