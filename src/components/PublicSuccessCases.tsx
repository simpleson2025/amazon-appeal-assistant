import React, { useState } from "react";
import { Award, CheckCircle, BookOpen, ChevronRight, HelpCircle } from "lucide-react";

// Static public cases
const PUBLIC_CASES = [
  {
    id: "case-association",
    title: "关联销售销售限制申诉 (Section 3 Account Association)",
    type: "Account Association",
    rootCause: "卖家因在公共WiFi网络下登录、或浏览器Stale cookies未清理导致与已被禁账户产生关联关联，或是将子账号授权给了离职员工的个人邮箱，导致连锁封号。",
    correctiveActions: [
      "彻底排查所有关联设备和网络，断开不安全连接；",
      "撤销并清除所有第三方离职员工、代运营账户的临时子账号授权；",
      "在干净的新专线网络（静态独享IP）上部署操作设备，彻底清空浏览器Cookies；",
      "整理并提供公司营业执照、宽带合同与缴费账单证明网络和物理环境独立。"
    ],
    preventiveMeasures: [
      "推行严格的独立运营规范：专网专线专机专办，严禁非工作设备登录后台；",
      "定期更新并审计Seller Central的用户访问权限（User Permissions）；",
      "建立公司出入人员登记与网络访问白名单控制体系。"
    ]
  },
  {
    id: "case-brushing",
    title: "虚假交易/操纵评论申诉 (Review Manipulation / Brushing)",
    type: "Review Manipulation",
    rootCause: "卖家为提升新品权重，雇佣了不专业的站外违规推广服务商（或测评机构），通过高折扣返现或违规索评，被亚马逊检测出买家账户集中异常下单和评论操纵。",
    correctiveActions: [
      "终止与所有违规测评机构、推广服务商的合作协议；",
      "对全账订单开展追溯审计，筛查出所有违规订单、ASIN，列出受影响的清单；",
      "主动向亚马逊提交涉事买家ID、测评服务商联系方式、返款凭证，并恳请撤回这些非真实评价；",
      "清理不合规的买家索评邮件模板。"
    ],
    preventiveMeasures: [
      "仅使用亚马逊官方工具进行新品推广与测评（如Amazon Vine计划、买家自动索评工具）；",
      "对全体运营人员进行亚马逊《买家评论行为准则（Buyer Review Policy）》的合规考试和定期培训；",
      "建立内部合规稽查机制，严禁任何形式的站外私下送礼返现活动。"
    ]
  },
  {
    id: "case-infringement",
    title: "知识产权侵权申诉 (Intellectual Property Infringement)",
    type: "IP Infringement",
    rootCause: "采购团队在进行选品时，仅比对了外观而没有进行深度的设计专利、商标版权检索，导致销售的一款热销产品外观结构落入竞品外观设计专利范围内（或者在Listing中误用了竞品的品牌关键词）。",
    correctiveActions: [
      "立即下架并永久删除被投诉的Listing，召回或就地销毁FBA仓库中所有的相关库存；",
      "联系权利人律师致以诚挚歉意，解释是由于供应链失误导致的误伤，并主动提出经济和解，寻求撤诉（Retraction）；",
      "对供应商的货源重新审计，要求其提供授权证明。"
    ],
    preventiveMeasures: [
      "采购端落实“双人核验选品流程”：每款新品必须通过专业的美国/欧洲专利局检索，并出具检索报告；",
      "在选品录入系统 and 撰写Listing阶段，对所有涉及品牌专有名词进行自动化关键词核对，杜绝蹭热度现象；",
      "与正规、具备自主品牌及授权书的大型供应商签订合规保证合同。"
    ]
  },
  {
    id: "case-authenticity",
    title: "产品真实性申诉 (Product Authenticity / Inauthentic)",
    type: "Product Authenticity",
    rootCause: "因产品包装被压瘪、中英文标贴缺失导致买家收到货后质疑为“二手”或“伪造”，或卖家因货源为1688批发市场未开具增值税专用发票，无法提供合规链条凭证。",
    correctiveActions: [
      "更换质量更好的外包装箱（加装防撞护角及泡泡纸），严格质检退回库存；",
      "向国内源头工厂补开正规的增值税专用发票（发票上的采购商信息与亚马逊店铺主体严格一致）；",
      "提供供应商的公司信息、生产资质授权，附带采购合同、出货单、发票链条，说明产品是100%源自正规工厂生产。"
    ],
    preventiveMeasures: [
      "全部改由直接向品牌方或其一级特约经销商采购，确保每次采购均取得正规全额增值税发票，并按单归档；",
      "加强入仓前的二次检验标准（IQC），对任何有包装瑕疵的产品采取零容忍直接退回供应商政策；",
      "在主图和详情页中加入更详实的防伪标识指导 and 正品验证方法。"
    ]
  }
];

export default function PublicSuccessCases() {
  const [selectedCaseId, setSelectedCaseId] = useState<string>("case-association");

  const activeCase = PUBLIC_CASES.find((c) => c.id === selectedCaseId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-slate-100">
      <div className="bg-gradient-to-r from-teal-500/20 to-emerald-500/10 p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-teal-500/20 text-teal-400 p-2 rounded-lg">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-100">官方成功案例库 (参考指南)</h3>
            <p className="text-xs text-slate-400">结合真实亚马逊申诉成功样本，了解申诉书结构</p>
          </div>
        </div>
        <span className="text-xs bg-teal-500/20 text-teal-400 font-medium px-2.5 py-1 rounded-full flex items-center gap-1 border border-teal-500/30">
          <CheckCircle className="h-3.5 w-3.5" />
          官方标准通过案例
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
        {/* Left Side: Tabs List */}
        <div className="md:col-span-4 border-r border-slate-800 bg-slate-950/40 p-3 flex flex-col gap-2">
          {PUBLIC_CASES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCaseId(c.id)}
              className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                selectedCaseId === c.id
                  ? "bg-slate-805/80 border-teal-500/50 text-teal-300"
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
          ))}
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
