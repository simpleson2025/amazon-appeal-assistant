import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

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

// Successful Case Database for AI Reference (and for display in the UI)
const SUCCESS_CASES = [
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

// 1. Analyze Email Endpoint
app.post("/api/analyze-email", async (req, res) => {
  const { emailText } = req.body;
  if (!emailText || emailText.trim() === "") {
    return res.status(400).json({ error: "违规邮件内容不能为空。" });
  }

  try {
    const ai = getGeminiClient();

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
For example:
- For Account Association: ask about VPS usage, past closed shops, third-party permissions, utility bill readiness.
- For Review Manipulation: ask about specific ASIN orders, third-party reviewers/promoters, refund transactions, Vine usage.
- For IP Infringement: ask about the patented keyword or design, letters of authorization, retraction progress, stock disposal.
- For Product Authenticity: ask about invoices from suppliers, packaging issues, logistics chains.

Ensure the questionnaire questions are in Chinese, highly professional, with complete explanations, descriptions, and lists of "proof materials required" (支持性证据证明材料).
The final output must be valid JSON conforming to the defined schema. Use "gemini-3.5-flash" for this task.
`;

    const prompt = `Please analyze this Amazon seller notification email:\n\n${emailText}\n\nProvide the analysis in structured JSON representation.`;

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

    // Look up reference case if matching
    const matchingCase = SUCCESS_CASES.find(c => c.type === violationType);
    const caseContext = matchingCase 
      ? `
Reference Successful Case Context for ${violationType}:
- Root Causes identified in successful case: ${matchingCase.rootCause}
- Core Corrective Actions in successful case: ${matchingCase.correctiveActions.join("; ")}
- Long-term Preventive Measures in successful case: ${matchingCase.preventiveMeasures.join("; ")}
` 
      : "";

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

    return res.json(resultJson);

  } catch (error: any) {
    console.error("Error refining PoA with Gemini:", error);
    return res.status(500).json({
      error: "AI 申诉信 (PoA) 完善失败，请稍后重试。",
      details: error.message
    });
  }
});

// 3. Get Reference Success Cases Endpoint
app.get("/api/success-cases", (req, res) => {
  return res.json(SUCCESS_CASES);
});

// Vite & Static file handling
async function startServer() {
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
