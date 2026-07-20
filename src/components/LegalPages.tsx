import React from "react";
import { ArrowLeft, FileText, ShieldCheck, Scale } from "lucide-react";

export type LegalDocument = "privacy" | "terms" | "disclaimer";

interface LegalPagesProps {
  document: LegalDocument;
  onBack: () => void;
}

const content: Record<LegalDocument, { title: string; icon: typeof ShieldCheck; sections: Array<{ heading: string; body: React.ReactNode }> }> = {
  privacy: {
    title: "隐私政策",
    icon: ShieldCheck,
    sections: [
      { heading: "我们处理哪些信息", body: "当您使用 AI 分析或生成申诉信时，您输入的亚马逊通知、历史 PoA、拒信、问卷回答及用于润色的文字会被发送至 AI 服务提供商（Gemini）处理。请勿提交密码、验证码、银行卡号、完整身份证件或与申诉无关的敏感信息。" },
      { heading: "本机草稿与统计", body: "原始申诉邮件草稿及人工审核联系方式会保存在您当前浏览器的本地存储中，便于下次继续编辑；您可在首页随时一键清除。本服务还会生成随机访客标识，并按日期保存访问量、生成次数及违规类型等使用统计，不用于识别您的真实身份。" },
      { heading: "人工审核的额外处理", body: "只有在您主动勾选授权并提交人工审核申请时，我们才会将您的联系方式、当前 PoA、违规类型及必要的原始邮件/申诉背景摘要发送给人工服务团队，以便联系和评估。原始背景摘要最长 1,000 字，PoA 最长 1,500 字。" },
      { heading: "保存与删除", body: "除上述本机草稿、匿名使用统计和您主动申请人工审核时的必要信息外，本服务不会将普通 AI 请求中的申诉正文另行写入本站的业务数据库。您可通过首页的“清除本机草稿”删除浏览器中的相关草稿；如需处理已提交的人工审核信息，请通过页面所列邮箱联系我们。" },
      { heading: "联系我们", body: <><a className="text-teal-400 hover:text-teal-300" href="mailto:simpleson@dingtalk.com">simpleson@dingtalk.com</a>。本政策最后更新于 2026 年 7 月 20 日。</> }
    ]
  },
  terms: {
    title: "服务条款",
    icon: FileText,
    sections: [
      { heading: "服务性质", body: "本服务提供 AI 辅助的申诉信息梳理、问卷和文案草稿生成功能，供卖家自行审阅、修改和决定是否使用。您应自行核实输出内容及证明材料的真实性、完整性和适用性。" },
      { heading: "用户责任", body: "您承诺仅提交自己有权处理的内容，并确保所提供的事实、文件和陈述真实、合法。不得将本服务用于提交虚假材料、规避平台规则、侵犯他人权益或其他违法活动。" },
      { heading: "第三方服务", body: "为提供 AI 分析功能，您的输入会被发送至第三方 AI 服务提供商处理；主动申请人工审核时，相关必要信息会被发送给人工服务团队。使用本服务即表示您理解并同意该等处理。" },
      { heading: "服务变更", body: "我们可能更新功能、说明或本条款。继续使用更新后的服务即表示您接受更新后的内容。" },
      { heading: "联系我们", body: <><a className="text-teal-400 hover:text-teal-300" href="mailto:simpleson@dingtalk.com">simpleson@dingtalk.com</a></> }
    ]
  },
  disclaimer: {
    title: "免责声明",
    icon: Scale,
    sections: [
      { heading: "非 Amazon 官方服务", body: "本服务是独立第三方 AI 辅助工具，并非 Amazon 官方服务，未获得 Amazon 授权、认可，也不代表 Amazon 提供服务。本服务与 Amazon 不存在隶属或合作关系。" },
      { heading: "不保证申诉结果", body: "AI 生成的内容仅供参考，不构成法律、合规、税务、经营或专业意见。我们不保证申诉成功、账户恢复、款项解冻、商品恢复上架或任何审核结果；所有最终决定均由 Amazon 依其规则独立作出。" },
      { heading: "请自行审阅", body: "AI 输出可能不完整、不准确或不适用于您的具体情况。提交前请自行审阅、核实并按需咨询合格的专业人士。因使用或依赖本服务内容而产生的风险和后果，由您自行承担。" },
      { heading: "联系方式", body: <><a className="text-teal-400 hover:text-teal-300" href="mailto:simpleson@dingtalk.com">simpleson@dingtalk.com</a></> }
    ]
  }
};

export default function LegalPages({ document, onBack }: LegalPagesProps) {
  const page = content[document];
  const Icon = page.icon;
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      <main className="max-w-3xl mx-auto px-4 py-10">
        <button onClick={onBack} className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-teal-400 transition-colors">
          <ArrowLeft className="h-4 w-4" /> 返回申诉助手
        </button>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-8"><Icon className="h-7 w-7 text-teal-400" /><h1 className="text-2xl font-bold">{page.title}</h1></div>
          <div className="space-y-7 text-sm leading-7 text-slate-300">
            {page.sections.map((section) => <section key={section.heading}><h2 className="text-base font-semibold text-slate-100 mb-1">{section.heading}</h2><div>{section.body}</div></section>)}
          </div>
        </div>
      </main>
    </div>
  );
}
