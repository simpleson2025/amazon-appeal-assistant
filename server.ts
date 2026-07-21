import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json({ limit: "10mb" }));

// Lazy initializer for Gemini client
let geminiAI: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in the environment variables. Please configure it in the Secrets panel.");
    }
    geminiAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiAI;
}

/**
 * Call Gemini models.generateContent with exponential backoff retry for transient errors (e.g. 503, 429).
 */
async function generateContentWithRetry(
  ai: GoogleGenAI,
  options: {
    model: string;
    contents: any;
    config?: any;
  },
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<any> {
  let attempt = 0;
  while (true) {
    try {
      return await ai.models.generateContent(options);
    } catch (error: any) {
      attempt++;
      
      const status = error.status || (error.error && error.error.code);
      const message = error.message || "";
      const isTransient =
        status === 503 || // Service Unavailable / High demand
        status === 429 || // Too Many Requests / Rate limit
        status === 502 || // Bad Gateway
        status === 504 || // Gateway Timeout
        !status ||        // Network/connection errors
        message.includes("UNAVAILABLE") ||
        message.includes("high demand") ||
        message.includes("overloaded");

      if (attempt > maxRetries || !isTransient) {
        throw error;
      }

      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[Gemini API] Transient error (status: ${status || "unknown"}). Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

interface SuccessCase {
  id: string;
  title: string;
  type: string;
  rootCause: string;
  correctiveActions: string[];
  preventiveMeasures: string[];
  requiredDocuments?: string[];
}

interface VideoVerificationQuestion {
  id: string;
  category: string;
  question: string;
  referenceAnswer: string;
  isRequired: boolean;
  status?: string;
  notes?: string;
}

let cachedCases: SuccessCase[] = [];
let cachedVideoQuestions: VideoVerificationQuestion[] = [];
const CASES_FILE_PATH = path.join(process.cwd(), "data", "success-cases.json");
const ANALYTICS_FILE_PATH = path.join(process.cwd(), "data", "usage-analytics.json");
const VIDEO_QUESTIONS_FILE_PATH = path.join(process.cwd(), "data", "video-verification-questions.json");

interface DailyUsageStats {
  visitors: string[];
  generations: number;
  refineGenerations: number;
  typeCounts: Record<string, number>;
}

let usageAnalytics: Record<string, DailyUsageStats> = {};

function getShanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function loadUsageAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE_PATH)) {
      usageAnalytics = JSON.parse(fs.readFileSync(ANALYTICS_FILE_PATH, "utf-8"));
    }
  } catch (err) {
    console.error("[Analytics] Error loading usage analytics:", err);
    usageAnalytics = {};
  }
}

function saveUsageAnalytics() {
  try {
    const dir = path.dirname(ANALYTICS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ANALYTICS_FILE_PATH, JSON.stringify(usageAnalytics, null, 2), "utf-8");
  } catch (err) {
    console.error("[Analytics] Error saving usage analytics:", err);
  }
}

function getAnalyticsVisitorId(req: express.Request) {
  const value = req.headers["x-analytics-visitor"];
  const visitorId = Array.isArray(value) ? value[0] : value;
  return visitorId && /^[a-zA-Z0-9-]{8,128}$/.test(visitorId) ? visitorId : null;
}

function recordUsage(req: express.Request, violationType?: string, isRefinement = false) {
  const visitorId = getAnalyticsVisitorId(req);
  if (!visitorId) return;

  const day = getShanghaiDate();
  const stats = usageAnalytics[day] || {
    visitors: [],
    generations: 0,
    refineGenerations: 0,
    typeCounts: {}
  };

  if (!stats.visitors.includes(visitorId)) stats.visitors.push(visitorId);
  if (violationType) {
    stats.generations += 1;
    if (isRefinement) stats.refineGenerations += 1;
    stats.typeCounts[violationType] = (stats.typeCounts[violationType] || 0) + 1;
  }
  usageAnalytics[day] = stats;
  saveUsageAnalytics();
}

function getUsageAnalytics(days = 14) {
  const dayKeys = Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
  });
  const daily = dayKeys.map((date) => {
    const stats = usageAnalytics[date];
    return {
      date,
      users: stats?.visitors.length || 0,
      generations: stats?.generations || 0,
      refineGenerations: stats?.refineGenerations || 0
    };
  });
  const rangeTypeCounts: Record<string, number> = {};
  for (const date of dayKeys) {
    for (const [type, count] of Object.entries(usageAnalytics[date]?.typeCounts || {})) {
      rangeTypeCounts[type] = (rangeTypeCounts[type] || 0) + count;
    }
  }
  const allVisitorIds = new Set(Object.values(usageAnalytics).flatMap((stats) => stats.visitors));
  return {
    daily,
    totals: {
      users: allVisitorIds.size,
      generations: Object.values(usageAnalytics).reduce((total, stats) => total + stats.generations, 0),
      todayUsers: daily[daily.length - 1]?.users || 0,
      todayGenerations: daily[daily.length - 1]?.generations || 0
    },
    typeCounts: Object.entries(rangeTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
  };
}

// Helper to load success cases
function loadSuccessCases() {
  try {
    if (fs.existsSync(CASES_FILE_PATH)) {
      const data = fs.readFileSync(CASES_FILE_PATH, "utf-8");
      cachedCases = JSON.parse(data);
      console.log(`[Success Cases] Loaded ${cachedCases.length} cases from ${CASES_FILE_PATH}`);
    } else {
      // Seed default cases
      const defaultCases: SuccessCase[] = [
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
            "在选品录入系统和撰写Listing阶段，对所有涉及品牌专有名词进行自动化关键词核对，杜绝蹭热度现象；",
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
            "在主图和详情页中加入更详实的防伪标识指导和正品验证方法。"
          ]
        }
      ];

      const dir = path.dirname(CASES_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CASES_FILE_PATH, JSON.stringify(defaultCases, null, 2), "utf-8");
      cachedCases = defaultCases;
      console.log(`[Success Cases] Initialized success-cases.json with ${cachedCases.length} seed cases`);
    }
  } catch (err) {
    console.error("[Success Cases] Error loading cases from file:", err);
    cachedCases = [];
  }
}

// Helper to save success cases
function saveSuccessCases() {
  try {
    const dir = path.dirname(CASES_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CASES_FILE_PATH, JSON.stringify(cachedCases, null, 2), "utf-8");
    console.log(`[Success Cases] Saved ${cachedCases.length} cases to file`);
  } catch (err) {
    console.error("[Success Cases] Error saving cases to file:", err);
  }
}

function normalizeVideoQuestion(input: Partial<VideoVerificationQuestion>, fallbackId?: string): VideoVerificationQuestion {
  return {
    id: String(input.id || fallbackId || `vq-${Date.now()}`),
    category: String(input.category || "未分类").trim() || "未分类",
    question: String(input.question || "").trim(),
    referenceAnswer: String(input.referenceAnswer || "").trim(),
    isRequired: Boolean(input.isRequired),
    status: String(input.status || "").trim(),
    notes: String(input.notes || "").trim(),
  };
}

function loadVideoVerificationQuestions() {
  try {
    if (fs.existsSync(VIDEO_QUESTIONS_FILE_PATH)) {
      const data = fs.readFileSync(VIDEO_QUESTIONS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(data);
      cachedVideoQuestions = Array.isArray(parsed)
        ? parsed.map((item, index) => normalizeVideoQuestion(item, String(index + 1))).filter((item) => item.question)
        : [];
      console.log(`[Video Verification] Loaded ${cachedVideoQuestions.length} questions from ${VIDEO_QUESTIONS_FILE_PATH}`);
    } else {
      cachedVideoQuestions = [];
      saveVideoVerificationQuestions();
    }
  } catch (err) {
    console.error("[Video Verification] Error loading questions from file:", err);
    cachedVideoQuestions = [];
  }
}

function saveVideoVerificationQuestions() {
  try {
    const dir = path.dirname(VIDEO_QUESTIONS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(VIDEO_QUESTIONS_FILE_PATH, JSON.stringify(cachedVideoQuestions, null, 2), "utf-8");
    console.log(`[Video Verification] Saved ${cachedVideoQuestions.length} questions to file`);
  } catch (err) {
    console.error("[Video Verification] Error saving questions to file:", err);
  }
}

// 1. Analyze Email Endpoint
app.post("/api/analyze-email", async (req, res) => {
  const { emailText } = req.body;
  if (!emailText || emailText.trim() === "") {
    return res.status(400).json({ error: "违规邮件内容不能为空。" });
  }

  try {
    const ai = getGeminiClient();

    // The violation type is identified by the model in this same request, so provide a
    // compact, type-grouped reference set and instruct it to use only the matching group.
    // Limiting each type to the latest three cases keeps the prompt useful as the library grows.
    const casesByType = new Map<string, SuccessCase[]>();
    for (const successCase of cachedCases) {
      const cases = casesByType.get(successCase.type) || [];
      cases.push(successCase);
      casesByType.set(successCase.type, cases);
    }
    const caseKnowledge = Array.from(casesByType.entries())
      .map(([type, cases]) => {
        const referenceCases = cases.slice(-3).map((successCase, index) => `
Reference Case ${index + 1}: ${successCase.title}
- Root cause: ${successCase.rootCause}
- Corrective actions: ${successCase.correctiveActions.join("; ")}
- Preventive measures: ${successCase.preventiveMeasures.join("; ")}
- Required supporting documents: ${(successCase.requiredDocuments || []).join("; ") || "Not specified"}`);
        return `Violation type: ${type}\n${referenceCases.join("\n")}`;
      })
      .join("\n\n");

    const systemInstruction = `
You are an expert Amazon Appeal Consultant. Your goal is to analyze the seller's suspension or warning email and determine the precise violation details in high-fidelity JSON.
Strictly categorize the violation into one of the following standard types:
- "Account Association" (关联账号)
- "IP Infringement" (侵权)
- "Review Manipulation" (刷单/操纵评论)
- "Product Authenticity" (产品真实性/仿品/二手当新品)
- "Section 3 / Code of Conduct" (商业行为/销售限制/欺诈行为)
- "Velocity Limit" (销量激增)
- "Other" (其他违规)

You must output a tailored set of 3 to 5 questionnaire questions that are critical to collecting the evidence needed for generating a professional Plan of Action (PoA) of this type.
When successful-case knowledge is supplied in the user prompt, first identify the violation type from the seller's email, then consult ONLY the reference cases under that same violation type. Use their root-cause patterns, corrective actions, preventive measures, and required supporting documents to make the questions more specific. Do not treat reference-case facts as facts about this seller; ask the seller to confirm them and request only relevant evidence.
For example:
- For Account Association: ask about VPS usage, past closed shops, third-party permissions, utility bill readiness.
- For Review Manipulation: ask about specific ASIN orders, third-party reviewers/promoters, refund transactions, Vine usage.
- For IP Infringement: ask about the patented keyword or design, letters of authorization, retraction progress, stock disposal.
- For Product Authenticity: ask about invoices from suppliers, packaging issues, logistics chains.

Ensure the questionnaire questions are in Chinese, highly professional, with complete explanations, descriptions, and lists of "proof materials required" (支持性证据证明材料).
The final output must be valid JSON conforming to the defined schema. Use "gemini-3.5-flash" for this task.
`;

    const prompt = `
Please analyze this Amazon seller notification email:

"""
${emailText}
"""

Below is the administrator-maintained successful-case knowledge base. It is reference material only. Use only the section matching the violation type you identify from the email.

<SUCCESS_CASE_KNOWLEDGE>
${caseKnowledge || "No successful cases are currently available."}
</SUCCESS_CASE_KNOWLEDGE>

Provide the analysis and evidence-collection questionnaire in structured JSON representation.
`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["violationType", "violationTypeZh", "summary", "suggestedCaseTitle", "riskLevel", "evidenceQuestions"],
          properties: {
            violationType: {
              type: Type.STRING,
              description: "The primary standard English classification: 'Account Association', 'IP Infringement', 'Review Manipulation', 'Product Authenticity', 'Section 3 / Code of Conduct', 'Velocity Limit', or 'Other'"
            },
            violationTypeZh: {
              type: Type.STRING,
              description: "The corresponding Chinese classification name"
            },
            summary: {
              type: Type.STRING,
              description: "A comprehensive summary of the notification in Chinese, pointing out affected ASINs, marketplaces, deadlines, and key reasons."
            },
            suggestedCaseTitle: {
              type: Type.STRING,
              description: "Suggested professional title for this appeal case."
            },
            riskLevel: {
              type: Type.STRING,
              description: "Appeal risk level: 'High' | 'Medium' | 'Low'"
            },
            evidenceQuestions: {
              type: Type.ARRAY,
              description: "Tailored evidence collection questions based on this violation type (3 to 5 questions)",
              items: {
                type: Type.OBJECT,
                required: ["id", "label", "type", "placeholder", "description", "proofRequired"],
                properties: {
                  id: { type: Type.STRING, description: "e.g., q1, q2, q3" },
                  label: { type: Type.STRING, description: "Chinese label of the question" },
                  type: { type: Type.STRING, description: "Form input type: 'text' or 'boolean' or 'select'" },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Options array if type is 'select'"
                  },
                  placeholder: { type: Type.STRING, description: "Short input placeholder hint" },
                  description: { type: Type.STRING, description: "Detailed explanation to help the seller answer correctly" },
                  proofRequired: { type: Type.STRING, description: "Detailed description of supporting document file required to be uploaded as proof for this question (e.g. utility bills, authorization letters, factory contracts)" }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini.");
    }

    const resultJson = JSON.parse(resultText.trim());
    recordUsage(req);
    return res.json(resultJson);

  } catch (error: any) {
    console.error("Error analyzing email with Gemini:", error);
    return res.status(500).json({
      details: error.message
    });
  }
});

// 1b. Analyze Rejection Endpoint
app.post("/api/analyze-rejection", async (req, res) => {
  const { previousPoa, rejectionEmail } = req.body;
  if (!previousPoa || previousPoa.trim() === "" || !rejectionEmail || rejectionEmail.trim() === "") {
    return res.status(400).json({ error: "原提交的 POA 及亚马逊拒信内容不能为空。" });
  }

  try {
    const ai = getGeminiClient();

    const systemInstruction = `
You are an expert Amazon Appeal Consultant. Your goal is to analyze the seller's previously submitted Plan of Action (POA) and the subsequent rejection email/notification from Amazon Seller Performance.
Strictly categorize the violation into one of the following standard types:
- "Account Association" (关联账号)
- "IP Infringement" (侵权)
- "Review Manipulation" (刷单/操纵评论)
- "Product Authenticity" (产品真实性/仿品/二手当新品)
- "Section 3 / Code of Conduct" (商业行为/销售限制/欺诈行为)
- "Velocity Limit" (销量激增)
- "Other" (其他违规)

You must analyze the gap between the submitted POA and the rejection email. Identify exactly what Amazon found insufficient (e.g. root cause not detailed enough, lack of proof invoices, lack of specific preventive measures, etc.).
Then, output a tailored set of 3 to 5 questionnaire questions in Chinese that are critical to collecting the missing evidence or explanations needed to address the gaps identified by Amazon.
Ensure the questionnaire questions are in Chinese, highly professional, with complete explanations, descriptions, and lists of "proof materials required" (支持性证据证明材料).
The final output must be valid JSON conforming to the defined schema. Use "gemini-3.5-flash" for this task.
`;

    const prompt = `
Previously Submitted Plan of Action (POA):
"""
${previousPoa}
"""

Amazon's Latest Rejection Email:
"""
${rejectionEmail}
"""

Please analyze the rejection grounds and output the gap analysis and follow-up questionnaire.
`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["violationType", "violationTypeZh", "summary", "suggestedCaseTitle", "riskLevel", "evidenceQuestions"],
          properties: {
            violationType: {
              type: Type.STRING,
              description: "The primary standard English classification: 'Account Association', 'IP Infringement', 'Review Manipulation', 'Product Authenticity', 'Section 3 / Code of Conduct', 'Velocity Limit', or 'Other'"
            },
            violationTypeZh: {
              type: Type.STRING,
              description: "The corresponding Chinese classification name"
            },
            summary: {
              type: Type.STRING,
              description: "A comprehensive summary in Chinese detailing why Amazon rejected the previous POA, what sections are weak, and what improvements/materials are needed."
            },
            suggestedCaseTitle: {
              type: Type.STRING,
              description: "Suggested professional title for this appeal refinement case."
            },
            riskLevel: {
              type: Type.STRING,
              description: "Appeal risk level: 'High' | 'Medium' | 'Low'"
            },
            evidenceQuestions: {
              type: Type.ARRAY,
              description: "Tailored evidence collection questions targeting the gaps identified in Amazon's rejection (3 to 5 questions)",
              items: {
                type: Type.OBJECT,
                required: ["id", "label", "type", "placeholder", "description", "proofRequired"],
                properties: {
                  id: { type: Type.STRING, description: "e.g., rq1, rq2, rq3" },
                  label: { type: Type.STRING, description: "Chinese label of the question" },
                  type: { type: Type.STRING, description: "Form input type: 'text' or 'boolean' or 'select'" },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Options array if type is 'select'"
                  },
                  placeholder: { type: Type.STRING, description: "Short input placeholder hint" },
                  description: { type: Type.STRING, description: "Detailed explanation to help the seller answer correctly" },
                  proofRequired: { type: Type.STRING, description: "Detailed description of supporting document file required to be uploaded as proof for this question" }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini.");
    }

    const resultJson = JSON.parse(resultText.trim());
    recordUsage(req);
    return res.json(resultJson);

  } catch (error: any) {
    console.error("Error analyzing rejection with Gemini:", error);
    return res.status(500).json({
      error: "AI 拒信解析失败，请检查网络或提供的内容。",
      details: error.message
    });
  }
});

/**
 * Helper to clean any leaked Chinese characters or parenthetical translations from the English PoA.
 */
function cleanChineseFromEnglishPoa(text: string): string {
  if (!text) return text;
  
  // 1. Remove parenthesized text that contains Chinese characters (e.g. (缺少配件及英文说明书), （中文说明）)
  let cleaned = text.replace(/[\(\uff08][^\)\uff09]*[\u4e00-\u9fa5]+[^\)\uff09]*[\)\uff09]/g, "");

  // 2. Remove any remaining Chinese characters (in case there are standalone Chinese characters)
  cleaned = cleaned.replace(/[\u4e00-\u9fa5]+/g, "");

  // 3. Clean up formatting artifacts caused by the removal
  cleaned = cleaned.replace(/\s+\:/g, ":");
  cleaned = cleaned.replace(/\s+\./g, ".");
  cleaned = cleaned.replace(/\s+,/g, ",");
  cleaned = cleaned.replace(/\s+\?/g, "?");
  cleaned = cleaned.replace(/ +/g, " ");

  // 4. Remove generic signature placeholder names (like "Customer Compliance Team", "[Your Store Name]") at the end of the PoA
  cleaned = cleaned.replace(/(Sincerely,\s*(?:the\s+)?Customer\s+Compliance\s+Team\b|Sincerely,\s*\[Your\s+Company\s+Name\]|Sincerely,\s*\[Your\s+Store\s+Name\]|Sincerely,\s*\[Your\s+Store\s+Name\s*\/\s*Company\s+Name\])/gi, "Sincerely,");
  cleaned = cleaned.replace(/\bCustomer\s+Compliance\s+Team\s*$/gi, "");

  return cleaned.trim();
}

// 2. Generate PoA Endpoint
app.post("/api/generate-poa", async (req, res) => {
  const { emailText, violationType, answers, additionalNotes, expertAdjustments } = req.body;

  if (!emailText) {
    return res.status(400).json({ error: "违规邮件及基本信息缺失，无法生成 PoA。" });
  }

  try {
    const ai = getGeminiClient();

    // Look up matching reference cases (up to 5 latest)
    const matchingCases = cachedCases
      .filter(c => c.type === violationType)
      .slice(-5)
      .reverse();

    let caseContext = "";
    if (matchingCases.length > 0) {
      caseContext = `
=========================================
Here are ${matchingCases.length} successfully appealed reference cases of the type "${violationType}". 
Learn from their argumentative logic, structural style, and corrective/preventive action patterns, and adapt them to draft a high-passing appeal letter:

` + matchingCases.map((c, i) => `
Reference Case #${i + 1}: ${c.title}
- Root Cause Analysis: ${c.rootCause}
- Completed Corrective Actions: ${c.correctiveActions.join("; ")}
- Future Preventive Measures: ${c.preventiveMeasures.join("; ")}
`).join("\n") + "\n=========================================\n";
    }

    const systemInstruction = `
You are a veteran Amazon appeal expert writing a formal Plan of Action (PoA) in response to Amazon's Seller Performance team.

CRITICAL RULE: The generated "poaMarkdown" MUST NOT contain any Chinese characters (中文汉字). Every single word, header, description, and list item in "poaMarkdown" must be written in English. Translate any Chinese inputs (such as the seller's answers or reference cases) fully into English.

Absolute Cleanliness: You must never write parentheses containing Chinese text next to English terms, e.g. DO NOT write "Missing English Manuals (缺少说明书)" or "ROOT CAUSE (根本原因)", write ONLY "Missing English Manuals" or "ROOT CAUSE".

A successful Amazon PoA must be highly structured, logical, objective, sincere, and actionable. It MUST cover the three pillars:
1. WHAT WAS THE ROOT CAUSE? (Be extremely specific, take responsibility, explain exactly why it happened without making excuses, e.g. operational gaps, lack of double-verification, untrained staff, supplier audit failures, shared network trace).
2. WHAT HAVE YOU DONE TO FIX IT? (Detail concrete, immediate steps already fully completed, e.g. deleted Listings, disposed stock, terminated service agreements, audited orders, obtained formal supplier agreements).
3. WHAT WILL YOU DO TO PREVENT IT FROM HAPPENING AGAIN? (Detail long-term system modifications, e.g. robust IP search workflows, brand verification, isolated network deployment, ongoing staff training, and official tools like Amazon Vine).

Additional Context Provided:
- Violation Type: ${violationType}
- Seller's Questionnaire Answers: ${JSON.stringify(answers)}
- Seller's Additional Notes: ${additionalNotes || "None"}
- Expert/Service Provider Adjustments: ${expertAdjustments || "None"}

${caseContext}

Instructions:
- Write the final PoA strictly and entirely in English (which is the required language for Amazon's Seller Performance team). Under no circumstances should any Chinese translations, annotations, or inline explanations in parentheses (such as "(问题根本原因)" or "(包装破损)") be included in the "poaMarkdown" text. The final text must be 100% pure professional English.
- Do not include any title, header, or metadata block at the top of the PoA, such as "# PLAN OF ACTION (PoA)", "To: Amazon Seller Performance Team", "Regarding:...", or "Date:...". Start the PoA content directly with the salutation: "Dear Amazon Seller Performance Team,".
- Use a highly clear structure with bold headers, bullet points, and inventory numbers.
- Do not use generic filler words. Be precise, citing the relevant numbers, ASINs, dates, or specific documents mentioned in the seller's answers.
- Incorporate any "Expert/Service Provider Adjustments" directly to fine-tune the tone or highlight specific defense points.
- Do not include any generic signature lines or placeholder team/company names (such as "Customer Compliance Team", "Sincerely, Customer Compliance Team", "[Your Company Name]", or "[Your Store Name]") at the end of the PoA. The PoA should end with a polite closing like "Sincerely," (with no name following it) or simply end the text after the final paragraph/sentence.
- Output a valid JSON with three fields:
  1. "poaMarkdown": The full, ready-to-use professional Plan of Action in English formatted in rich Markdown.
  2. "poaMarkdownZh": The complete, high-quality Chinese translation of the generated English PoA in "poaMarkdown". It must preserve the exact same structure, headings, bold text, lists, and spacing as the English version, so that non-English speakers can easily review it or output it. Translate the opening salutation (e.g. "Dear Amazon Seller Performance Team,") to a professional Chinese equivalent like "尊敬的亚马逊卖家绩效团队：" and the closing (e.g. "Sincerely,") to "此致敬礼 / 敬上".
  3. "expertAuditSuggestions": A bulleted list (in Chinese) of tips from our service provider team for the seller on how to submit this PoA successfully (e.g. file size, invoice match, submitting method).
`;

    const prompt = `
Please draft a professional Plan of Action (PoA) in "poaMarkdown" and audit recommendations in "expertAuditSuggestions".
CRITICAL REMINDER: The "poaMarkdown" text must be 100% strictly in English. Do not include any Chinese characters (中文汉字) or parentheses with Chinese translations (e.g. do not write things like "(根本原因分析)" or "(增值税发票)").
`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["poaMarkdown", "poaMarkdownZh", "expertAuditSuggestions"],
          properties: {
            poaMarkdown: {
              type: Type.STRING,
              description: "The complete, ready-to-copy PoA document in English using professional Markdown formatting."
            },
            poaMarkdownZh: {
              type: Type.STRING,
              description: "The complete translation of the English PoA document in Chinese, preserving the exact same layout and formatting, for the seller's reference."
            },
            expertAuditSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A bulleted list in Chinese containing expert advisory notes, verification checklists, and strategic tips."
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini.");
    }

    const resultJson = JSON.parse(resultText.trim());
    
    if (resultJson.poaMarkdown) {
      resultJson.poaMarkdown = cleanChineseFromEnglishPoa(resultJson.poaMarkdown);
    }

    recordUsage(req, violationType);
    return res.json(resultJson);

  } catch (error: any) {
    console.error("Error generating PoA with Gemini:", error);
    return res.status(500).json({
      error: "AI 申诉信 (PoA) 生成失败，请稍后重试。",
      details: error.message
    });
  }
});

// 2b. Refine PoA Endpoint
app.post("/api/refine-poa", async (req, res) => {
  const { previousPoa, rejectionEmail, violationType, answers, expertAdjustments } = req.body;

  if (!previousPoa || !rejectionEmail) {
    return res.status(400).json({ error: "原提交的 POA 及亚马逊拒信内容缺失，无法进行完善。" });
  }

  try {
    const ai = getGeminiClient();

    const systemInstruction = `
You are a veteran Amazon appeal expert writing a refined, corrected Plan of Action (PoA) in response to Amazon's Seller Performance team rejecting a previous submission.

CRITICAL RULE: The generated "poaMarkdown" MUST NOT contain any Chinese characters (中文汉字). Every single word, header, description, and list item in "poaMarkdown" must be written in English. Translate any Chinese inputs (such as the seller's answers) fully into English.

Absolute Cleanliness: You must never write parentheses containing Chinese text next to English terms, e.g. DO NOT write "Missing English Manuals (缺少说明书)" or "ROOT CAUSE (根本原因)", write ONLY "Missing English Manuals" or "ROOT CAUSE".

Your goal is to take the "previousPoa", analyze the gaps highlighted in "rejectionEmail", and incorporate the seller's new "answers" to rewrite and perfect the POA.
- Address the rejection points directly and with higher specificity.
- Keep the good parts of the previous POA, but enhance the parts that were rejected (e.g., provide deeper root cause analysis, more specific corrective actions, or more systemic preventive measures).
- Cite any new documents or numbers provided in the answers.

Do not include any title, header, or metadata block at the top of the PoA. Start the PoA content directly with the salutation: "Dear Amazon Seller Performance Team,".
The PoA should end with a polite closing like "Sincerely," (with no name following it).
Output a valid JSON with three fields:
  1. "poaMarkdown": The refined Plan of Action in English formatted in rich Markdown.
  2. "poaMarkdownZh": The complete, high-quality Chinese translation of the refined English PoA in "poaMarkdown". It must preserve the exact same structure, headings, bold text, lists, and spacing as the English version. Translate the opening salutation (e.g. "Dear Amazon Seller Performance Team,") to a professional Chinese equivalent like "尊敬的亚马逊卖家绩效团队：" and the closing (e.g. "Sincerely,") to "此致敬礼 / 敬上".
  3. "expertAuditSuggestions": A bulleted list (in Chinese) of tips from our service provider team for the seller on how to submit this refined PoA successfully.
`;

    const prompt = `
Previously Submitted Plan of Action (POA):
"""
${previousPoa}
"""

Amazon's Latest Rejection Email:
"""
${rejectionEmail}
"""

Seller's Answers to Rejection Gaps:
${JSON.stringify(answers)}

Expert Adjustments / Service Provider Guidance:
${expertAdjustments || "None"}

Please generate a revised, refined, and significantly stronger Plan of Action (POA) in English.
`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["poaMarkdown", "poaMarkdownZh", "expertAuditSuggestions"],
          properties: {
            poaMarkdown: {
              type: Type.STRING,
              description: "The refined, complete, ready-to-copy PoA document in English using professional Markdown formatting."
            },
            poaMarkdownZh: {
              type: Type.STRING,
              description: "The complete translation of the English PoA document in Chinese, preserving the exact same layout and formatting, for the seller's reference."
            },
            expertAuditSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A bulleted list in Chinese containing expert advisory notes, verification checklists, and strategic tips."
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini.");
    }

    const resultJson = JSON.parse(resultText.trim());
    
    if (resultJson.poaMarkdown) {
      resultJson.poaMarkdown = cleanChineseFromEnglishPoa(resultJson.poaMarkdown);
    }

    recordUsage(req, violationType, true);
    return res.json(resultJson);

  } catch (error: any) {
    console.error("Error refining PoA with Gemini:", error);
    return res.status(500).json({
      error: "AI 申诉信 (PoA) 完善失败，请稍后重试。",
      details: error.message
    });
  }
});

const ADMIN_PASSWORD = "jie32jiE**";

function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authPass = req.headers["x-admin-password"] || req.query.admin_password;
  if (authPass !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "未授权：密码错误或已失效。" });
  }
  next();
}

app.use("/api/success-cases", adminAuth);
app.use("/api/parse-case-doc", adminAuth);
app.use("/api/usage-analytics", adminAuth);
app.use("/api/video-verification-questions", (req, res, next) => {
  if (req.method === "GET") return next();
  return adminAuth(req, res, next);
});

app.get("/api/usage-analytics", (req, res) => {
  const requestedDays = Number(req.query.days);
  const days = Number.isInteger(requestedDays) ? Math.min(Math.max(requestedDays, 7), 90) : 14;
  return res.json(getUsageAnalytics(days));
});

// 3. Success Cases CRUD Endpoints
app.get("/api/success-cases", (req, res) => {
  return res.json([...cachedCases].reverse());
});

// Add Case
app.post("/api/success-cases", (req, res) => {
  const { title, type, rootCause, correctiveActions, preventiveMeasures, requiredDocuments } = req.body;
  if (!title || !type || !rootCause) {
    return res.status(400).json({ error: "标题、类型和根本原因为必填项。" });
  }

  const newCase: SuccessCase = {
    id: `case-${Date.now()}`,
    title,
    type,
    rootCause,
    correctiveActions: Array.isArray(correctiveActions) ? correctiveActions : [],
    preventiveMeasures: Array.isArray(preventiveMeasures) ? preventiveMeasures : [],
    requiredDocuments: Array.isArray(requiredDocuments) ? requiredDocuments : []
  };

  cachedCases.push(newCase);
  saveSuccessCases();
  return res.json({ success: true, case: newCase });
});

// Edit Case
app.put("/api/success-cases/:id", (req, res) => {
  const { id } = req.params;
  const { title, type, rootCause, correctiveActions, preventiveMeasures, requiredDocuments } = req.body;

  const caseIndex = cachedCases.findIndex(c => c.id === id);
  if (caseIndex === -1) {
    return res.status(404).json({ error: "未找到指定的案例。" });
  }

  cachedCases[caseIndex] = {
    ...cachedCases[caseIndex],
    title: title || cachedCases[caseIndex].title,
    type: type || cachedCases[caseIndex].type,
    rootCause: rootCause || cachedCases[caseIndex].rootCause,
    correctiveActions: Array.isArray(correctiveActions) ? correctiveActions : cachedCases[caseIndex].correctiveActions,
    preventiveMeasures: Array.isArray(preventiveMeasures) ? preventiveMeasures : cachedCases[caseIndex].preventiveMeasures,
    requiredDocuments: Array.isArray(requiredDocuments) ? requiredDocuments : cachedCases[caseIndex].requiredDocuments
  };

  saveSuccessCases();
  return res.json({ success: true, case: cachedCases[caseIndex] });
});

// Delete Case
app.delete("/api/success-cases/:id", (req, res) => {
  const { id } = req.params;
  const caseIndex = cachedCases.findIndex(c => c.id === id);
  if (caseIndex === -1) {
    return res.status(404).json({ error: "未找到指定的案例。" });
  }

  cachedCases.splice(caseIndex, 1);
  saveSuccessCases();
  return res.json({ success: true });
});

// 3b. Video Verification Question CRUD Endpoints
app.get("/api/video-verification-questions", (req, res) => {
  return res.json(cachedVideoQuestions);
});

app.post("/api/video-verification-questions", (req, res) => {
  const question = normalizeVideoQuestion(req.body, `vq-${Date.now()}`);
  if (!question.question) {
    return res.status(400).json({ error: "问题内容不能为空。" });
  }

  cachedVideoQuestions.push(question);
  saveVideoVerificationQuestions();
  return res.json({ success: true, question });
});

app.put("/api/video-verification-questions/:id", (req, res) => {
  const { id } = req.params;
  const questionIndex = cachedVideoQuestions.findIndex((item) => item.id === id);
  if (questionIndex === -1) {
    return res.status(404).json({ error: "未找到指定的视频验证问题。" });
  }

  const question = normalizeVideoQuestion({ ...cachedVideoQuestions[questionIndex], ...req.body, id });
  if (!question.question) {
    return res.status(400).json({ error: "问题内容不能为空。" });
  }

  cachedVideoQuestions[questionIndex] = question;
  saveVideoVerificationQuestions();
  return res.json({ success: true, question });
});

app.delete("/api/video-verification-questions/:id", (req, res) => {
  const { id } = req.params;
  const questionIndex = cachedVideoQuestions.findIndex((item) => item.id === id);
  if (questionIndex === -1) {
    return res.status(404).json({ error: "未找到指定的视频验证问题。" });
  }

  cachedVideoQuestions.splice(questionIndex, 1);
  saveVideoVerificationQuestions();
  return res.json({ success: true });
});

// AI Case Document Parser Endpoint
app.post("/api/parse-case-doc", async (req, res) => {
  const { docText } = req.body;
  if (!docText || docText.trim() === "") {
    return res.status(400).json({ error: "案例文档内容不能为空。" });
  }

  try {
    const ai = getGeminiClient();

    const systemInstruction = `
You are an expert Amazon Appeal Consultant. Your goal is to analyze the user's successfully appealed Plan of Action (POA) or case document and extract structured fields in high-fidelity JSON.
The violation type must be strictly categorized into one of:
- "Account Association" (关联账号)
- "IP Infringement" (侵权)
- "Review Manipulation" (刷单/操纵评论)
- "Product Authenticity" (产品真实性/仿品/二手当新品)
- "Section 3 / Code of Conduct" (商业行为/销售限制/欺诈行为)
- "Velocity Limit" (销量激增)
- "Other" (其他违规)

You must extract the core points in Chinese (简体中文).
The JSON output must conform to the defined schema. Use "gemini-3.5-flash" for this task.
`;

    const prompt = `
Please analyze the following successful appeal document and extract the structured components:
"""
${docText}
"""
`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "type", "rootCause", "correctiveActions", "preventiveMeasures", "requiredDocuments"],
          properties: {
            title: {
              type: Type.STRING,
              description: "A concise and professional Chinese title for this appeal case, e.g., '关联销售销售限制申诉 (Section 3 Account Association)' or similar."
            },
            type: {
              type: Type.STRING,
              description: "The primary standard English classification from the list: 'Account Association', 'IP Infringement', 'Review Manipulation', 'Product Authenticity', 'Section 3 / Code of Conduct', 'Velocity Limit', or 'Other'"
            },
            rootCause: {
              type: Type.STRING,
              description: "A clear summary of the root cause in Chinese (1-3 sentences)."
            },
            correctiveActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of immediate corrective actions taken (in Chinese, clear bullet points)."
            },
            preventiveMeasures: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of future preventive/preventative measures implemented (in Chinese, clear bullet points)."
            },
            requiredDocuments: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Proof documents the seller should upload for this appeal, such as business license, legal representative ID, invoices, purchase contracts, authorization letters, logistics documents, or notarized documents. Return an empty array if no document is needed."
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini.");
    }

    const resultJson = JSON.parse(resultText.trim());
    return res.json(resultJson);

  } catch (error: any) {
    console.error("Error parsing case document with Gemini:", error);
    return res.status(500).json({
      error: "AI 案例文档解析失败，请检查网络或提供的内容。",
      details: error.message
    });
  }
});

// 4. Submit manual audit request to DingTalk
app.post("/api/submit-audit", async (req, res) => {
  const { contact, poaText, violationType, emailText } = req.body;

  if (!contact || !contact.trim()) {
    return res.status(400).json({ error: "联系方式不能为空。" });
  }

  try {
    const secret = "SECd99ded1fe3b26879ddd01bf75f22c99b572f4abdeb342a98844530aa48a5a5ca";
    const webhookUrl = "https://oapi.dingtalk.com/robot/send?access_token=2470a6241b76052f5475f3025e35695b4de8749a60ac10539876e4b2d5136674";
    
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = crypto
      .createHmac("sha256", secret)
      .update(stringToSign)
      .digest("base64");
    
    const signedUrl = `${webhookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;

    // Prepare DingTalk Markdown message content
    const timeString = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    
    // Truncate text if it's too long to prevent exceeding DingTalk message size limits
    const maxPoaLength = 1500;
    const truncatedPoa = poaText && poaText.length > maxPoaLength
      ? `${poaText.substring(0, maxPoaLength)}\n\n...(内容过长，已被截断)`
      : poaText || "未提供POA草稿";

    const maxEmailLength = 1000;
    const truncatedEmail = emailText && emailText.length > maxEmailLength
      ? `${emailText.substring(0, maxEmailLength)}\n\n...(内容过长，已被截断)`
      : emailText || "未提供原始邮件/申诉背景";

    const messageData = {
      msgtype: "markdown",
      markdown: {
        title: "新的人工审核申诉请求",
        text: `### 🚀 收到亚马逊申诉人工审核请求

**📌 基本信息**
- **申请时间**: ${timeString}
- **违规类型**: ${violationType || "未知类型"}
- **联系方式**: ${contact}

---

**📝 POA 申诉信初稿预览**
\`\`\`markdown
${truncatedPoa}
\`\`\`

---

**📧 原始业绩通知 / 诊断背景**
\`\`\`text
${truncatedEmail}
\`\`\`
`
      }
    };

    const response = await fetch(signedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
    });

    if (!response.ok) {
      throw new Error(`DingTalk response not OK: ${response.statusText}`);
    }

    const data: any = await response.json();
    if (data.errcode !== 0) {
      console.error("[DingTalk Error]:", data);
      throw new Error(`钉钉机器人推送失败: ${data.errmsg}`);
    }

    return res.json({ success: true, message: "人工审核请求已成功发送。" });
  } catch (error: any) {
    console.error("Error submitting manual audit request:", error);
    return res.status(500).json({
      error: "无法发送人工审核申请，请检查网络或稍后重试。",
      details: error.message,
    });
  }
});

// Vite & Static file handling
async function startServer() {
  // Load success cases into memory cache from JSON file
  loadSuccessCases();
  loadVideoVerificationQuestions();
  loadUsageAnalytics();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Amazon Appeal AI Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
