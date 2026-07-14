import React, { useEffect, useState } from "react";
import { SuccessCase } from "../types";
import { Award, CheckCircle, BookOpen, ChevronRight, HelpCircle } from "lucide-react";

export default function SuccessCases() {
  const [cases, setCases] = useState<SuccessCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/success-cases")
      .then((res) => res.json())
      .then((data) => {
        setCases(data);
        if (data.length > 0) {
          setSelectedCaseId(data[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load success cases:", err);
        setLoading(false);
      });
  }, []);

  const activeCase = cases.find((c) => c.id === selectedCaseId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-slate-100">
      <div className="bg-gradient-to-r from-teal-500/20 to-emerald-500/10 p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-teal-500/20 text-teal-400 p-2 rounded-lg">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-100">成功案例库 (AI 申诉知识库)</h3>
            <p className="text-xs text-slate-400">结合真实亚马逊申诉成功样本，辅助生成极致 PoA</p>
          </div>
        </div>
        <span className="text-xs bg-teal-500/20 text-teal-400 font-medium px-2.5 py-1 rounded-full flex items-center gap-1 border border-teal-500/30">
          <CheckCircle className="h-3.5 w-3.5" />
          100% 真实通过率
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
        {/* Left Side: Tabs List */}
        <div className="md:col-span-4 border-r border-slate-800 bg-slate-950/40 p-3 flex flex-col gap-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="h-5 w-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-500">载入中...</p>
            </div>
          ) : (
            cases.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                  selectedCaseId === c.id
                    ? "bg-slate-800/80 border-teal-500/50 text-teal-300"
                    : "bg-slate-900/30 border-transparent hover:bg-slate-800/40 text-slate-300 hover:text-slate-100"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-teal-400 tracking-wider">
                    {c.type === "Account Association" && "关联违规"}
                    {c.type === "Review Manipulation" && "操纵评论"}
                    {c.type === "IP Infringement" && "侵权违规"}
                    {c.type === "Product Authenticity" && "产品真实性"}
                  </span>
                  <span className="text-sm font-medium line-clamp-1">{c.title}</span>
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform ${selectedCaseId === c.id ? "rotate-90 text-teal-400" : "text-slate-600"}`} />
              </button>
            ))
          )}
        </div>

        {/* Right Side: Detailed Content */}
        <div className="md:col-span-8 p-6 flex flex-col gap-6 bg-slate-900/50">
          {activeCase ? (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-teal-400" />
                  {activeCase.title}
                </h4>
              </div>

              {/* Section 1: Root Cause */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-rose-400 tracking-wide block mb-1.5 flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" />
                  根本原因分析 (Root Cause)
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {activeCase.rootCause}
                </p>
              </div>

              {/* Section 2 & 3: Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/20 p-4 rounded-xl border border-slate-800/60">
                  <span className="text-xs font-semibold text-teal-400 block mb-2">
                    立即采取的纠正措施 (Actions Taken)
                  </span>
                  <ul className="space-y-1.5 list-disc pl-4 text-[11px] text-slate-300">
                    {activeCase.correctiveActions.map((action, i) => (
                      <li key={i} className="leading-normal">{action}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-950/20 p-4 rounded-xl border border-slate-800/60">
                  <span className="text-xs font-semibold text-emerald-400 block mb-2">
                    预防性再发防止措施 (Preventive)
                  </span>
                  <ul className="space-y-1.5 list-disc pl-4 text-[11px] text-slate-300">
                    {activeCase.preventiveMeasures.map((measure, i) => (
                      <li key={i} className="leading-normal">{measure}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 py-12">
              <BookOpen className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">选择案例查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
