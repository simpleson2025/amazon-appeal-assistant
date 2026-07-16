import React, { useState, useEffect } from "react";
import StepIndicator from "./components/StepIndicator";
import NotificationInput from "./components/NotificationInput";
import Questionnaire from "./components/Questionnaire";
import PoaReview from "./components/PoaReview";
import AdminDashboard from "./components/AdminDashboard";
import PublicSuccessCases from "./components/PublicSuccessCases";
import { EmailAnalysis, GeneratedPoA, UploadedFile } from "./types";
import {
  ShieldCheck, ArrowRight, BookOpen, AlertCircle, Sparkles,
  HelpCircle, MessageCircle, FileText, CheckCircle, RefreshCw, ArrowLeft
} from "lucide-react";

export default function App() {
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Routing state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const handleUrlChange = () => {
      const isParam = window.location.search.includes("admin=true");
      const isPath = window.location.pathname.startsWith("/admin");
      setIsAdmin(isParam || isPath);
    };

    handleUrlChange();
    
    // Listen to history state changes
    window.addEventListener("popstate", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
    };
  }, []);

  // Flow control states: "generate" for new POA, "refine" for perfecting a rejected POA
  const [flowType, setFlowType] = useState<"generate" | "refine">("generate");
  const [emailText, setEmailText] = useState<string>("");
  const [previousPoa, setPreviousPoa] = useState<string>("");
  const [rejectionEmail, setRejectionEmail] = useState<string>("");

  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Analysis Output state (used for questionnaire and risk level)
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);

  // Step 2: Questionnaire Answers state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Step 3: Generated PoA state
  const [loadingPoa, setLoadingPoa] = useState<boolean>(false);
  const [poa, setPoa] = useState<GeneratedPoA | null>(null);

  // Auto-restore draft from localStorage if available
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("amazon_appeal_email");
      if (savedEmail) {
        setEmailText(savedEmail);
      }
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
    }
  }, []);

  // Save email draft as user types
  const handleEmailChange = (text: string) => {
    setEmailText(text);
    try {
      localStorage.setItem("amazon_appeal_email", text);
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  };

  // 1. Analyze Email/Rejection with AI
  const handleAnalyzeEmail = async () => {
    if (flowType === "generate" && !emailText.trim()) return;
    if (flowType === "refine" && (!previousPoa.trim() || !rejectionEmail.trim())) return;

    setLoadingAnalysis(true);
    setAnalysisError(null);

    try {
      const endpoint = flowType === "generate" ? "/api/analyze-email" : "/api/analyze-rejection";
      const body = flowType === "generate" 
        ? { emailText } 
        : { previousPoa, rejectionEmail };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorMsg = flowType === "generate" ? "解析邮件失败，请确认格式。" : "解析拒绝信失败，请确认内容。";
        try {
          const errorData = await response.json();
          if (errorData?.error) errorMsg = errorData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data: EmailAnalysis = await response.json();
      setAnalysis(data);

      // Initialize empty answers for the questions
      const initialAnswers: Record<string, string> = {};
      data.evidenceQuestions.forEach((q) => {
        initialAnswers[q.id] = "";
      });
      setAnswers(initialAnswers);
      setUploadedFiles([]); // clear old files

      setCurrentStep(2); // advance to questionnaire
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || "连接服务器时发生未知错误，请重试。");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // 2. Generate or Refine Plan of Action
  const handleGeneratePoa = async () => {
    if (!analysis) return;

    setLoadingPoa(true);

    try {
      const endpoint = flowType === "generate" ? "/api/generate-poa" : "/api/refine-poa";
      const body = flowType === "generate"
        ? {
            emailText,
            violationType: analysis.violationType,
            answers,
            additionalNotes: "",
          }
        : {
            previousPoa,
            rejectionEmail,
            violationType: analysis.violationType,
            answers,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorMsg = "生成 PoA 失败，请检查填写内容。";
        try {
          const errorData = await response.json();
          if (errorData?.error) errorMsg = errorData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data: GeneratedPoA = await response.json();
      setPoa(data);
      setCurrentStep(3); // Go to preview
    } catch (err: any) {
      console.error(err);
      alert(err.message || "生成 PoA 失败，请重试。");
    } finally {
      setLoadingPoa(false);
    }
  };

  // 3. Polish or re-generate PoA with Expert adjustments
  const handleRegenerateWithAdjustments = async (adjustments: string) => {
    if (!analysis) return;

    setLoadingPoa(true);

    try {
      const endpoint = flowType === "generate" ? "/api/generate-poa" : "/api/refine-poa";
      const body = flowType === "generate"
        ? {
            emailText,
            violationType: analysis.violationType,
            answers,
            additionalNotes: "",
            expertAdjustments: adjustments,
          }
        : {
            previousPoa,
            rejectionEmail,
            violationType: analysis.violationType,
            answers,
            expertAdjustments: adjustments,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorMsg = "精细润色失败。";
        try {
          const errorData = await response.json();
          if (errorData?.error) errorMsg = errorData.error;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data: GeneratedPoA = await response.json();
      setPoa(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "润色失败，请重试。");
    } finally {
      setLoadingPoa(false);
    }
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
  };

  const handleBackToStep2 = () => {
    setCurrentStep(2);
  };

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-teal-500/30 selection:text-teal-200">
        {/* Decorative ambient background glows */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

        {/* Admin Header */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-teal-500 to-emerald-400 p-2.5 rounded-xl shadow-lg shadow-teal-500/10 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-slate-950 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-1.5">
                  Amazon Appeal AI <span className="text-teal-400 font-medium text-xs">后台管理</span>
                </h1>
                <p className="text-[10px] text-slate-400">
                  知识库与案例管理控制台
                </p>
              </div>
            </div>

            <button 
              onClick={() => {
                window.history.pushState({}, "", "/");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 bg-slate-900 border border-slate-800 hover:border-teal-500/30 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer font-semibold"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回前台生成器
            </button>
          </div>
        </header>

        {/* Admin Main */}
        <main className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-8">
          <AdminDashboard />
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-6 text-slate-600 text-center text-xs">
          Amazon Appeal Assistant Admin Portal © 2026.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-teal-500/30 selection:text-teal-200">
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Main Header / Navigation bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-teal-500 to-emerald-400 p-2.5 rounded-xl shadow-lg shadow-teal-500/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-1.5">
                Amazon Appeal AI <span className="text-teal-400 font-medium text-xs">申诉助手</span>
              </h1>
              <p className="text-[10px] text-slate-400">
                亚马逊自动化卖家申诉生成器 (Plan of Action - PoA Generator)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-bold px-2.5 py-1 rounded-full">
              ● AI 专家实时在线
            </span>
            <span className="text-[11px] text-slate-500">
              当前版本: v2.5 (Pro)
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Promotion and Core Workflow Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/20 border border-slate-800/80 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl" />
          <div className="flex flex-col gap-2 max-w-2xl">
            <span className="text-[10px] font-bold tracking-widest text-teal-400 uppercase">
              100% 免费公开申诉工具
            </span>
            <h2 className="text-xl md:text-2xl font-black text-slate-100 leading-tight">
              把违规通知交给我们，<br />
              一键生成亚马逊绩效团队认可的高通过率 PoA。
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mt-1">
              由资深亚马逊申诉服务商倾心打造。我们公开内部申诉逻辑，结合 Gemini 3.5 AI 推理引擎。系统自动通过「违规类型精准判断 → 启发式证据收集问卷 → 成功案例库比对 → 生成中英双语标准 PoA」，彻底打破服务商信息差。
            </p>
          </div>

          <div className="flex flex-col gap-2.5 bg-slate-950/80 border border-slate-800 p-4.5 rounded-xl min-w-[240px]">
            <span className="text-[11px] font-bold text-slate-300">系统已支持的违规场景：</span>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">✅ 关联销售限制</span>
              <span className="flex items-center gap-1">✅ 虚假评论操纵</span>
              <span className="flex items-center gap-1">✅ 知识产权侵权</span>
              <span className="flex items-center gap-1">✅ 产品真实性质疑</span>
              <span className="flex items-center gap-1">✅ Section 3 商业行为</span>
              <span className="flex items-center gap-1">✅ 销量激增风控</span>
            </div>
          </div>
        </div>

        {/* Step Indicator Section */}
        <StepIndicator currentStep={currentStep} />

        {/* Dynamic Wizard Steps */}
        <div className="w-full">
          {currentStep === 1 && (
            <NotificationInput
              emailText={emailText}
              setEmailText={handleEmailChange}
              previousPoa={previousPoa}
              setPreviousPoa={setPreviousPoa}
              rejectionEmail={rejectionEmail}
              setRejectionEmail={setRejectionEmail}
              flowType={flowType}
              setFlowType={setFlowType}
              onAnalyze={handleAnalyzeEmail}
              loading={loadingAnalysis}
              error={analysisError}
            />
          )}

          {currentStep === 2 && analysis && (
            <Questionnaire
              questions={analysis.evidenceQuestions}
              answers={answers}
              setAnswers={setAnswers}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              onBack={handleBackToStep1}
              onNext={handleGeneratePoa}
              loading={loadingPoa}
              violationTypeZh={analysis.violationTypeZh}
              riskLevel={analysis.riskLevel}
            />
          )}

          {currentStep === 3 && poa && (
            <PoaReview
              poa={poa}
              onBack={handleBackToStep2}
              onRegenerate={handleRegenerateWithAdjustments}
              loading={loadingPoa}
              uploadedFiles={uploadedFiles}
              emailText={emailText}
              violationType={analysis?.violationTypeZh || analysis?.violationType}
              onStartRefine={(poaText) => {
                setPreviousPoa(poaText);
                setFlowType("refine");
                setRejectionEmail(""); // reset rejection email
                setCurrentStep(1);
              }}
            />
          )}
        </div>
        {/* Static Knowledge base or Success Cases (Always visible at bottom for reference) */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-teal-400" />
            <h3 className="font-bold text-base text-slate-200">
              官方成功案例库 (参考指南)
            </h3>
          </div>
          <PublicSuccessCases />
        </div>

      </main>

      {/* Sincere Footer with Disclaimers */}
      <footer className="border-t border-slate-900 bg-slate-950 py-10 mt-12 text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-center md:text-left">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-slate-400">
              Amazon Appeal AI — 亚马逊智能自助申诉服务商平台
            </span>
            <span>
              © 2026 Amazon Appeal Assistant Inc. 保留所有权利。
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span>免责声明：本工具生成的申诉信由 AI 结合历史公开成功案例合成，因店铺违规具体证据链各异，最终是否恢复以亚马逊官方审核结果为准。</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
