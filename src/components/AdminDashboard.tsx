import React, { useState, useEffect, useRef } from "react";
import { SuccessCase } from "../types";
import { 
  Plus, Edit2, Trash2, FileText, Upload, Sparkles, AlertCircle, 
  CheckCircle, Loader2, ArrowLeft, Save, X, RefreshCw, ShieldCheck,
  Users, FileOutput, BarChart3
} from "lucide-react";

interface UsageAnalytics {
  daily: { date: string; users: number; generations: number; refineGenerations: number }[];
  totals: { users: number; generations: number; todayUsers: number; todayGenerations: number };
  typeCounts: { type: string; count: number }[];
}

export default function AdminDashboard() {
  const [cases, setCases] = useState<SuccessCase[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(true);
  
  // Auth states
  const [adminPassword, setAdminPassword] = useState<string>(
    () => sessionStorage.getItem("admin_password") || ""
  );
  const [tempPassword, setTempPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  // Form states
  const [editingCase, setEditingCase] = useState<SuccessCase | null>(null);
  const [isAddMode, setIsAddMode] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>("");
  const [formType, setFormType] = useState<string>("Account Association");
  const [formRootCause, setFormRootCause] = useState<string>("");
  const [formCorrectiveActions, setFormCorrectiveActions] = useState<string>("");
  const [formPreventiveMeasures, setFormPreventiveMeasures] = useState<string>("");
  const [formRequiredDocuments, setFormRequiredDocuments] = useState<string>("");

  // AI ingestion states
  const [pastedDocText, setPastedDocText] = useState<string>("");
  const [parsingDoc, setParsingDoc] = useState<boolean>(false);
  const [parseStatus, setParseStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load cases from backend
  const fetchCases = async (passToUse = adminPassword) => {
    if (!passToUse) {
      setLoadingList(false);
      setIsAuthorized(false);
      return;
    }
    
    setLoadingList(true);
    try {
      const response = await fetch("/api/success-cases", {
        headers: {
          "X-Admin-Password": passToUse
        }
      });
      
      if (response.status === 401) {
        setIsAuthorized(false);
        sessionStorage.removeItem("admin_password");
        setAdminPassword("");
        throw new Error("认证失败：密码错误或已过期。");
      }
      
      if (!response.ok) throw new Error("获取案例列表失败");
      const data = await response.json();
      setCases(data);
      setIsAuthorized(true);
    } catch (error: any) {
      console.error(error);
      if (isAuthorized) {
        alert(error.message || "加载案例知识库失败，请重新登录。");
      }
    } finally {
      setLoadingList(false);
    }
  };

  const fetchAnalytics = async (passToUse = adminPassword) => {
    if (!passToUse) return;
    setLoadingAnalytics(true);
    try {
      const response = await fetch("/api/usage-analytics?days=14", {
        headers: { "X-Admin-Password": passToUse }
      });
      if (!response.ok) throw new Error("获取使用统计失败");
      setAnalytics(await response.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (adminPassword) {
      fetchCases(adminPassword);
      fetchAnalytics(adminPassword);
    } else {
      setLoadingList(false);
    }
  }, []);

  // Handle password submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempPassword.trim()) return;
    
    setLoadingList(true);
    setLoginError("");

    fetch("/api/success-cases", {
      headers: {
        "X-Admin-Password": tempPassword
      }
    })
      .then(async (res) => {
        if (res.status === 401) {
          setLoginError("密码不正确，请输入正确的管理员密码。");
          setLoadingList(false);
          return;
        }
        if (!res.ok) throw new Error("服务器返回错误。");
        const data = await res.json();
        setCases(data);
        setAdminPassword(tempPassword);
        sessionStorage.setItem("admin_password", tempPassword);
        setIsAuthorized(true);
        fetchAnalytics(tempPassword);
        setLoginError("");
      })
      .catch((err) => {
        setLoginError(err.message || "无法连接服务器，请重试。");
      })
      .finally(() => {
        setLoadingList(false);
      });
  };

  // Handle open add mode
  const handleOpenAdd = () => {
    setEditingCase(null);
    setIsAddMode(true);
    setFormTitle("");
    setFormType("Account Association");
    setFormRootCause("");
    setFormCorrectiveActions("");
    setFormPreventiveMeasures("");
    setFormRequiredDocuments("");
    setPastedDocText("");
    setParseStatus(null);
  };

  // Handle open edit mode
  const handleOpenEdit = (c: SuccessCase) => {
    setEditingCase(c);
    setIsAddMode(false);
    setFormTitle(c.title);
    setFormType(c.type);
    setFormRootCause(c.rootCause);
    setFormCorrectiveActions(c.correctiveActions.join("\n"));
    setFormPreventiveMeasures(c.preventiveMeasures.join("\n"));
    setFormRequiredDocuments((c.requiredDocuments || []).join("\n"));
    setPastedDocText("");
    setParseStatus(null);
  };

  // Close form panel
  const handleCloseForm = () => {
    setEditingCase(null);
    setIsAddMode(false);
  };

  // Save case (Add or Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formType.trim() || !formRootCause.trim()) {
      alert("标题、违规类型和根本原因为必填字段。");
      return;
    }

    const payload = {
      title: formTitle,
      type: formType,
      rootCause: formRootCause,
      correctiveActions: formCorrectiveActions.split("\n").map(s => s.trim()).filter(Boolean),
      preventiveMeasures: formPreventiveMeasures.split("\n").map(s => s.trim()).filter(Boolean),
      requiredDocuments: formRequiredDocuments.split("\n").map(s => s.trim()).filter(Boolean)
    };

    try {
      const url = editingCase ? `/api/success-cases/${editingCase.id}` : "/api/success-cases";
      const method = editingCase ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        setIsAuthorized(false);
        sessionStorage.removeItem("admin_password");
        setAdminPassword("");
        throw new Error("登录已失效，请重新验证密码。");
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "保存失败");
      }

      await fetchCases(adminPassword);
      handleCloseForm();
    } catch (error: any) {
      alert(`保存失败: ${error.message}`);
    }
  };

  // Delete case
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确定要删除案例「${title}」吗？该操作不可撤销。`)) return;

    try {
      const response = await fetch(`/api/success-cases/${id}`, {
        method: "DELETE",
        headers: {
          "X-Admin-Password": adminPassword
        }
      });

      if (response.status === 401) {
        setIsAuthorized(false);
        sessionStorage.removeItem("admin_password");
        setAdminPassword("");
        throw new Error("登录已失效，请重新验证密码。");
      }

      if (!response.ok) throw new Error("删除失败");
      await fetchCases(adminPassword);
    } catch (error: any) {
      alert(`删除失败: ${error.message}`);
    }
  };

  // AI Ingest Parser Call
  const handleAiParse = async () => {
    if (!pastedDocText.trim()) {
      alert("请先粘贴申诉信内容或上传文档。");
      return;
    }

    setParsingDoc(true);
    setParseStatus(null);

    try {
      const response = await fetch("/api/parse-case-doc", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword
        },
        body: JSON.stringify({ docText: pastedDocText })
      });

      if (response.status === 401) {
        setIsAuthorized(false);
        sessionStorage.removeItem("admin_password");
        setAdminPassword("");
        throw new Error("登录已失效，请重新验证密码。");
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "解析失败");
      }

      const data = await response.json();
      
      // Auto-fill form fields
      setFormTitle(data.title || "导入的成功申诉案例");
      setFormType(data.type || "Other");
      setFormRootCause(data.rootCause || "");
      setFormCorrectiveActions(Array.isArray(data.correctiveActions) ? data.correctiveActions.join("\n") : "");
      setFormPreventiveMeasures(Array.isArray(data.preventiveMeasures) ? data.preventiveMeasures.join("\n") : "");
      setFormRequiredDocuments(Array.isArray(data.requiredDocuments) ? data.requiredDocuments.join("\n") : "");

      setParseStatus({
        type: "success",
        message: "AI 成功解析出申诉要素，表单已自动填入！请在下方核对并保存。"
      });
    } catch (error: any) {
      setParseStatus({
        type: "error",
        message: `AI 解析失败: ${error.message}`
      });
    } finally {
      setParsingDoc(false);
    }
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPastedDocText(text);
      }
    };
    reader.onerror = () => {
      alert("读取文件失败，请重试。");
    };
    reader.readAsText(file);
  };

  const maxTypeCount = Math.max(1, ...(analytics?.typeCounts || []).map((item) => item.count));

  // 1. Password login screen
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[450px] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[200px] h-[200px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
          
          <div className="text-center">
            <div className="mx-auto bg-gradient-to-tr from-teal-500 to-emerald-400 p-3.5 rounded-2xl w-14 h-14 flex items-center justify-center shadow-lg shadow-teal-500/15">
              <ShieldCheck className="h-7 w-7 text-slate-950 stroke-[2.5]" />
            </div>
            <h2 className="mt-6 text-center text-xl font-black text-slate-100 tracking-wide">
              管理员后台认证
            </h2>
            <p className="mt-2 text-center text-xs text-slate-400 leading-relaxed">
              后台案例数据库包含高价值申诉材料资产。请输入管理员密码以继续访问控制台。
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleLoginSubmit}>
            <div>
              <label htmlFor="admin-password" className="sr-only">管理员密码</label>
              <input
                id="admin-password"
                name="password"
                type="password"
                required
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="appearance-none rounded-xl relative block w-full px-4 py-3.5 border border-slate-800 placeholder-slate-650 text-slate-100 bg-slate-950 focus:outline-none focus:ring-teal-500/50 focus:border-teal-500/50 focus:z-10 text-xs tracking-wider"
                placeholder="请输入安全认证密码..."
              />
            </div>

            {loginError && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-350 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-450" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loadingList}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-xs font-bold rounded-xl text-slate-950 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all shadow-lg shadow-teal-500/10 disabled:opacity-50 cursor-pointer"
              >
                {loadingList ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "验证身份并进入后台"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. Authorized dashboard content
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-slate-100 min-h-[500px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-950/60 to-emerald-950/40 p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-teal-500/20 text-teal-400 p-2.5 rounded-xl border border-teal-500/30 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-100 tracking-wide">
              申诉案例知识库后台 (Admin Portal)
            </h3>
            <p className="text-xs text-slate-400">
              在这里上传并维护申诉成功案例，AI 将在后台学习它们以改进 POA 生成算法
            </p>
          </div>
        </div>

        {!isAddMode && !editingCase && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-teal-500/20 text-xs cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            上传成功案例
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {!isAddMode && !editingCase && (
          <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950/35 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-teal-400">
                  <BarChart3 className="h-4 w-4" />
                  <h4 className="text-sm font-bold">使用数据概览</h4>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">统计成功完成 AI 诊断或生成的匿名访客；不保存邮件、问卷和 POA 正文。</p>
              </div>
              <button
                onClick={() => fetchAnalytics(adminPassword)}
                className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500 hover:text-teal-400"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingAnalytics ? "animate-spin" : ""}`} />
                刷新统计
              </button>
            </div>

            {loadingAnalytics && !analytics ? (
              <div className="py-8 text-center text-xs text-slate-500">正在加载使用数据…</div>
            ) : analytics ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Users className="h-3.5 w-3.5" />今日使用人数</div>
                    <div className="mt-1 text-2xl font-black text-teal-400">{analytics.totals.todayUsers}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><FileOutput className="h-3.5 w-3.5" />今日生成 POA</div>
                    <div className="mt-1 text-2xl font-black text-emerald-400">{analytics.totals.todayGenerations}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-[11px] text-slate-500">累计使用人数</div>
                    <div className="mt-1 text-2xl font-black text-slate-100">{analytics.totals.users}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-[11px] text-slate-500">累计生成 POA</div>
                    <div className="mt-1 text-2xl font-black text-slate-100">{analytics.totals.generations}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-300">近 14 天每日使用</div>
                    <div className="flex h-28 items-end gap-1.5 border-b border-slate-800 pb-1">
                      {analytics.daily.map((day) => (
                        <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${day.date}：${day.users} 人使用，${day.generations} 次生成`}>
                          <div className="rounded-t bg-teal-500/70 transition-all group-hover:bg-teal-400" style={{ height: `${Math.max(day.users ? 10 : 2, (day.users / Math.max(1, ...analytics.daily.map((item) => item.users))) * 100)}%` }} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-slate-600"><span>{analytics.daily[0]?.date}</span><span>柱高＝匿名使用人数</span><span>{analytics.daily[analytics.daily.length - 1]?.date}</span></div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-300">近 14 天 POA 类型</div>
                    <div className="space-y-2">
                      {analytics.typeCounts.length ? analytics.typeCounts.map((item) => (
                        <div key={item.type} className="grid grid-cols-[minmax(90px,150px)_1fr_auto] items-center gap-2 text-[11px]">
                          <span className="truncate text-slate-400" title={item.type}>{item.type}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${(item.count / maxTypeCount) * 100}%` }} /></div>
                          <span className="font-semibold text-emerald-400">{item.count}</span>
                        </div>
                      )) : <div className="py-6 text-center text-xs text-slate-600">暂无 POA 生成记录</div>}
                    </div>
                  </div>
                </div>
              </>
            ) : <div className="py-6 text-center text-xs text-slate-500">暂时无法读取使用统计。</div>}
          </section>
        )}
        {/* Case Form Panel (Add / Edit) */}
        {(isAddMode || editingCase) ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Col: AI Import Helper */}
            {isAddMode && (
              <div className="lg:col-span-5 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-800 pb-6 lg:pb-0 lg:pr-8">
                <div className="flex items-center gap-2 text-teal-400">
                  <Sparkles className="h-4.5 w-4.5" />
                  <span className="font-bold text-sm tracking-wide">AI 智能提取导入 (推荐)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  直接拖入已申诉成功的 .txt/.md 申诉信文本，或复制粘贴内容。AI 会自动把信中的根本原因、纠正措施、防范措施提取出来填进右侧表单。
                </p>

                {/* Upload Zone */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-teal-500/50 hover:bg-slate-950/40 rounded-xl p-5 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="h-6 w-6 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-300">点击上传成功案例文档 (.txt/.md)</span>
                  <span className="text-[10px] text-slate-500">文件会在本地浏览器读取</span>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".txt,.md" 
                    className="hidden" 
                  />
                </div>

                {/* Paste Area */}
                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-[10px] font-bold text-slate-400">或直接粘贴申诉成功的原文：</label>
                  <textarea
                    value={pastedDocText}
                    onChange={(e) => setPastedDocText(e.target.value)}
                    placeholder="在此粘贴已恢复申诉信的原文 (中文或英文均可)..."
                    className="w-full h-44 bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs focus:border-teal-500/50 focus:outline-none resize-none font-mono placeholder:text-slate-650 text-slate-300"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAiParse}
                  disabled={parsingDoc}
                  className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 font-semibold py-2.5 rounded-xl transition-all text-xs disabled:opacity-50 cursor-pointer"
                >
                  {parsingDoc ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                      AI 智能分析提取中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-teal-400" />
                      点击 AI 一键提取填表
                    </>
                  )}
                </button>

                {parseStatus && (
                  <div className={`flex items-start gap-2 p-3 rounded-xl border text-[11px] ${
                    parseStatus.type === "success" 
                      ? "bg-teal-500/10 border-teal-500/20 text-teal-300"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                  }`}>
                    {parseStatus.type === "success" ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-teal-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    )}
                    <span>{parseStatus.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Right Col: Editable form */}
            <form 
              onSubmit={handleSave} 
              className={`flex flex-col gap-4 ${isAddMode ? "lg:col-span-7" : "lg:col-span-12"}`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-sm text-slate-200">
                  {editingCase ? "✍️ 编辑成功案例" : "➕ 手动录入案例数据"}
                </span>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">案例标题 (显示在后台备忘)：</label>
                <input 
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="如：操纵评论二审成功申诉模板 / SECTION 3 关联成功模板"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-teal-500/50 focus:outline-none"
                  required
                />
              </div>

              {/* Type Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">亚马逊违规分类 (必填，AI 学习索引凭据)：</label>
                  <select 
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-teal-500/50 focus:outline-none"
                  >
                    <option value="Account Association">Account Association (关联账号)</option>
                    <option value="IP Infringement">IP Infringement (侵权)</option>
                    <option value="Review Manipulation">Review Manipulation (操纵评论/刷单)</option>
                    <option value="Product Authenticity">Product Authenticity (真实性质疑/二手当新品)</option>
                    <option value="Section 3 / Code of Conduct">Section 3 / Code of Conduct (商业行为/欺诈等限制)</option>
                    <option value="Velocity Limit">Velocity Limit (销量激增风控)</option>
                    <option value="Other">Other (其他类型)</option>
                  </select>
                </div>
              </div>

              {/* Root Cause */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">根本原因分析 (Root Cause)：</label>
                <textarea 
                  value={formRootCause}
                  onChange={(e) => setFormRootCause(e.target.value)}
                  placeholder="阐明为什么会出现这个违规，如：采购没有核实授权链条、误用他人商标等..."
                  className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-teal-500/50 focus:outline-none resize-y"
                  required
                />
              </div>

              {/* Actions & Measures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    立即纠正措施 (每行代表一个条目)：
                  </label>
                  <textarea 
                    value={formCorrectiveActions}
                    onChange={(e) => setFormCorrectiveActions(e.target.value)}
                    placeholder="彻底删除 Listing&#10;向品牌方致歉和解&#10;销毁违规产品库存..."
                    className="w-full h-36 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-teal-500/50 focus:outline-none resize-y font-sans leading-relaxed"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    长期防范措施 (每行代表一个条目)：
                  </label>
                  <textarea 
                    value={formPreventiveMeasures}
                    onChange={(e) => setFormPreventiveMeasures(e.target.value)}
                    placeholder="建立双人选品专利交叉检索&#10;只向有一手授权的工厂进货并开专票&#10;对员工进行定期的亚马逊合规培训..."
                    className="w-full h-36 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-teal-500/50 focus:outline-none resize-y font-sans leading-relaxed"
                  />
                </div>
              </div>

              {/* Required supporting documents */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  用户需上传的证明材料（每行一项）
                </label>
                <textarea
                  value={formRequiredDocuments}
                  onChange={(e) => setFormRequiredDocuments(e.target.value)}
                  placeholder={"营业执照\n法人身份证\n采购发票\n采购合同\n公证书"}
                  className="w-full h-28 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-teal-500/50 focus:outline-none resize-y font-sans leading-relaxed"
                />
                <p className="text-[10px] text-slate-500">保存后会作为该成功案例要求用户准备和上传的材料清单。</p>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 mt-4 border-t border-slate-850 pt-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 font-semibold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-teal-500/10 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  保存并同步到知识库
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* List of cases view */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>所有成功申诉案例 ({cases.length}) — 从新到旧排列</span>
              <button 
                onClick={() => fetchCases(adminPassword)}
                className="flex items-center gap-1 hover:text-teal-400 transition-colors p-1 cursor-pointer"
                title="刷新列表"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                刷新
              </button>
            </div>

            {loadingList ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 bg-slate-950/20 border border-slate-850 rounded-2xl">
                <Loader2 className="h-6 w-6 text-teal-500 animate-spin" />
                <span className="text-xs text-slate-500">正在载入案例知识库数据...</span>
              </div>
            ) : cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 bg-slate-950/20 border border-slate-850 rounded-2xl">
                <FileText className="h-10 w-10 text-slate-700" />
                <span className="text-xs text-slate-500">知识库中暂无成功案例，请点击右上角上传</span>
              </div>
            ) : (
              <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950/20">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-850">
                      <th className="p-4 font-bold tracking-wide">分类 / 违规类型</th>
                      <th className="p-4 font-bold tracking-wide">案例标题</th>
                      <th className="p-4 font-bold tracking-wide">根本原因概要</th>
                      <th className="p-4 font-bold tracking-wide text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/80">
                    {cases.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="p-4 font-semibold text-teal-400 align-top whitespace-nowrap">
                          {c.type === "Account Association" && "关联违规"}
                          {c.type === "Review Manipulation" && "操纵评论"}
                          {c.type === "IP Infringement" && "侵权违规"}
                          {c.type === "Product Authenticity" && "产品真实性"}
                          {c.type === "Section 3 / Code of Conduct" && "Section 3 商业行为"}
                          {c.type === "Velocity Limit" && "销量激增风控"}
                          {c.type === "Other" && "其他违规"}
                          <span className="block text-[10px] text-slate-500 font-mono mt-0.5">{c.type}</span>
                        </td>
                        <td className="p-4 font-semibold text-slate-200 align-top max-w-[200px] leading-relaxed">
                          {c.title}
                        </td>
                        <td className="p-4 text-slate-400 align-top leading-relaxed max-w-[320px]">
                          <p className="line-clamp-2">{c.rootCause}</p>
                          <div className="flex gap-2.5 mt-1.5 text-[10px]">
                            <span className="text-teal-400/80">纠正: {c.correctiveActions.length}项</span>
                            <span className="text-emerald-400/80">预防: {c.preventiveMeasures.length}项</span>
                            <span className="text-sky-400/80">材料: {c.requiredDocuments?.length || 0}项</span>
                          </div>
                        </td>
                        <td className="p-4 align-top whitespace-nowrap text-right text-slate-400">
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(c)}
                              className="p-2 hover:bg-slate-800 hover:text-teal-400 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                              title="编辑案例"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id, c.title)}
                              className="p-2 hover:bg-slate-800 hover:text-rose-400 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                              title="删除案例"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
