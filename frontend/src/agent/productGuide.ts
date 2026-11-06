// Product-guide mode (Feature 010, US2): what a clinic owner gets, in plain words. Static, honest, no prices
// or promises that are not in the product today.

import type { AgentLink } from "./types";

export type GuideTopic = { id: string; keywords: string[]; text: string; links?: AgentLink[] };

const PRESETS = "/demo/specialties";
const presetLink = (id: string, label: string): AgentLink => ({ label: `See the ${label} demo`, href: `${PRESETS}/${id}` });

export const GUIDE_TOPICS: readonly GuideTopic[] = [
  {
    id: "overview",
    keywords: ["get", "include", "includes", "features", "system", "offer", "package", "everything", "what"],
    text: "You get a fast, mobile-first clinic website, online booking with real time slots, a booking slip (PDF and QR code, easy to share), and a private staff dashboard (the Command Centre). Your name, colours and services are settings in one shared codebase.",
    links: [
      { label: "Choose your specialty", href: PRESETS },
      { label: "Try booking", href: "/book-appointment" },
    ],
  },
  {
    id: "dental",
    keywords: ["dental", "dentist", "teeth", "tooth", "orthodontic"],
    text: "For a dental clinic, the site shows your treatments (check-ups, whitening, braces, root canal) with prices, your dentists, and online booking by treatment and dentist.",
    links: [presetLink("dental", "Dental")],
  },
  {
    id: "skin",
    keywords: ["dermatology", "skin", "aesthetic", "beauty", "laser", "facial", "cosmetic"],
    text: "For a skin and aesthetic clinic, the site presents consultations and treatments in a calm, premium style, with discreet online booking.",
    links: [presetLink("skin-aesthetic", "Skin & Aesthetic")],
  },
  {
    id: "lab",
    keywords: ["test", "diagnostic", "laboratory", "pathology", "sample", "collection"],
    text: "For a diagnostic lab, patients see each test with its price, sample type, report time and preparation, plus health packages and home sample collection information.",
    links: [presetLink("diagnostic-lab", "Diagnostic Lab"), { label: "Lab tests page", href: "/lab-tests" }],
  },
  {
    id: "multi",
    keywords: ["multi", "speciality", "specialty", "hospital", "departments", "department", "family"],
    text: "For a multi-speciality clinic, every department gets its own page with doctors, schedules and fees, and booking can start from a department or a doctor.",
    links: [presetLink("multi-speciality", "Multi-speciality")],
  },
  {
    id: "dashboard",
    keywords: ["dashboard", "admin", "staff", "command", "centre", "center", "manage", "reception", "receptionist"],
    text: "The Command Centre shows today's agenda by doctor, live booking status (arrived, completed, no-show, cancelled with undo), search and filters, insights charts, and an audit log. Admin and Receptionist roles are checked on the server.",
    links: [{ label: "Open the demo dashboard", href: "/admin/login" }],
  },
  {
    id: "slip",
    keywords: ["slip", "pdf", "qr", "share", "confirmation", "receipt"],
    text: "After booking, the patient gets a confirmation page with a reference, a printable PDF slip with a QR code, and a share link they can send by message.",
  },
  {
    id: "security",
    keywords: ["secure", "security", "privacy", "safe", "data", "hipaa", "gdpr", "password"],
    text: "Staff passwords are hashed with Argon2, sessions use secure cookies, sign-in is rate-limited, phone numbers are masked until revealed (and the reveal is logged). Patient data stays in your database.",
  },
  {
    id: "mobile",
    keywords: ["mobile", "phone", "responsive", "fast", "speed", "performance", "seo", "search"],
    text: "Everything is designed for phones first, with fast pages (Lighthouse mobile target 90+), accessible design, and search-friendly pages for a real clinic.",
  },
  {
    id: "brand",
    keywords: ["brand", "logo", "colour", "color", "name", "white", "label", "customise", "customize", "own"],
    text: "Your clinic name, logo, colours, departments, doctors, prices and hours are settings and data, so your site looks like your clinic without separate code.",
  },
  {
    id: "assistant",
    keywords: ["ai", "chatbot", "assistant", "agent", "bot", "chat"],
    text: "This assistant answers patients from your own clinic data: timings, doctors, departments, tests and fees, then guides them to booking. A smarter AI model can be added later without changing the website.",
  },
];

export const GUIDE_SUGGESTIONS = ["What do I get?", "Does it work for a dental clinic?", "Show me the dashboard", "Is patient data secure?"];
