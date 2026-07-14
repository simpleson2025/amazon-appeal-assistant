import React, { useState, useRef } from "react";
import { EvidenceQuestion, UploadedFile } from "../types";
import { AlertCircle, ArrowLeft, ArrowRight, Upload, X, ShieldCheck, CheckCircle2, File } from "lucide-react";

interface QuestionnaireProps {
  questions: EvidenceQuestion[];
  answers: Record<string, string>;
  setAnswers: (answers: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: (files: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
  violationTypeZh: string;
  riskLevel: "High" | "Medium" | "Low";
}

export default function Questionnaire({
  questions,
  answers,
  setAnswers,
  uploadedFiles,
  setUploadedFiles,
  onBack,
  onNext,
  loading,
  violationTypeZh,
  riskLevel
}: QuestionnaireProps) {
  const [dragActive, setDragActive] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleInputChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleDrag = (e: React.DragEvent, questionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive((prev) => ({ ...prev, [questionId]: true }));
    } else if (e.type === "dragleave") {
      setDragActive((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const addFile = (file: File, questionId: string) => {
    const newFile: UploadedFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      questionId,
    };
    setUploadedFiles((prev) => [...prev, newFile]);
  };

  const handleDrop = (e: React.DragEvent, questionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive((prev) => ({ ...prev, [questionId]: false }));

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFile(e.dataTransfer.files[0], questionId);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, questionId: string) => {
    if (e.target.files && e.target.files[0]) {
      addFile(e.target.files[0], questionId);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const triggerFileInput = (questionId: string) => {
    fileInputRefs.current[questionId]?.click();
  };

  // Check if at least some answers are filled
  const isFormValid = questions.every((q) => {
    // If text, must have some length. If boolean/select, must have value.
    const answer = answers[q.id];
    return answer && answer.trim() !== "";
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100 flex flex-col gap-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-5 gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-teal-400" />
            第二步：补充关键证据与答卷
          </h2>
          <p className="text-xs text-slate-400">
            AI 判定您的违规类型为 <span className="text-teal-400 font-semibold">{violationTypeZh}</span>，请配合回答以下问题并提交相关证据，以最大化提高申诉通过率。
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs text-slate-400">预估申诉风险度：</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
            riskLevel === "High" 
              ? "bg-rose-500/10 border-rose-500/30 text-rose-400" 
              : riskLevel === "Medium"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          }`}>
            {riskLevel === "High" ? "🚨 高风险 (请谨慎提交)" : riskLevel === "Medium" ? "⚠️ 中等风险" : "✅ 低风险"}
          </span>
        </div>
      </div>

      {/* Dynamic Questions Form */}
      <div className="flex flex-col gap-8">
        {questions.map((q) => {
          const currentAnswer = answers[q.id] || "";
          const filesForQuestion = uploadedFiles.filter((f) => f.questionId === q.id);

          return (
            <div key={q.id} className="bg-slate-950/40 border border-slate-800/60 p-5 rounded-xl flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-start gap-2">
                  <span className="bg-teal-500/15 text-teal-400 text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 uppercase shrink-0">
                    必填
                  </span>
                  <label className="text-sm font-semibold text-slate-200">
                    {q.label}
                  </label>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed ml-11">
                  {q.description}
                </p>
              </div>

              {/* Form Input Control */}
              <div className="ml-11">
                {q.type === "select" ? (
                  <select
                    value={currentAnswer}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- 请选择 --</option>
                    {q.options?.map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : q.type === "boolean" ? (
                  <div className="flex items-center gap-4">
                    <label className={`flex items-center gap-2 cursor-pointer p-2 px-4 rounded-lg border text-xs transition-all ${
                      currentAnswer === "Yes"
                        ? "bg-teal-500/10 border-teal-500 text-teal-300 font-medium"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400"
                    }`}>
                      <input
                        type="radio"
                        name={q.id}
                        value="Yes"
                        checked={currentAnswer === "Yes"}
                        onChange={() => handleInputChange(q.id, "Yes")}
                        className="sr-only"
                      />
                      <span>是 (Yes)</span>
                    </label>
                    <label className={`flex items-center gap-2 cursor-pointer p-2 px-4 rounded-lg border text-xs transition-all ${
                      currentAnswer === "No"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300 font-medium"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400"
                    }`}>
                      <input
                        type="radio"
                        name={q.id}
                        value="No"
                        checked={currentAnswer === "No"}
                        onChange={() => handleInputChange(q.id, "No")}
                        className="sr-only"
                      />
                      <span>否 (No)</span>
                    </label>
                  </div>
                ) : (
                  <textarea
                    value={currentAnswer}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    placeholder={q.placeholder}
                    className="w-full min-h-[80px] p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-y"
                  />
                )}
              </div>

              {/* Upload Box for this question */}
              {q.proofRequired && (
                <div className="ml-11 border-t border-slate-800/80 pt-4 flex flex-col gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-teal-400/90 flex items-center gap-1">
                      📸 亚马逊建议准备的证明材料：
                    </span>
                    <span className="text-[10px] text-slate-400 leading-relaxed">
                      {q.proofRequired}
                    </span>
                  </div>

                  {/* Drag-and-drop Area */}
                  <div
                    onDragEnter={(e) => handleDrag(e, q.id)}
                    onDragOver={(e) => handleDrag(e, q.id)}
                    onDragLeave={(e) => handleDrag(e, q.id)}
                    onDrop={(e) => handleDrop(e, q.id)}
                    onClick={() => triggerFileInput(q.id)}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                      dragActive[q.id]
                        ? "border-teal-500 bg-teal-500/5"
                        : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/40"
                    }`}
                  >
                    <input
                      ref={(el) => {
                        fileInputRefs.current[q.id] = el;
                      }}
                      type="file"
                      onChange={(e) => handleFileChange(e, q.id)}
                      className="hidden"
                    />
                    <Upload className="h-5 w-5 text-slate-500" />
                    <p className="text-[11px] text-slate-300">
                      拖放文件至此，或 <span className="text-teal-400 font-semibold">点击选择文件</span> 模拟提交
                    </p>
                    <p className="text-[9px] text-slate-500">
                      支持 PDF, PNG, JPG 等格式 (最大 10MB)
                    </p>
                  </div>

                  {/* Uploaded items status */}
                  {filesForQuestion.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {filesForQuestion.map((file) => (
                        <div
                          key={file.id}
                          className="bg-slate-900 border border-slate-800/80 px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs text-slate-300"
                        >
                          <File className="h-3.5 w-3.5 text-teal-400" />
                          <span className="font-medium max-w-[150px] truncate">{file.name}</span>
                          <span className="text-[9px] text-slate-500">({file.size})</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(file.id);
                            }}
                            className="text-slate-500 hover:text-rose-400 ml-1 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Form Validation warning */}
      {!isFormValid && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>请完整填写以上所有调研问题，以便系统 AI 完美还原违规经过、对应纠正行动及再发防范策略。</span>
        </div>
      )}

      {/* Bottom Nav Action Buttons */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-5 mt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          返回上一步
        </button>

        <button
          onClick={onNext}
          disabled={!isFormValid || loading}
          className={`px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            !isFormValid
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : loading
                ? "bg-teal-500/20 text-teal-400 border border-teal-500/30 cursor-wait"
                : "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:opacity-95 shadow-lg shadow-teal-500/15 cursor-pointer"
          }`}
        >
          {loading ? "正在智能合成 AI 申诉信 (PoA)..." : "开始合成 PoA 申诉信初稿"}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
