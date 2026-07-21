import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, RotateCcw, ShieldQuestion, Video } from "lucide-react";
import { VideoVerificationQuestion } from "../types";

interface Props {
  onBack: () => void;
}

type SessionQuestion = VideoVerificationQuestion & { sessionKey: string };

function shuffleQuestions(questions: VideoVerificationQuestion[]): SessionQuestion[] {
  return [...questions]
    .map((question) => ({ ...question, sessionKey: `${question.id}-${Math.random()}` }))
    .sort(() => Math.random() - 0.5);
}

export default function VideoVerificationPractice({ onBack }: Props) {
  const [questions, setQuestions] = useState<VideoVerificationQuestion[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<SessionQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/video-verification-questions")
      .then(async (response) => {
        if (!response.ok) throw new Error("题库加载失败，请稍后重试。");
        return response.json();
      })
      .then((data: VideoVerificationQuestion[]) => {
        if (!mounted) return;
        const validQuestions = data.filter((item) => item.question);
        setQuestions(validQuestions);
        setSessionQuestions(shuffleQuestions(validQuestions));
      })
      .catch((err: any) => setError(err.message || "题库加载失败，请稍后重试。"))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const currentQuestion = sessionQuestions[currentIndex];
  const progress = sessionQuestions.length ? Math.round(((currentIndex + (finished ? 1 : 0)) / sessionQuestions.length) * 100) : 0;

  const answeredCount = useMemo(
    () => sessionQuestions.filter((item) => answers[item.sessionKey]?.trim()).length,
    [answers, sessionQuestions]
  );

  const updateAnswer = (value: string) => {
    if (!currentQuestion) return;
    setAnswers((current) => ({ ...current, [currentQuestion.sessionKey]: value }));
  };

  const goNext = () => {
    if (currentIndex >= sessionQuestions.length - 1) {
      setFinished(true);
      return;
    }
    setCurrentIndex((index) => index + 1);
  };

  const restart = () => {
    setSessionQuestions(shuffleQuestions(questions));
    setAnswers({});
    setCurrentIndex(0);
    setFinished(false);
  };

  const preventCopy = (event: React.ClipboardEvent | React.MouseEvent) => {
    event.preventDefault();
  };

  if (loading) {
    return (
      <div className="min-h-[520px] flex items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-teal-400" />
        正在加载视频验证题库...
      </div>
    );
  }

  if (error || !sessionQuestions.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <ShieldQuestion className="mx-auto h-10 w-10 text-slate-600" />
        <h2 className="mt-4 text-lg font-bold text-slate-100">暂时无法开始练习</h2>
        <p className="mt-2 text-sm text-slate-400">{error || "后台还没有可用的视频验证问题。"}</p>
        <button onClick={onBack} className="mt-6 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-teal-500/60 hover:text-teal-300">
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-5xl"
      onCopy={preventCopy}
      onCut={preventCopy}
      onContextMenu={preventCopy}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:border-teal-500/50 hover:text-teal-300">
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </button>
        <div className="text-xs text-slate-500">本页面已限制复制和右键菜单</div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 bg-gradient-to-r from-teal-950/70 to-slate-950 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/15 text-teal-300">
                <Video className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-100">亚马逊视频验证模拟练习</h1>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">系统会随机提问。像真实视频一样先口头组织答案，再写下你的回答用于结束后自查。</p>
              </div>
            </div>
            <div className="min-w-[180px]">
              <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                <span>{finished ? "已完成" : `第 ${currentIndex + 1} 题 / 共 ${sessionQuestions.length} 题`}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {!finished && currentQuestion ? (
          <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
            <div className="p-6 md:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-300">{currentQuestion.category}</span>
                {currentQuestion.isRequired && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">高频必问</span>}
              </div>
              <h2 className="select-none text-2xl font-black leading-snug text-slate-100">{currentQuestion.question}</h2>
              {currentQuestion.notes && <p className="mt-3 select-none text-sm leading-relaxed text-slate-400">{currentQuestion.notes}</p>}
              <textarea
                value={answers[currentQuestion.sessionKey] || ""}
                onChange={(event) => updateAnswer(event.target.value)}
                placeholder="把你的回答写在这里。建议用语音输入法，按真实视频时会说出口的表达，不要只写关键词。"
                className="mt-6 h-48 w-full resize-y rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500/60"
              />
              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-400 disabled:cursor-not-allowed disabled:opacity-40 hover:border-slate-700 hover:text-slate-200"
                >
                  上一题
                </button>
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/10 hover:from-teal-400 hover:to-emerald-300"
                >
                  {currentIndex >= sessionQuestions.length - 1 ? "结束并核对" : "下一题"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <aside className="border-t border-slate-800 bg-slate-950/40 p-6 lg:border-l lg:border-t-0">
              <div className="text-xs font-semibold text-slate-300">练习概况</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[11px] text-slate-500">已回答</div>
                  <div className="mt-1 text-2xl font-black text-teal-300">{answeredCount}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[11px] text-slate-500">剩余</div>
                  <div className="mt-1 text-2xl font-black text-slate-200">{Math.max(0, sessionQuestions.length - currentIndex - 1)}</div>
                </div>
              </div>
              <p className="mt-4 select-none text-xs leading-relaxed text-slate-500">提示：视频验证更看重回答是否自然、具体、前后一致。结束后可以对照参考答案查缺补漏。</p>
            </aside>
          </div>
        ) : (
          <div className="p-6 md:p-8">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-teal-300">
                  <CheckCircle className="h-5 w-5" />
                  <h2 className="text-lg font-black text-slate-100">练习完成，开始核对</h2>
                </div>
                <p className="mt-1 select-none text-xs text-slate-500">下面显示本次所有问题、你的回答和后台参考答案。页面不允许复制文本。</p>
              </div>
              <button onClick={restart} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-teal-500/60 hover:text-teal-300">
                <RotateCcw className="h-4 w-4" />
                重新随机练习
              </button>
            </div>

            <div className="space-y-4 select-none">
              {sessionQuestions.map((item, index) => (
                <article key={item.sessionKey} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-slate-500">#{index + 1}</span>
                    <span className="font-semibold text-teal-300">{item.category}</span>
                    {item.isRequired && <span className="text-amber-300">高频必问</span>}
                  </div>
                  <h3 className="text-sm font-bold leading-relaxed text-slate-100">{item.question}</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                      <div className="mb-1 text-[11px] font-semibold text-slate-500">你的回答</div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{answers[item.sessionKey]?.trim() || "未填写"}</p>
                    </div>
                    <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3">
                      <div className="mb-1 text-[11px] font-semibold text-teal-300">参考答案</div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{item.referenceAnswer || "后台暂未填写参考答案"}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
