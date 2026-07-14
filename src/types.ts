export interface EvidenceQuestion {
  id: string;
  label: string;
  type: "text" | "boolean" | "select";
  options?: string[];
  placeholder: string;
  description: string;
  proofRequired: string;
}

export interface EmailAnalysis {
  violationType: string;
  violationTypeZh: string;
  summary: string;
  suggestedCaseTitle: string;
  riskLevel: "High" | "Medium" | "Low";
  evidenceQuestions: EvidenceQuestion[];
}

export interface SuccessCase {
  id: string;
  title: string;
  type: string;
  rootCause: string;
  correctiveActions: string[];
  preventiveMeasures: string[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: string;
  questionId: string;
}

export interface GeneratedPoA {
  poaMarkdown: string;
  poaMarkdownZh: string;
  expertAuditSuggestions: string[];
}
