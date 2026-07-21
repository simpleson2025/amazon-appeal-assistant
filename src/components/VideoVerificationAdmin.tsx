import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Loader2, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { VideoVerificationQuestion } from "../types";

interface Props {
  adminPassword: string;
  onAuthExpired: () => void;
}

const emptyForm: Omit<VideoVerificationQuestion, "id"> = {
  category: "视频前准备",
  question: "",
  referenceAnswer: "",
  isRequired: false,
  status: "",
  notes: "",
};

export default function VideoVerificationAdmin({ adminPassword, onAuthExpired }: Props) {
  const [questions, setQuestions] = useState<VideoVerificationQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<VideoVerificationQuestion | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部分类");

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/video-verification-questions", {
        headers: { "X-Admin-Password": adminPassword },
      });
      if (response.status === 401) {
        onAuthExpired();
        return;
      }
      if (!response.ok) throw new Error("题库加载失败");
      setQuestions(await response.json());
    } catch (error: any) {
      alert(error.message || "题库加载失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const categories = useMemo(
    () => ["全部分类", ...Array.from(new Set(questions.map((item) => item.category).filter(Boolean)))],
    [questions]
  );

  const filteredQuestions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return questions.filter((item) => {
      const matchesCategory = categoryFilter === "全部分类" || item.category === categoryFilter;
      const text = `${item.category} ${item.question} ${item.referenceAnswer} ${item.notes}`.toLowerCase();
      return matchesCategory && (!keyword || text.includes(keyword));
    });
  }, [questions, search, categoryFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsAdding(true);
  };

  const openEdit = (question: VideoVerificationQuestion) => {
    setEditing(question);
    setForm({
      category: question.category,
      question: question.question,
      referenceAnswer: question.referenceAnswer,
      isRequired: question.isRequired,
      status: question.status || "",
      notes: question.notes || "",
    });
    setIsAdding(false);
  };

  const closeForm = () => {
    setEditing(null);
    setIsAdding(false);
  };

  const saveQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.question.trim()) {
      alert("问题内容不能为空。");
      return;
    }

    try {
      const response = await fetch(editing ? `/api/video-verification-questions/${editing.id}` : "/api/video-verification-questions", {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
        body: JSON.stringify(form),
      });
      if (response.status === 401) {
        onAuthExpired();
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "保存失败");
      }
      await fetchQuestions();
      closeForm();
    } catch (error: any) {
      alert(error.message || "保存失败，请重试。");
    }
  };

  const deleteQuestion = async (question: VideoVerificationQuestion) => {
    if (!confirm(`确定删除这个视频验证问题吗？\n\n${question.question}`)) return;
    try {
      const response = await fetch(`/api/video-verification-questions/${question.id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": adminPassword },
      });
      if (response.status === 401) {
        onAuthExpired();
        return;
      }
      if (!response.ok) throw new Error("删除失败");
      await fetchQuestions();
    } catch (error: any) {
      alert(error.message || "删除失败，请重试。");
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/35 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-sm font-black text-slate-100">亚马逊视频验证题库</h4>
          <p className="mt-1 text-[11px] text-slate-500">维护模拟练习会随机抽问的问题、参考答案和必问标记。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={fetchQuestions} className="flex items-center gap-1.5 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-teal-500/50 hover:text-teal-300">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:from-teal-400 hover:to-emerald-300">
            <Plus className="h-4 w-4" />
            新增问题
          </button>
        </div>
      </div>

      {(isAdding || editing) && (
        <form onSubmit={saveQuestion} className="mb-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold text-teal-300">{editing ? "编辑视频验证问题" : "新增视频验证问题"}</span>
            <button type="button" onClick={closeForm} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-300">
              分类
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-teal-500/60" />
            </label>
            <label className="flex items-center gap-2 pt-5 text-xs font-semibold text-slate-300">
              <input type="checkbox" checked={form.isRequired} onChange={(event) => setForm({ ...form, isRequired: event.target.checked })} className="h-4 w-4 accent-teal-500" />
              高频必问
            </label>
          </div>
          <label className="mt-4 flex flex-col gap-1.5 text-xs font-semibold text-slate-300">
            问题
            <textarea value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} className="h-20 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-100 outline-none focus:border-teal-500/60" required />
          </label>
          <label className="mt-4 flex flex-col gap-1.5 text-xs font-semibold text-slate-300">
            参考答案
            <textarea value={form.referenceAnswer} onChange={(event) => setForm({ ...form, referenceAnswer: event.target.value })} className="h-24 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-100 outline-none focus:border-teal-500/60" />
          </label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-300">
              状态
              <input value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-teal-500/60" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-300">
              备注
              <input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-teal-500/60" />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200">取消</button>
            <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400">
              <Save className="h-3.5 w-3.5" />
              保存问题
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索问题、答案或备注" className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-slate-100 outline-none focus:border-teal-500/60" />
        </label>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-teal-500/60">
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-xs text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-teal-400" />
          正在加载题库...
        </div>
      ) : (
        <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[880px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-slate-950 text-slate-400">
              <tr>
                <th className="p-3 font-bold">分类</th>
                <th className="p-3 font-bold">问题</th>
                <th className="p-3 font-bold">参考答案</th>
                <th className="p-3 font-bold">标记</th>
                <th className="p-3 text-right font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/30">
              {filteredQuestions.map((question) => (
                <tr key={question.id} className="hover:bg-slate-900/50">
                  <td className="w-36 p-3 align-top font-semibold text-teal-300">{question.category}</td>
                  <td className="max-w-[300px] p-3 align-top text-slate-200">{question.question}</td>
                  <td className="max-w-[340px] p-3 align-top text-slate-400">
                    <p className="line-clamp-3 whitespace-pre-wrap">{question.referenceAnswer || "未填写"}</p>
                  </td>
                  <td className="w-28 p-3 align-top">
                    {question.isRequired ? <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300">必问</span> : <span className="text-slate-600">普通</span>}
                  </td>
                  <td className="w-24 p-3 text-right align-top">
                    <button onClick={() => openEdit(question)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-teal-300" title="编辑">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteQuestion(question)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-300" title="删除">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredQuestions.length && <div className="bg-slate-950/30 py-10 text-center text-xs text-slate-500">没有找到匹配的问题</div>}
        </div>
      )}
    </section>
  );
}
