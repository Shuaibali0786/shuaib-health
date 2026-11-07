// "Choose your specialty" demo presets (Feature 009, ADR-0012). Each preset is data only: one shared
// showcase component renders all four. Every clinic and doctor here is invented and labelled as a sample;
// contact details are the project's standard fake ones. Images are the repo's existing, cleared photos.

import type { IconName } from "@/types/content";

export const PRESET_IDS = ["dental", "skin-aesthetic", "diagnostic-lab", "multi-speciality"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export type PresetService = { name: string; blurb: string; icon: IconName; price: string };
export type PresetDoctor = { name: string; role: string; days: string };

export type SpecialtyPreset = {
  id: PresetId;
  label: string;
  clinicName: string;
  eyebrow: string;
  tagline: string;
  intro: string;
  heroImage: { src: string; alt: string; width: number; height: number };
  services: readonly PresetService[];
  doctors: readonly PresetDoctor[];
  hours: string;
  /** What the slip preview and the dashboard preview call a booking for this specialty. */
  visitWord: string;
};

export const SAMPLE_PHONE = "0300 1234567";
export const SAMPLE_EMAIL = "test@example.com";

export const PRESETS: readonly SpecialtyPreset[] = [
  {
    id: "dental",
    label: "Dental",
    clinicName: "Pearl Dental Studio",
    eyebrow: "Dental care",
    tagline: "Gentle dentistry, booked in a minute",
    intro: "Check-ups, cleaning, whitening and braces, with clear prices and online booking.",
    heroImage: { src: "/images/departments/dental.jpg", alt: "A bright dental treatment room", width: 800, height: 600 },
    services: [
      { name: "Check-up and cleaning", blurb: "Exam, scaling and polish", icon: "sparkles", price: "PKR 3,500" },
      { name: "Teeth whitening", blurb: "In-chair whitening session", icon: "sun", price: "PKR 18,000" },
      { name: "Braces and aligners", blurb: "Consultation and plan", icon: "clipboard-check", price: "PKR 4,000" },
      { name: "Root canal", blurb: "Single-visit where possible", icon: "activity", price: "PKR 15,000" },
      { name: "Children's dentistry", blurb: "Calm first visits", icon: "flower", price: "PKR 3,000" },
    ],
    doctors: [
      { name: "Dr. Hira Saleem", role: "General dentist", days: "Mon – Sat" },
      { name: "Dr. Kamran Aziz", role: "Orthodontist", days: "Tue, Thu, Sat" },
      { name: "Dr. Noor Fatima", role: "Endodontist", days: "Mon, Wed, Fri" },
    ],
    hours: "Mon – Sat, 10:00 – 20:00",
    visitWord: "Dental visit",
  },
  {
    id: "skin-aesthetic",
    label: "Skin & Aesthetic",
    clinicName: "Lumière Skin Clinic",
    eyebrow: "Skin & aesthetic care",
    tagline: "Skin care that feels like a calm ritual",
    intro: "Consultations, facials, laser and acne care, with discreet online booking.",
    heroImage: { src: "/images/departments/dermatology.jpg", alt: "A calm skin consultation room", width: 800, height: 600 },
    services: [
      { name: "Skin consultation", blurb: "Assessment and routine plan", icon: "clipboard-check", price: "PKR 4,500" },
      { name: "Hydrating facial", blurb: "Deep cleanse and hydration", icon: "droplet", price: "PKR 12,000" },
      { name: "Acne care", blurb: "Treatment plan and follow-up", icon: "sparkles", price: "PKR 5,000" },
      { name: "Laser hair removal", blurb: "Per session, by area", icon: "flame", price: "PKR 9,000" },
      { name: "Chemical peel", blurb: "Brightening and texture", icon: "sun", price: "PKR 8,000" },
    ],
    doctors: [
      { name: "Dr. Mahnoor Iqbal", role: "Dermatologist", days: "Mon – Fri" },
      { name: "Dr. Saad Rehman", role: "Aesthetic physician", days: "Tue – Sat" },
      { name: "Ms. Areeba Khan", role: "Skin therapist", days: "Mon – Sat" },
    ],
    hours: "Mon – Sat, 11:00 – 21:00",
    visitWord: "Skin appointment",
  },
  {
    id: "diagnostic-lab",
    label: "Diagnostic Lab",
    clinicName: "ClearPath Diagnostics",
    eyebrow: "Diagnostic laboratory",
    tagline: "Lab tests with clear prices and quick reports",
    intro: "Blood tests, health packages and home sample collection, booked online.",
    heroImage: { src: "/images/departments/pathology-lab.jpg", alt: "A clean laboratory bench with sample tubes", width: 800, height: 600 },
    services: [
      { name: "Complete blood count", blurb: "Report the same day", icon: "test-tube", price: "PKR 1,200" },
      { name: "Lipid profile", blurb: "Fasting 10 – 12 hours", icon: "droplet", price: "PKR 2,400" },
      { name: "Glycated haemoglobin", blurb: "Three-month sugar average, no fasting", icon: "activity", price: "PKR 2,000" },
      { name: "Thyroid profile", blurb: "TSH, T3, T4", icon: "flask-conical", price: "PKR 3,200" },
      { name: "Home sample collection", blurb: "Within city limits", icon: "house", price: "PKR 500" },
      { name: "Full body package", blurb: "Twenty-plus tests", icon: "package", price: "PKR 9,500" },
    ],
    doctors: [
      { name: "Dr. Usman Tariq", role: "Consultant pathologist", days: "Mon – Sat" },
      { name: "Dr. Rabia Naseem", role: "Microbiologist", days: "Mon – Fri" },
      { name: "Mr. Faraz Ali", role: "Phlebotomy lead", days: "Daily" },
    ],
    hours: "Daily, 07:00 – 22:00",
    visitWord: "Lab visit",
  },
  {
    id: "multi-speciality",
    label: "Multi-speciality",
    clinicName: "Crescent Family Clinic",
    eyebrow: "Clinic & diagnostics",
    tagline: "Every specialist your family needs, in one place",
    intro: "Doctors across departments, lab tests and health packages, with online booking.",
    heroImage: { src: "/images/hero/hero-doctor.jpg", alt: "A doctor smiling in a bright clinic corridor", width: 1200, height: 1500 },
    services: [
      { name: "General medicine", blurb: "Everyday care for adults", icon: "stethoscope", price: "PKR 2,500" },
      { name: "Cardiology", blurb: "Heart check-ups and ECG", icon: "heart-pulse", price: "PKR 4,000" },
      { name: "Paediatrics", blurb: "Care for children", icon: "flower", price: "PKR 3,000" },
      { name: "Gynaecology", blurb: "Women's health", icon: "activity", price: "PKR 3,500" },
      { name: "Laboratory", blurb: "Tests and packages", icon: "test-tube", price: "from PKR 800" },
    ],
    doctors: [
      { name: "Dr. Adeel Hussain", role: "Family physician", days: "Mon – Sat" },
      { name: "Dr. Samina Javed", role: "Cardiologist", days: "Mon, Wed, Fri" },
      { name: "Dr. Talha Siddiqui", role: "Paediatrician", days: "Tue – Sat" },
    ],
    hours: "Mon – Sat, 09:00 – 21:00",
    visitWord: "Appointment",
  },
];

export const DEFAULT_PRESET: PresetId = "multi-speciality";
export const SPECIALTIES_PATH = "/demo/specialties";
export const presetPath = (id: PresetId): string => `${SPECIALTIES_PATH}/${id}`;

export function isPresetId(value: string): value is PresetId {
  return (PRESET_IDS as readonly string[]).includes(value);
}

export function getPreset(id: string): SpecialtyPreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

/** "Pearl Dental Studio" -> "PD"; "Dr. Hira Saleem" -> "HS" (titles are skipped). */
export function monogram(name: string): string {
  const words = name.replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((word) => (word ?? "").charAt(0).toUpperCase()).join("");
}
