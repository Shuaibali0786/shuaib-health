// The AI agent's contracts (Feature 010, ADR-0013). Any provider (the free local engine today, a real AI
// model later) implements `AgentProvider`; the widget only knows this interface.

export type AgentMode = "patient" | "guide";

export type AgentLink = { label: string; href: string };

export type AgentReply = {
  text: string;
  links?: AgentLink[];
  suggestions?: string[];
  /** What the provider understood, for tests and (later) anonymous quality counts. Never shown. */
  intent: string;
  /** v1.1: the department a symptom points to (no diagnosis), for tests. Never shown. */
  department?: string;
};

export type AgentRequest = { mode: AgentMode; question: string };

export interface AgentProvider {
  readonly id: string;
  answer(request: AgentRequest): Promise<AgentReply>;
}

/**
 * The public facts the assistant may use: the same catalog and clinic settings the pages show. Nothing
 * personal, no bookings, no staff data (allow-listed in `knowledge.ts`, tested).
 */
export type KnowledgePack = {
  clinic: {
    name: string;
    phone: string;
    emergencyPhone: string;
    /** Public emergency numbers for the clinic's country, e.g. "1122 or 115" (from the clinic time zone). */
    emergencyNumbers: string;
    address: string[];
    hours: string;
    labHours: string;
    /** The same opening rules the contact page shows (days such as "mon", times "09:00"), for "is the clinic open today?". */
    openingRules: Array<{ days: string[]; opens: string; closes: string }>;
    /** The clinic's time zone ("today" means the clinic's today). */
    timeZone: string;
  };
  departments: Array<{ slug: string; name: string; summary: string }>;
  doctors: Array<{ slug: string; name: string; specialty: string; departmentSlug: string; departmentName: string; feePkr: number; days: string[] }>;
  labTests: Array<{ slug: string; name: string; aka: string[]; pricePkr: number; sampleType: string; reportTime: string; preparation: string; homeCollection: boolean }>;
  packages: Array<{ slug: string; name: string; pricePkr: number; whoFor: string; preparation: string }>;
  faqs: Array<{ question: string; answer: string; groupSlug: string }>;
  /** Product-guide mode is offered only on the portfolio demo. */
  demo: boolean;
};
