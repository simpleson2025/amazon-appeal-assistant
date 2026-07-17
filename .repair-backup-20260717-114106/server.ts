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
}

let cachedCases: SuccessCase[] = [];
const CASES_FILE_PATH = path.join(process.cwd(), "data", "success-cases.json");

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
          title: "�唾����桅��桅��嗥𤚗霂� (Section 3 Account Association)",
          type: "Account Association",
          rootCause: "�硋振�惩銁�砍�WiFi蝵𤑳�銝讠蒈敶𨰻���瘚讛��沒tale cookies�芣���紡�港�撌脰◤蝳�揭�瑚漣�笔��𥪜��䈑��𡝗糓撠��韐血噡���蝏嗘�蝳餉��睃極��葵鈭粹�蝞梧�撖潸稲餈鮋�撠�噡��",
          correctiveActions: [
            "敶餃��埝䰻���匧��磰挽憭��蝵𤑳�嚗峕鱏撘�銝滚��刻��伐�",
            "�日�撟嗆��斗��厩洵銝㗇䲮蝳餉��睃極��誨餈鞱𨯫韐行���葩�嗅�韐血噡���嚗�",
            "�典僕����鰵銝梶瑪蝵𤑳�嚗����𡠺鈭侵P嚗劐��函蔡�滢�霈曉�嚗�蝠摨閙�蝛箸�閫�膥Cookies嚗�",
            "�渡�撟嗆�靘𥕦��貉𨯫銝𡁏��扼��捐撣血��䔶�蝻渲晶韐血�霂��蝵𤑳��𣬚���㴓憓�𡠺蝡卝��"
          ],
          preventiveMeasures: [
            "�刻�銝交聢��𡠺蝡贝��亥����銝梶�銝梶瑪銝𤘪㦤銝枏�嚗䔶艇蝳��撌乩�霈曉��餃��𤾸蝱嚗�",
            "摰𡁏��湔鰵撟嗅恣霈﹖eller Central��鍂�瑁挪�格��琜�User Permissions嚗㚁�",
            "撱箇��砍虬�箏�鈭箏��餉扇銝𡒊�蝏𡏭挪�桃蒾�滚��批�雿梶頂��"
          ],
          requiredDocuments: [
            "�砍虬�乩��抒� (擃䀹�敶抵𠧧�急�隞�)",
            "�砍虬蝵𤑳�摰賢蒂摰㕑����銝舘��毺撈韐寡揭��/�𤑳巨",
            "瘜蓥犖隞�”�𠹺蜓閬���乩犖�条�頨思遢霂�/�斤��屸𢒰憭滚㫲隞�",
            "�拍��𧼮��臬�銝舘挽憭���祉��批ㄟ��/靽嘥��讛悅"
          ]
        },
        {
          id: "case-brushing",
          title: "�𡁜�鈭斗�/�滨熊霂�捏�唾� (Review Manipulation / Brushing)",
          type: "Review Manipulation",
          rootCause: "�硋振銝箸���鰵����㵪���膛鈭��銝㮖����憭𤥁�閫�綫撟踵��∪�嚗��瘚贝��箸�嚗㚁��朞�擃䀹�����唳�餈肽�蝝Ｚ�嚗諹◤鈭𡁻帕�𦠜�瘚见枂銋啣振韐行���葉撘�虜銝见��諹�霈箸�蝥萸��",
          correctiveActions: [
            "蝏�迫銝擧��㕑�閫��霂�㦤����綫撟踵��∪����雿𨅯�霈殷�",
            "撖孵�韐西恥�訫�撅閗蕭皞臬恣霈∴�蝑𥟇䰻�箸��㕑�閫�恥�𨰻��SIN嚗���箏�敶勗�����𤏪�",
            "銝餃𢆡�睲�撽祇�𦠜�鈭斗�鈭衤僭摰貂D���霂���∪��𠉛頂�孵����甈曉鐯霂��撟嗆�霂瑟伃�噼�鈭偦��笔�霂�遠嚗�",
            "皜��銝滚�閫��銋啣振蝝Ｚ��桐辣璅⊥踎��"
          ],
          preventiveMeasures: [
            "隞�蝙�其�撽祇�𠰴��孵極�瑁�銵峕鰵��綫撟蹂�瘚贝�嚗��Amazon Vine霈∪���僭摰嗉䌊�函揣霂�極�瘀�嚗�",
            "撖孵�雿栞��乩犖�䁅�銵䔶�撽祇�𨳍�𠹺僭摰嗉�霈箄�銝箏��辷�Buyer Review Policy嚗剹�讠�����������笔畺霈哨�",
            "撱箇�������蝔賣䰻�箏�嚗䔶艇蝳�遙雿訫耦撘讐�蝡坔�蝘����兮餈𠉛緵瘣餃𢆡��"
          ],
          requiredDocuments: [
            "餈肽�瘚贝�霈Ｗ�鈭斗��芸㦛 (��鉄銋啣振ID�𡃏�甈曉鐯霂�)",
            "銝𡒊洵銝㗇䲮瘚贝��滚𦛚��/瘚贝�銝凋����憭抵扇敶閙�����讛悅",
            "隞𦒘�撽祇�𠰴�摰嗡葉敹��頧賜��堒蔣��SIN霈Ｗ��亥”",
            "������餈鞱𨯫蝞∠�閫��銝𤾸�撌交�憭��𡁜�銋�"
          ]
        },
        {
          id: "case-infringement",
          title: "�亥�鈭扳�靘菜��唾� (Intellectual Property Infringement)",
          type: "IP Infringement",
          rootCause: "��揚�ａ��刻�銵屸�匧��塚�隞��撖嫣�憭𤥁��峕瓷�㕑�銵峕楛摨衣�霈曇恣銝枏⏚���������蝝ｇ�撖潸稲���桃�銝�甈曄���鈭批�憭𤥁�蝏𤘪��賢�蝡𧼮�憭𤥁�霈曇恣銝枏⏚��凒����𤥁��銁Listing銝剛秤�其�蝡𧼮��������株�嚗剹��",
          correctiveActions: [
            "蝡见朖銝𧢲沲撟嗆偶銋���方◤�閗���isting嚗�𡢢�墧�撠勗𧑐��瘥�BA隞枏�銝剜��厩��詨�摨枏�嚗�",
            "�𠉛頂��⏚鈭箏�撣�稲隞亥��𡁏��𧶏�閫���舐眏鈭𦒘�摨娪曎憭梯秤撖潸稲��秤隡歹�撟嗡蜓�冽��箇�瘚𤾸�閫��撖餅��方�嚗㇌etraction嚗㚁�",
            "撖嫣�摨𥪜���揮皞鞾��啣恣霈∴�閬���嗆�靘𥟇�����汿��"
          ],
          preventiveMeasures: [
            "��揚蝡航氜摰嫰�𨅯�鈭箸瓲撉屸�匧�瘚���嘅�瘥𤩺狡�啣�敹�◆�朞�銝㮖������/甈扳散銝枏⏚撅�璉�蝝ｇ�撟嗅枂�瑟�蝝Ｘ𥁒�𠺪�",
            "�券�匧�敶訫�蝟餌��峕兛�竏isting�嗆挾嚗�笆���㗇��𠰴��䔶��匧�霂滩�銵諹䌊�典��喲睸霂齿瓲撖對��𦦵�頩剔�摨衣緵鞊∴�",
            "銝擧迤閫����憭�䌊銝餃�������銋衣�憭批�靘𥕦���倌霈Ｗ�閫��霂���䎚��"
          ],
          requiredDocuments: [
            "甇��皞𣂼仍靘𥕦������揚�𤑳巨 (��雿梶緵鋡急�霂匧��������𦠜㺭��)",
            "靘𥕦���������⏚鈭箇����銋� (Letter of Authorization) �𤥁�韐折曎��",
            "銝擧��拐犖敺见�/隞�”瘝罸�𡁏伃霂厩��諹圾�讛悅�㚚��甈曉鐯霂�",
            "FBA摨枏���隞�/��瘥�⏛�暹��𣳇膄Listing����唳⏛��"
          ]
        },
        {
          id: "case-authenticity",
          title: "鈭批��笔��抒𤚗霂� (Product Authenticity / Inauthentic)",
          type: "Product Authenticity",
          rootCause: "�牐漣���鋆�◤�讠𪊶��葉�望���斐蝻箏仃撖潸稲銋啣振�嗅�韐批�韐函�銝算�靝��𦥑�脲��靝憚�罱�嘅��硋�摰嗅�韐扳�銝�1688�孵�撣�㦤�芸��瑕��潛�銝梶鍂�𤑳巨嚗峕�瘜閙�靘𥕦�閫�曎�∪鐯霂���",
          correctiveActions: [
            "�湔揢韐券��游末������蝞梧��㰘��脫��方��𦠜部瘜∠爾嚗㚁�銝交聢韐冽����𧼮�摮矋�",
            "�穃𤙴���憭游極��‘撘�甇������潛�銝梶鍂�𤑳巨嚗��蟡其����韐剖�靽⊥�銝𦒘�撽祇�𠰴��箔蜓雿㮖艇�潔��湛�嚗�",
            "�𣂷�靘𥕦�����砍虬靽⊥����鈭扯�韐冽������蒂��揚�����枂韐批����蟡券曎�∴�霂湔�鈭批���100%皞鞱䌊甇��撌亙��煺漣��"
          ],
          preventiveMeasures: [
            "�券��寧眏�湔𦻖�穃��峕䲮�硋�銝�蝥抒鸌蝥衣������韐哨�蝖桐�瘥𤩺活��揚���敺埈迤閫��憸嘥��潛��𤑳巨嚗�僎�匧�敶埝﹝嚗�",
            "�惩撩�乩��滨�鈭峕活璉�撉峕����IQC嚗㚁�撖嫣遙雿閙�����閧鮟��漣����㚚妟摰孵��湔𦻖���硺�摨𥪜��輻�嚗�",
            "�其蜓�曉�霂行�憿萎葉�惩��渲祕摰䂿��脖憚�����紡�峕迤���霂�䲮瘜𨰻��"
          ],
          requiredDocuments: [
            "�賢振甇��憓𧼮�潛�銝梶鍂�𤑳巨 (撘�蟡冽𠯫�罸��刻◤撠��銋见�嚗䔶��砍仍銝𦒘�撽祇�𠰴��唬���)",
            "皞𣂼仍撌亙����鈭扯�韐刻�銋� / �乩��抒�",
            "����寞迤撘誩��峕���髡�碶�蝥抒�����迤撘誯��桀���",
            "靘𥕦���枂韐批����韐抒�瘚���訫�鋆�拳��"
          ]
        }
      ];湧��桃�銝�甈曄���鈭批�憭𤥁�蝏𤘪��賢�蝡𧼮�憭𤥁�霈曇恣銝枏⏚��凒����𤥁��銁Listing銝剛秤�其�蝡𧼮��������株�嚗剹��",
          correctiveActions: [
            "蝡见朖銝𧢲沲撟嗆偶銋���方◤�閗���isting嚗�𡢢�墧�撠勗𧑐��瘥�BA隞枏�銝剜��厩��詨�摨枏�嚗�",
            "�𠉛頂��⏚鈭箏�撣�稲隞亥��𡁏��𧶏�閫���舐眏鈭𦒘�摨娪曎憭梯秤撖潸稲��秤隡歹�撟嗡蜓�冽��箇�瘚𤾸�閫��撖餅��方�嚗㇌etraction嚗㚁�",
            "撖嫣�摨𥪜���揮皞鞾��啣恣霈∴�閬���嗆�靘𥟇�����汿��"
          ],
          preventiveMeasures: [
            "��揚蝡航氜摰嫰�𨅯�鈭箸瓲撉屸�匧�瘚���嘅�瘥𤩺狡�啣�敹�◆�朞�銝㮖������/甈扳散銝枏⏚撅�璉�蝝ｇ�撟嗅枂�瑟�蝝Ｘ𥁒�𠺪�",
            "�券�匧�敶訫�蝟餌��峕兛�竏isting�嗆挾嚗�笆���㗇��𠰴��䔶��匧�霂滩�銵諹䌊�典��喲睸霂齿瓲撖對��𦦵�頩剔�摨衣緵鞊∴�",
            "銝擧迤閫����憭�䌊銝餃�������銋衣�憭批�靘𥕦���倌霈Ｗ�閫��霂���䎚��"
          ]
        },
        {
          id: "case-authenticity",
          title: "鈭批��笔��抒𤚗霂� (Product Authenticity / Inauthentic)",
          type: "Product Authenticity",
          rootCause: "�牐漣���鋆�◤�讠𪊶��葉�望���斐蝻箏仃撖潸稲銋啣振�嗅�韐批�韐函�銝算�靝��𦥑�脲��靝憚�罱�嘅��硋�摰嗅�韐扳�銝�1688�孵�撣�㦤�芸��瑕��潛�銝梶鍂�𤑳巨嚗峕�瘜閙�靘𥕦�閫�曎�∪鐯霂���",
          correctiveActions: [
            "�湔揢韐券��游末������蝞梧��㰘��脫��方��𦠜部瘜∠爾嚗㚁�銝交聢韐冽����𧼮�摮矋�",
            "�穃𤙴���憭游極��‘撘�甇������潛�銝梶鍂�𤑳巨嚗��蟡其����韐剖�靽⊥�銝𦒘�撽祇�𠰴��箔蜓雿㮖艇�潔��湛�嚗�",
            "�𣂷�靘𥕦�����砍虬靽⊥����鈭扯�韐冽������蒂��揚�����枂韐批����蟡券曎�∴�霂湔�鈭批���100%皞鞱䌊甇��撌亙��煺漣��"
          ],
          preventiveMeasures: [
            "�券��寧眏�湔𦻖�穃��峕䲮�硋�銝�蝥抒鸌蝥衣������韐哨�蝖桐�瘥𤩺活��揚���敺埈迤閫��憸嘥��潛��𤑳巨嚗�僎�匧�敶埝﹝嚗�",
            "�惩撩�乩��滨�鈭峕活璉�撉峕����IQC嚗㚁�撖嫣遙雿閙�����閧鮟��漣����㚚妟摰孵��湔𦻖���硺�摨𥪜��輻�嚗�",
            "�其蜓�曉�霂行�憿萎葉�惩��渲祕摰䂿��脖憚�����紡�峕迤���霂�䲮瘜𨰻��"
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

// 1. Analyze Email Endpoint
app.post("/api/analyze-email", async (req, res) => {
  const { emailText } = req.body;
  if (!emailText || emailText.trim() === "") {
    return res.status(400).json({ error: "餈肽��桐辣��捆銝滩�銝箇征��" });
  }

  try {
    const ai = getGeminiClient();

    const systemInstruction = `
You are an expert Amazon Appeal Consultant. Your goal is to analyze the seller's suspension or warning email and determine the precise violation details in high-fidelity JSON.
Strictly categorize the violation into one of the following standard types:
- "Account Association" (�唾�韐血噡)
- "IP Infringement" (靘菜�)
- "Review Manipulation" (�瑕�/�滨熊霂�捏)
- "Product Authenticity" (鈭批��笔���/隞踹�/鈭峕�敶𤘪鰵��)
- "Section 3 / Code of Conduct" (���銵䔶蛹/���桅���/甈箄�銵䔶蛹)
- "Velocity Limit" (���𤩺�憓�)
- "Other" (�嗡�餈肽�)

You must output a tailored set of 3 to 5 questionnaire questions that are critical to collecting the evidence needed for generating a professional Plan of Action (PoA) of this type.
For example:
- For Account Association: ask about VPS usage, past closed shops, third-party permissions, utility bill readiness.
- For Review Manipulation: ask about specific ASIN orders, third-party reviewers/promoters, refund transactions, Vine usage.
- For IP Infringement: ask about the patented keyword or design, letters of authorization, retraction progress, stock disposal.
- For Product Authenticity: ask about invoices from suppliers, packaging issues, logistics chains.

Ensure the questionnaire questions are in Chinese, highly professional, with complete explanations, descriptions, and lists of "proof materials required" (�舀��扯��株��擧���).
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
    return res.status(400).json({ error: "���鈭斤� POA �𠹺�撽祇�𦠜�靽∪�摰嫣��賭蛹蝛箝��" });
  }

  try {
    const ai = getGeminiClient();

    const systemInstruction = `
You are an expert Amazon Appeal Consultant. Your goal is to analyze the seller's previously submitted Plan of Action (POA) and the subsequent rejection email/notification from Amazon Seller Performance.
Strictly categorize the violation into one of the following standard types:
- "Account Association" (�唾�韐血噡)
- "IP Infringement" (靘菜�)
- "Review Manipulation" (�瑕�/�滨熊霂�捏)
- "Product Authenticity" (鈭批��笔���/隞踹�/鈭峕�敶𤘪鰵��)
- "Section 3 / Code of Conduct" (���銵䔶蛹/���桅���/甈箄�銵䔶蛹)
- "Velocity Limit" (���𤩺�憓�)
- "Other" (�嗡�餈肽�)

You must analyze the gap between the submitted POA and the rejection email. Identify exactly what Amazon found insufficient (e.g. root cause not detailed enough, lack of proof invoices, lack of specific preventive measures, etc.).
Then, output a tailored set of 3 to 5 questionnaire questions in Chinese that are critical to collecting the missing evidence or explanations needed to address the gaps identified by Amazon.
Ensure the questionnaire questions are in Chinese, highly professional, with complete explanations, descriptions, and lists of "proof materials required" (�舀��扯��株��擧���).
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
      error: "AI �雴縑閫��憭梯揖嚗諹窈璉��亦�蝏𨀣��𣂷����摰嫘��",
      details: error.message
    });
  }
});

/**
 * Helper to clean any leaked Chinese characters or parenthetical translations from the English PoA.
 */
function cleanChineseFromEnglishPoa(text: string): string {
  if (!text) return text;
  
  // 1. Remove parenthesized text that contains Chinese characters (e.g. (蝻箏��滢辣�𡃏㘚��秩�𦒘髡), 嚗�葉��秩�𠬍�)
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
    return res.status(400).json({ error: "餈肽��桐辣�𠰴抅�砌縑�舐撩憭梧��䭾���� PoA��" });
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

CRITICAL RULE: The generated "poaMarkdown" MUST NOT contain any Chinese characters (銝剜�瘙匧�). Every single word, header, description, and list item in "poaMarkdown" must be written in English. Translate any Chinese inputs (such as the seller's answers or reference cases) fully into English.

Absolute Cleanliness: You must never write parentheses containing Chinese text next to English terms, e.g. DO NOT write "Missing English Manuals (蝻箏�霂湔�銋�)" or "ROOT CAUSE (�寞𧋦�笔�)", write ONLY "Missing English Manuals" or "ROOT CAUSE".

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
- Write the final PoA strictly and entirely in English (which is the required language for Amazon's Seller Performance team). Under no circumstances should any Chinese translations, annotations, or inline explanations in parentheses (such as "(�桅��寞𧋦�笔�)" or "(����湔�)") be included in the "poaMarkdown" text. The final text must be 100% pure professional English.
- Do not include any title, header, or metadata block at the top of the PoA, such as "# PLAN OF ACTION (PoA)", "To: Amazon Seller Performance Team", "Regarding:...", or "Date:...". Start the PoA content directly with the salutation: "Dear Amazon Seller Performance Team,".
- Use a highly clear structure with bold headers, bullet points, and inventory numbers.
- Do not use generic filler words. Be precise, citing the relevant numbers, ASINs, dates, or specific documents mentioned in the seller's answers.
- Do not include any generic signature lines or placeholder team/company names.
- Output a valid JSON with three fields:
  1. "poaMarkdown": The full, ready-to-use professional Plan of Action in English formatted in rich Markdown.
  2. "poaMarkdownZh": The complete, high-quality Chinese translation of the generated English PoA in "poaMarkdown".
  3. "expertAuditSuggestions": A bulleted list (in Chinese) of tips from our service provider team for the seller on how to submit this PoA successfully.
`;

    const prompt = `
Please draft a professional Plan of Action (PoA) in "poaMarkdown" and audit recommendations in "expertAuditSuggestions".
CRITICAL REMINDER: The "poaMarkdown" text must be 100% strictly in English.
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
      error: "AI �唾�靽� (PoA) ���憭梯揖嚗諹窈蝔滚��滩���",
      details: error.message
    });
  }
});

// 2b. Refine PoA Endpoint
app.post("/api/refine-poa", async (req, res) => {
  const { previousPoa, rejectionEmail, violationType, answers, expertAdjustments } = req.body;

  if (!previousPoa || !rejectionEmail) {
    return res.status(400).json({ error: "���鈭斤� POA �𠹺�撽祇�𦠜�靽∪�摰寧撩憭梧��䭾�餈𥡝�摰����" });
  }

  try {
    const ai = getGeminiClient();

    const systemInstruction = `
You are a veteran Amazon appeal expert writing a refined, corrected Plan of Action (PoA) in response to Amazon's Seller Performance team rejecting a previous submission.

CRITICAL RULE: The generated "poaMarkdown" MUST NOT contain any Chinese characters (銝剜�瘙匧�). Every single word, header, description, and list item in "poaMarkdown" must be written in English. Translate any Chinese inputs (such as the seller's answers) fully into English.

Absolute Cleanliness: You must never write parentheses containing Chinese text next to English terms, e.g. DO NOT write "Missing English Manuals (蝻箏�霂湔�銋�)" or "ROOT CAUSE (�寞𧋦�笔�)", write ONLY "Missing English Manuals" or "ROOT CAUSE".

Your goal is to take the "previousPoa", analyze the gaps highlighted in "rejectionEmail", and incorporate the seller's new "answers" to rewrite and perfect the POA.
- Address the rejection points directly and with higher specificity.
- Keep the good parts of the previous POA, but enhance the parts that were rejected (e.g., provide deeper root cause analysis, more specific corrective actions, or more systemic preventive measures).
- Cite any new documents or numbers provided in the answers.

Do not include any title, header, or metadata block at the top of the PoA. Start the PoA content directly with the salutation: "Dear Amazon Seller Performance Team,".
The PoA should end with a polite closing like "Sincerely," (with no name following it).
Output a valid JSON with three fields:
  1. "poaMarkdown": The refined Plan of Action in English formatted in rich Markdown.
  2. "poaMarkdownZh": The complete, high-quality Chinese translation of the refined English PoA in "poaMarkdown". It must preserve the exact same structure, headings, bold text, lists, and spacing as the English version. Translate the opening salutation (e.g. "Dear Amazon Seller Performance Team,") to a professional Chinese equivalent like "撠𦠜𨯵���撽祇�𠰴�摰嗥貍��𣪧���" and the closing (e.g. "Sincerely,") to "甇方稲�祉兮 / �砌�".
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
      error: "AI �唾�靽� (PoA) 摰��憭梯揖嚗諹窈蝔滚��滩���",
      details: error.message
    });
  }
});

const ADMIN_PASSWORD = "jie32jiE**";

function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authPass = req.headers["x-admin-password"] || req.query.admin_password;
  if (authPass !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "�芣����撖���躰秤�硋歇憭望���" });
  }
  next();
}

app.use("/api/success-cases", adminAuth);
app.use("/api/parse-case-doc", adminAuth);

// 3. Success Cases CRUD Endpoints
app.get("/api/success-cases", (req, res) => {
  return res.json([...cachedCases].reverse());
});

// Add Case
app.post("/api/success-cases", (req, res) => {
  const { title, type, rootCause, correctiveActions, preventiveMeasures } = req.body;
  if (!title || !type || !rootCause) {
    return res.status(400).json({ error: "�����掩�见��寞𧋦�笔�銝箏�憛恍★��" });
  }

  const newCase: SuccessCase = {
    id: `case-${Date.now()}`,
    title,
    type,
    rootCause,
    correctiveActions: Array.isArray(correctiveActions) ? correctiveActions : [],
    preventiveMeasures: Array.isArray(preventiveMeasures) ? preventiveMeasures : []
  };

  cachedCases.push(newCase);
  saveSuccessCases();
  return res.json({ success: true, case: newCase });
});

// Edit Case
app.put("/api/success-cases/:id", (req, res) => {
  const { id } = req.params;
  const { title, type, rootCause, correctiveActions, preventiveMeasures } = req.body;

  const caseIndex = cachedCases.findIndex(c => c.id === id);
  if (caseIndex === -1) {
    return res.status(404).json({ error: "�芣𪄳�唳�摰𡁶�獢����" });
  }

  cachedCases[caseIndex] = {
    ...cachedCases[caseIndex],
    title: title || cachedCases[caseIndex].title,
    type: type || cachedCases[caseIndex].type,
    rootCause: rootCause || cachedCases[caseIndex].rootCause,
    correctiveActions: Array.isArray(correctiveActions) ? correctiveActions : cachedCases[caseIndex].correctiveActions,
    preventiveMeasures: Array.isArray(preventiveMeasures) ? preventiveMeasures : cachedCases[caseIndex].preventiveMeasures
  };

  saveSuccessCases();
  return res.json({ success: true, case: cachedCases[caseIndex] });
});

// Delete Case
app.delete("/api/success-cases/:id", (req, res) => {
  const { id } = req.params;
  const caseIndex = cachedCases.findIndex(c => c.id === id);
  if (caseIndex === -1) {
    return res.status(404).json({ error: "�芣𪄳�唳�摰𡁶�獢����" });
  }

  cachedCases.splice(caseIndex, 1);
  saveSuccessCases();
  return res.json({ success: true });
});

// AI Case Document Parser Endpoint
app.post("/api/parse-case-doc", async (req, res) => {
  const { docText } = req.body;
  if (!docText || docText.trim() === "") {
    return res.status(400).json({ error: "獢����﹝��捆銝滩�銝箇征��" });
  }

  try {
    const ai = getGeminiClient();

    const systemInstruction = `
You are an expert Amazon Appeal Consultant. Your goal is to analyze the user's successfully appealed Plan of Action (POA) or case document and extract structured fields in high-fidelity JSON.
The violation type must be strictly categorized into one of:
- "Account Association" (�唾�韐血噡)
- "IP Infringement" (靘菜�)
- "Review Manipulation" (�瑕�/�滨熊霂�捏)
- "Product Authenticity" (鈭批��笔���/隞踹�/鈭峕�敶𤘪鰵��)
- "Section 3 / Code of Conduct" (���銵䔶蛹/���桅���/甈箄�銵䔶蛹)
- "Velocity Limit" (���𤩺�憓�)
- "Other" (�嗡�餈肽�)

You must extract the core points in Chinese (蝞�雿㮖葉��).
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
          required: ["title", "type", "rootCause", "correctiveActions", "preventiveMeasures"],
          properties: {
            title: {
              type: Type.STRING,
              description: "A concise and professional Chinese title for this appeal case, e.g., '�唾����桅��桅��嗥𤚗霂� (Section 3 Account Association)' or similar."
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
      error: "AI 獢����﹝閫��憭梯揖嚗諹窈璉��亦�蝏𨀣��𣂷����摰嫘��",
      details: error.message
    });
  }
});

// 4. Submit manual audit request to DingTalk
app.post("/api/submit-audit", async (req, res) => {
  const { contact, poaText, violationType, emailText } = req.body;

  if (!contact || !contact.trim()) {
    return res.status(400).json({ error: "�𠉛頂�孵�銝滩�銝箇征��" });
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
      ? `${poaText.substring(0, maxPoaLength)}\n\n...(��捆餈�鵭嚗�歇鋡急⏛��)`
      : poaText || "�芣�靘𢏺OA�厩阮";

    const maxEmailLength = 1000;
    const truncatedEmail = emailText && emailText.length > maxEmailLength
      ? `${emailText.substring(0, maxEmailLength)}\n\n...(��捆餈�鵭嚗�歇鋡急⏛��)`
      : emailText || "�芣�靘𥕦�憪钅�隞�/�唾��峕艶";

    const messageData = {
      msgtype: "markdown",
      markdown: {
        title: "�啁�鈭箏極摰⊥瓲�唾�霂瑟�",
        text: `### �� �嗅�鈭𡁻帕�羓𤚗霂劐犖撌亙恣�貉窈瘙�

**�� �箸𧋦靽⊥�**
- **�唾窈�園𡢿**: ${timeString}
- **餈肽�蝐餃�**: ${violationType || "�芰䰻蝐餃�"}
- **�𠉛頂�孵�**: ${contact}

---

**�� POA �唾�靽∪�蝔輸�閫�**
\`\`\`markdown
${truncatedPoa}
\`\`\`

---

**�𩣪 �笔�銝𡁶貍�𡁶䰻 / 霂𦠜鱏�峕艶**
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
      throw new Error(`�厰��箏膥鈭箸綫��仃韐�: ${data.errmsg}`);
    }

    return res.json({ success: true, message: "鈭箏極摰⊥瓲霂瑟�撌脫��笔�����" });
  } catch (error: any) {
    console.error("Error submitting manual audit request:", error);
    return res.status(500).json({
      error: "�䭾��煾��犖撌亙恣�貊𤚗霂瘀�霂瑟��亦�蝏𨀣�蝔滚��滩���",
      details: error.message,
    });
  }
});

// Vite & Static file handling
async function startServer() {
  // Load success cases into memory cache from JSON file
  loadSuccessCases();

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
