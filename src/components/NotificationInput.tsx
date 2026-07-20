import React, { useState } from "react";
import { Sparkles, AlertCircle, RefreshCw, FileText } from "lucide-react";

interface NotificationInputProps {
  emailText: string;
  setEmailText: (text: string) => void;
  previousPoa: string;
  setPreviousPoa: (text: string) => void;
  rejectionEmail: string;
  setRejectionEmail: (text: string) => void;
  flowType: "generate" | "refine";
  setFlowType: (flow: "generate" | "refine") => void;
  onAnalyze: () => Promise<void>;
  loading: boolean;
  error: string | null;
  onClearLocalData: () => void;
  onOpenLegalPage: (document: "privacy" | "terms" | "disclaimer") => void;
}

const SAMPLE_EMAILS = {
  ip_infringement: `Dear Seller,
We are writing to inform you that we have removed your listing for ASIN B07Y32KL89 due to a report of patent infringement received from the rights owner PeakDesign Ltd.

Complaint ID: 89732102
Infringement Type: Design Patent Infringement (US Patent D891,321)
Rights Owner: PeakDesign Ltd.
Rights Owner Email: legal@peakdesign-brands.com

What you can do:
If you believe this is an error, please provide a Letter of Authorization (LoA) or licensing agreement from the rights owner proving authenticity. Alternatively, contact the rights owner to request a retraction of the complaint. If you cannot obtain a retraction, submit a Plan of Action detailing why the infringement occurred and how you will audit your inventory to prevent future intellectual property issues.

Sincerely,
Amazon Notice Team`,

  association: `Dear Seller,
Your Amazon Seller account has been deactivated in accordance with Section 3 of Amazon’s Business Solutions Agreement. Your listings have been removed. Funds will not be transferred to you but will be held in your account while we work with you to address this issue.

Why did this happen?
We found that your account is related to an account "AlphaTech_Store" which has been deactivated for violating our policies. As a result, you may no longer sell on Amazon.com.

How do I reactivate my account?
To reactivate this selling account, please submit an appeal detailing that you have never owned or operated the related account and provide supporting documentation (such as utility bills, internet broadband contracts, or lease agreements) to prove physical and logical separation.

Sincerely,
Seller Performance Team
Amazon.com`,

  review_manipulation: `Dear Seller,
We have determined that your account has engaged in review manipulation or brushing activities, which violates our Customer Review Creation Policy. 

Why did this happen?
We detected unusual review patterns and refund patterns on ASIN B09X82F12K. Specifically, we have identified that you offered compensation, free products, or discounts to buyers in exchange for positive reviews, or hired a third-party manipulation service.

How do I reactivate my account?
Please submit a Plan of Action containing:
1. The detailed root cause of the review manipulation, including details of any third parties you hired.
2. Immediate actions you have taken, including a list of all affected orders and buyer accounts.
3. Precise preventive measures to ensure you remain fully compliant with Amazon's Terms of Service.

Failure to provide a sufficient Plan of Action will result in the permanent suspension of your seller privileges.

Sincerely,
Amazon Seller Performance`,

  product_authenticity: `Dear Seller,
Your listings have been suspended because we received customer complaints about the authenticity of the items listed at the bottom of this email. 

ASIN: B087X21MOP
Title: Premium Wireless Headphones
Complaint Type: Inauthentic / Fake Goods

To reactivate your listings, please provide copies of invoices, receipts, or authorization letters from your supplier issued within the last 365 days. The document must reflect your sales volume, supplier contact details, and match your registered Amazon store legal name.

Sincerely,
Amazon Product Safety Team`,

  product_condition: `Dear Seller,
We received buyer complaints that items shipped from your inventory arrived in a "Used" or "Damaged" condition, although they were listed as "New".

ASIN: B091V28X98
Type of complaint: Used Sold as New
Details: Customers reported scuff marks, unsealed retail packaging, and missing product manuals.

Please submit a Plan of Action explaining how your packaging, storage, or transport allowed this to happen, your immediate inventory audits, and your preventive packaging standards to avoid future buyer complaints.

Sincerely,
Seller Performance Team`,

  listing_policy: `Dear Seller,
We have removed your product detail pages or suspended your listings because you have violated Amazon's Listing Creation Policy by adding incorrect variations (parent-child relationship hijacking or duplicate listings to bypass sales limits).

ASINs: B07823LK9A, B07823LK9B
Violation Type: ASIN Creation Policy / Variation Misuse

Please submit an appeal with a detailed explanation of your listing creation procedures, how you corrected the variation relationships, and your future compliance training plans.

Sincerely,
Amazon Catalog Team`,

  restricted_products: `Dear Seller,
We are writing to notify you that you are offering restricted products for sale on Amazon.com. This is a violation of our Restricted Products Policy.

ASIN: B08D93K112
Product Type: Unapproved Medical Device / Pesticide Device

Please submit an appeal demonstrating that this product does not violate our policies, or submit a Plan of Action detailing how you will audit your entire inventory and filter restricted products before listing.

Sincerely,
Amazon Compliance Team`,

  kyc_verification: `Dear Seller,
We are currently conducting a scheduled review of your selling account. To comply with European Union regulations and payment service guidelines, you must complete our Know Your Customer (KYC) identity verification.

Your account privileges will remain temporarily restricted until we have verified your identity and business legitimacy.

Please submit:
1. A high-quality copy of your official business registration document (营业执照).
2. A recent utility bill (gas, water, electricity, or landline phone) matching your company address.
3. Shareholder identity documents and authorization letters.

Sincerely,
Amazon Payments Team`
};

const SAMPLE_REJECTIONS = {
  invoice_rejected: `Dear Seller,
We received your appeal but we cannot reactivate your account at this time. 

Why did this happen?
The invoices you provided are not verifiable. They lack the supplier's website, or the invoice details do not match your seller registered legal identity. 

What to do next:
Please submit a new Plan of Action providing verifiable invoices including the name, phone number, address, and website of the supplier. Ensure the quantity matches your sales volume.`,

  root_cause_rejected: `Dear Seller,
Thank you for submitting your plan of action. We reviewed your appeal but we have determined that your Plan of Action is not sufficient to reactivate your selling account.

Why is it insufficient?
Your explanation of the root cause of the design patent infringement is not detailed. You did not explain why your listing was created without trademark/patent clearance and who was responsible for validating the listings.

What you must do:
Provide a detailed explanation of:
- The root cause of the infringement (design patent US D891,321).
- What process failed and why this wasn't discovered before listing.`,

  preventive_rejected: `Dear Seller,
Your account remains suspended. We received your appeal, but the preventive measures listed in your Plan of Action are vague and do not demonstrate that you have implemented long-term measures to prevent review manipulation.

Specifically, you must provide details on:
- How you will monitor your employees' marketing activities.
- How you will ensure no third-party review services are hired.
- What training and auditing steps you have established.`
};

const SAMPLE_PREVIOUS_POA = `Dear Amazon Seller Performance Team,

I am writing to appeal the deactivation of my selling account due to design patent infringement for ASIN B07Y32KL89.

1. Root Cause:
We mistakenly listed the product ASIN B07Y32KL89 which looked similar to PeakDesign's patented design. Our supplier told us the design was free to use, and we did not verify this ourselves.

2. Corrective Actions:
- We have deleted ASIN B07Y32KL89 from our catalog.
- We contacted PeakDesign Ltd to apologize and ask them to retract the complaint.

3. Preventive Measures:
- We will check all listings before listing them.
- We will train our staff about IP compliance.

Sincerely,`;

export default function NotificationInput({
  emailText,
  setEmailText,
  previousPoa,
  setPreviousPoa,
  rejectionEmail,
  setRejectionEmail,
  flowType,
  setFlowType,
  onAnalyze,
  loading,
  error,
  onClearLocalData,
  onOpenLegalPage
}: NotificationInputProps) {
  const [activeSample, setActiveSample] = useState<string>("");
  const [activeRejectionSample, setActiveRejectionSample] = useState<string>("");
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);

  const handleApplySample = (key: keyof typeof SAMPLE_EMAILS) => {
    setEmailText(SAMPLE_EMAILS[key]);
    setActiveSample(key);
  };

  const handleApplyRejectionSample = (key: keyof typeof SAMPLE_REJECTIONS) => {
    setRejectionEmail(SAMPLE_REJECTIONS[key]);
    setPreviousPoa(SAMPLE_PREVIOUS_POA);
    setActiveRejectionSample(key);
  };

  const handleClear = () => {
    if (flowType === "generate") {
      setEmailText("");
      setActiveSample("");
    } else {
      setPreviousPoa("");
      setRejectionEmail("");
      setActiveRejectionSample("");
    }
  };

  const isFormFilled = flowType === "generate" 
    ? emailText.trim() !== "" 
    : previousPoa.trim() !== "" && rejectionEmail.trim() !== "";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100 flex flex-col gap-6">
      {/* Tab Selector */}
      <div className="flex border-b border-slate-800 pb-1">
        <button
          onClick={() => setFlowType("generate")}
          className={`px-6 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            flowType === "generate"
              ? "border-teal-500 text-teal-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          全新申诉信生成
        </button>
        <button
          onClick={() => setFlowType("refine")}
          className={`px-6 py-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            flowType === "refine"
              ? "border-teal-500 text-teal-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          申诉未通过完善 (修改被拒POA)
        </button>
      </div>

      {flowType === "generate" ? (
        <>
          {/* Title block */}
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-400" />
              第一步：输入亚马逊违规通知
            </h2>
            <p className="text-xs text-slate-400">
              请粘贴亚马逊绩效团队发送给您的违规限制邮件或警告通知，系统 AI 将自动提炼出其根本原因、违规类型并生成证据收集问卷。
            </p>
          </div>

          {/* Preset template tags */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400">选择快速测试示例邮件（一键载入）：</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(SAMPLE_EMAILS) as Array<keyof typeof SAMPLE_EMAILS>).map((key) => {
                const labels: Record<string, string> = {
                  ip_infringement: "🛡️ 知识产权侵权",
                  association: "💻 账户关联封号",
                  review_manipulation: "⭐ 操纵买家评论",
                  product_authenticity: "🔍 商品真实性(售假)",
                  product_condition: "📦 商品状况买家投诉",
                  listing_policy: "📋 违反商品上架政策",
                  restricted_products: "🚫 违反受限商品政策",
                  kyc_verification: "🆔 二审/KYC审核"
                };
                return (
                  <button
                    key={key}
                    onClick={() => handleApplySample(key)}
                    className={`text-left text-xs p-3 rounded-xl border transition-all cursor-pointer ${
                      activeSample === key
                        ? "bg-teal-500/15 border-teal-500 text-teal-300 font-medium"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    {labels[key] || key}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Textarea */}
          <div className="relative">
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="在此粘贴亚马逊违规/警告通知原始英文全文... (Paste performance notification email here...)"
              className="w-full min-h-[280px] p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 font-mono text-xs leading-relaxed resize-y focus:ring-1 focus:ring-teal-500/20"
            />
            {emailText && (
              <button
                onClick={handleClear}
                className="absolute top-3 right-3 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                清空内容
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Refine mode title */}
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-400" />
              第一步：输入原 POA 及亚马逊最新的拒绝信
            </h2>
            <p className="text-xs text-slate-400">
              系统将智能分析亚马逊拒绝您的具体理由与目前 POA 的不足，并针对性地引导您补充相关证据以进行升级修改。
            </p>
          </div>

          {/* Preset rejection template tags */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400">选择快速测试示例拒信（一键载入）：</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handleApplyRejectionSample("invoice_rejected")}
                className={`text-left text-xs p-3 rounded-xl border transition-all cursor-pointer ${
                  activeRejectionSample === "invoice_rejected"
                    ? "bg-teal-500/15 border-teal-500 text-teal-300 font-medium"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                🔍 发票/凭证不合规驳回 (Invoice Rejected)
              </button>
              <button
                onClick={() => handleApplyRejectionSample("root_cause_rejected")}
                className={`text-left text-xs p-3 rounded-xl border transition-all cursor-pointer ${
                  activeRejectionSample === "root_cause_rejected"
                    ? "bg-teal-500/15 border-teal-500 text-teal-300 font-medium"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                🛡️ 根本原因阐述不充分驳回 (Root Cause Insufficient)
              </button>
              <button
                onClick={() => handleApplyRejectionSample("preventive_rejected")}
                className={`text-left text-xs p-3 rounded-xl border transition-all cursor-pointer ${
                  activeRejectionSample === "preventive_rejected"
                    ? "bg-teal-500/15 border-teal-500 text-teal-300 font-medium"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                ⭐ 预防措施模糊驳回 (Preventive Vague)
              </button>
            </div>
          </div>

          {/* Twin inputs row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-teal-400" />
                此前提交并被拒的 POA (Previous POA)
              </label>
              <textarea
                value={previousPoa}
                onChange={(e) => setPreviousPoa(e.target.value)}
                placeholder="在此粘贴被亚马逊驳回的 POA 申诉信全文..."
                className="w-full min-h-[220px] p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono text-xs leading-relaxed resize-y focus:ring-1 focus:ring-teal-500/20"
              />
            </div>

            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-rose-400" />
                亚马逊最新的拒绝信/退件邮件 (Rejection Email)
              </label>
              <textarea
                value={rejectionEmail}
                onChange={(e) => setRejectionEmail(e.target.value)}
                placeholder="在此粘贴亚马逊发送的最新拒绝信或驳回业绩通知英文全文..."
                className="w-full min-h-[220px] p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono text-xs leading-relaxed resize-y focus:ring-1 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {(previousPoa || rejectionEmail) && (
            <div className="flex justify-end">
              <button
                onClick={handleClear}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                清空输入
              </button>
            </div>
          )}
        </>
      )}

      {/* Warning Tip */}
      <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-slate-200">AI 诊断提示</span>
          <span className="text-[11px] text-slate-400 leading-relaxed">
            建议复制亚马逊发送的 **完整英文原文**
            。英文通知中含有申诉部门识别案情的关键代码（例如：Section 3、Complaint ID、特定 ASIN
            ），能帮助 AI 更精确地匹配问卷问题和成功申诉链条。
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-4 text-xs leading-relaxed">
        <p className="font-semibold text-teal-300">提交前请确认</p>
        <p className="mt-1 text-slate-300">本站为独立第三方 AI 辅助工具，非 Amazon 官方服务，不保证申诉成功或任何审核结果。您输入的申诉内容将发送至 AI 服务提供商处理；原始邮件草稿会保存在当前浏览器中。请勿粘贴密码、验证码、银行卡号或无关敏感信息。</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="flex items-start gap-2 text-slate-200 cursor-pointer">
            <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} className="mt-0.5 accent-teal-500" />
            <span>我已阅读并同意隐私政策、服务条款和免责声明。</span>
          </label>
          <button onClick={() => onOpenLegalPage("privacy")} className="text-teal-400 hover:text-teal-300">隐私政策</button>
          <button onClick={() => onOpenLegalPage("terms")} className="text-teal-400 hover:text-teal-300">服务条款</button>
          <button onClick={() => onOpenLegalPage("disclaimer")} className="text-teal-400 hover:text-teal-300">免责声明</button>
          <button onClick={onClearLocalData} className="text-slate-400 hover:text-slate-200">清除本机草稿</button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-xl text-xs text-rose-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={onAnalyze}
        disabled={loading || !isFormFilled || !privacyAccepted}
        className={`w-full py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
          !isFormFilled || !privacyAccepted
            ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-transparent"
            : loading
              ? "bg-teal-500/20 text-teal-400 border border-teal-500/30 cursor-wait"
              : "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:opacity-95 shadow-lg shadow-teal-500/10 active:scale-[0.99] cursor-pointer"
        }`}
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            {flowType === "generate" ? "正在深度解析邮件 (AI 诊断中...)" : "正在诊断拒信与 POA (AI 规划中...)"}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {flowType === "generate" ? "开始 AI 诊断，匹配证据问卷" : "开始 AI 诊断，找出问题并匹配补充问卷"}
          </>
        )}
      </button>
    </div>
  );
}
