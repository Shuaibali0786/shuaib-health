import type { Department, ImageAsset } from "@/types/content";

function departmentImage(slug: string, alt: string): ImageAsset {
  return {
    src: `/images/departments/${slug}.jpg`,
    alt,
    width: 800,
    height: 600,
  };
}

/**
 * Sample departments, in display order. Conditions and services are general lists
 * for orientation only: no diagnosis or treatment claims. `relatedTestSlugs` are
 * slugs from data/labTests.ts.
 */
export const departments: Department[] = [
  {
    id: "dept-general-medicine",
    slug: "general-medicine",
    name: "General Medicine",
    summary: "Everyday health concerns, checkups and ongoing care for adults.",
    image: departmentImage("general-medicine", "Doctor reviewing a folder with a patient in a consultation room"),
    sortOrder: 1,
    overview:
      "General Medicine is the first stop for most adult health concerns. Doctors go through symptoms, order tests when needed and agree a follow-up plan, and can refer you to another department if that is the better fit.",
    conditions: [
      "Fever and flu-like illness",
      "Cough and sore throat",
      "Stomach upset and acidity",
      "Headache and tiredness",
      "High blood pressure checks",
      "Routine adult checkups",
    ],
    services: [
      "Consultation for adults",
      "Routine checkups",
      "Follow-up visits",
      "Referral to other departments",
      "Test requests and report explanation",
    ],
    relatedTestSlugs: [
      "complete-blood-count",
      "fasting-blood-sugar",
      "lipid-profile",
      "liver-function-tests",
      "urine-routine-examination",
    ],
    isSample: true,
  },
  {
    id: "dept-cardiology",
    slug: "cardiology",
    name: "Cardiology",
    summary: "Heart and blood-pressure care, including routine heart checkups.",
    image: departmentImage("cardiology", "Smiling nurse in green scrubs holding a paper heart"),
    sortOrder: 2,
    overview:
      "Cardiology looks after heart and blood-pressure concerns. Visits cover routine heart checkups, explanation of test reports and follow-up for ongoing care.",
    conditions: [
      "Chest discomfort needing a check",
      "High blood pressure",
      "Palpitations",
      "Shortness of breath on effort",
      "Cholesterol concerns",
      "Follow-up after heart care",
    ],
    services: [
      "Cardiology consultation",
      "Blood pressure check",
      "Heart checkup planning",
      "Explaining lab reports",
      "Follow-up visits",
    ],
    relatedTestSlugs: ["lipid-profile", "hs-crp", "fasting-blood-sugar", "serum-creatinine"],
    isSample: true,
  },
  {
    id: "dept-pediatrics",
    slug: "pediatrics",
    name: "Pediatrics",
    summary: "Care for babies, children and teenagers, from routine checkups onward.",
    image: departmentImage("pediatrics", "Doctor listening to a young girl's chest with a stethoscope"),
    sortOrder: 3,
    overview:
      "Pediatrics cares for babies, children and teenagers. Doctors see routine checkups and common childhood illnesses, and talk with parents and children together.",
    conditions: [
      "Fever and colds",
      "Cough and ear complaints",
      "Tummy aches and loose motions",
      "Skin rashes",
      "Growth and weight questions",
      "Routine child checkups",
    ],
    services: [
      "Child consultation",
      "Growth and development check",
      "Routine checkups",
      "Guidance for parents",
      "Follow-up visits",
    ],
    relatedTestSlugs: ["complete-blood-count", "urine-routine-examination", "vitamin-d", "esr"],
    isSample: true,
  },
  {
    id: "dept-gynecology",
    slug: "gynecology",
    name: "Gynecology",
    summary: "Women's health, from routine checkups to pregnancy care.",
    image: departmentImage("gynecology", "Doctor and two women gathered around a table during a consultation"),
    sortOrder: 4,
    overview:
      "Gynecology provides women's health care, from routine checkups to pregnancy care. Visits are private and unhurried, with time to talk through any concern.",
    conditions: [
      "Irregular or painful periods",
      "Pregnancy checkups",
      "Urinary complaints",
      "Hormone-related concerns",
      "Routine women's health checkups",
      "Follow-up care",
    ],
    services: [
      "Gynecology consultation",
      "Pregnancy care visits",
      "Routine women's health checkups",
      "Test requests and report explanation",
      "Follow-up visits",
    ],
    relatedTestSlugs: ["complete-blood-count", "tsh", "prolactin", "urine-pregnancy-test", "vitamin-d"],
    isSample: true,
  },
  {
    id: "dept-dermatology",
    slug: "dermatology",
    name: "Dermatology",
    summary: "Skin, hair and nail care for common conditions.",
    image: departmentImage("dermatology", "Doctor examining a skin image on a tablet beside a patient"),
    sortOrder: 5,
    overview:
      "Dermatology looks after skin, hair and nail concerns. Doctors explain skin-care routines and what to expect between visits.",
    conditions: [
      "Acne",
      "Rashes and itching",
      "Dandruff and hair fall",
      "Dry skin",
      "Fungal infections of skin and nails",
      "Pigmentation concerns",
    ],
    services: [
      "Skin, hair and nail consultation",
      "Skin-care guidance",
      "Test requests and report explanation",
      "Follow-up visits",
      "Referral to other departments",
    ],
    relatedTestSlugs: ["complete-blood-count", "vitamin-d", "vitamin-b12", "tsh"],
    isSample: true,
  },
  {
    id: "dept-dental",
    slug: "dental",
    name: "Dental",
    summary: "Dental checkups, cleaning and everyday tooth care.",
    image: departmentImage("dental", "Two dental staff reviewing an X-ray on a screen beside a dental chair"),
    sortOrder: 6,
    overview:
      "Dental covers checkups, cleaning and everyday tooth care. The dentist explains each step before starting so there are no surprises.",
    conditions: [
      "Toothache",
      "Cavities",
      "Bleeding gums",
      "Bad breath",
      "Sensitive teeth",
      "Routine dental checkups",
    ],
    services: [
      "Dental checkup",
      "Cleaning and polishing",
      "Fillings",
      "Advice on tooth care at home",
      "Follow-up visits",
    ],
    relatedTestSlugs: ["complete-blood-count", "random-blood-sugar", "hepatitis-b-surface-antigen"],
    isSample: true,
  },
  {
    id: "dept-pathology-lab",
    slug: "pathology-lab",
    name: "Pathology Lab",
    summary: "Blood and other lab tests, with reports available online.",
    image: departmentImage("pathology-lab", "Laboratory scientist in a blue gown using a microscope"),
    sortOrder: 7,
    overview:
      "The Pathology Lab runs blood, urine and other tests requested by doctors, with reports available online. Samples are collected at the lab, and at home for many tests.",
    conditions: [
      "Tests requested by a doctor",
      "Routine health checkups",
      "Monitoring of ongoing care",
      "Pre-visit blood and urine tests",
    ],
    services: [
      "Blood and urine sample collection",
      "Home sample collection for many tests",
      "Report preparation",
      "Answers about preparation, such as fasting",
    ],
    relatedTestSlugs: [
      "complete-blood-count",
      "hba1c",
      "lipid-profile",
      "liver-function-tests",
      "tsh",
      "urine-routine-examination",
    ],
    isSample: true,
  },
];
