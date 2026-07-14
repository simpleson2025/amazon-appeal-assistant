import React from "react";
import { Mail, ClipboardList, Sparkles, FileDown, Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    {
      index: 1,
      label: "输入违规邮件",
      subLabel: "卖家输入违规邮件",
      icon: Mail,
    },
    {
      index: 2,
      label: "补充证据材料",
      subLabel: "动态触发信息收集",
      icon: ClipboardList,
    },
    {
      index: 3,
      label: "智能 PoA 初稿",
      subLabel: "AI 合成与专家润色",
      icon: Sparkles,
    },
    {
      index: 4,
      label: "标准格式下载",
      subLabel: "标准 PoA 文档导出",
      icon: FileDown,
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto py-6 px-4">
      <div className="relative flex items-center justify-between w-full">
        {/* Background connector line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
        
        {/* Active colored line segment */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-400 -translate-y-1/2 z-0 transition-all duration-500 ease-out"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const isCompleted = currentStep > step.index;
          const isActive = currentStep === step.index;
          const StepIcon = step.icon;

          return (
            <div key={step.index} className="flex flex-col items-center relative z-10">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted 
                    ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-lg shadow-teal-500/20" 
                    : isActive 
                      ? "bg-slate-950 text-teal-400 border-2 border-teal-500 shadow-md shadow-teal-500/10 scale-110" 
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 stroke-[3]" />
                ) : (
                  <StepIcon className="h-5 w-5" />
                )}
              </div>
              <div className="mt-3 text-center">
                <span className={`text-xs font-semibold block transition-colors ${isActive ? "text-teal-400 font-bold" : isCompleted ? "text-slate-300" : "text-slate-500"}`}>
                  {step.label}
                </span>
                <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5 max-w-[120px] mx-auto leading-tight">
                  {step.subLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
