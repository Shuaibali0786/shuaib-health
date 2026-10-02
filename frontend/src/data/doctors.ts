import type { Doctor, ImageAsset } from "@/types/content";

function doctorPhoto(slug: string, alt: string): ImageAsset {
  return {
    src: `/images/doctors/${slug}.jpg`,
    alt,
    width: 600,
    height: 750,
  };
}

/**
 * Invented sample doctors. Names are made up and may coincide with real
 * people, so every card shows a "Sample" badge. No credentials, ratings or
 * experience figures exist as fields on purpose.
 */
export const doctors: Doctor[] = [
  {
    id: "doc-hassan-mirza",
    slug: "dr-hassan-mirza",
    fullName: "Dr. Hassan Mirza",
    departmentId: "dept-general-medicine",
    specialty: "General Medicine",
    photo: doctorPhoto("dr-hassan-mirza", "Sample doctor Dr. Hassan Mirza: a bearded man in glasses and a lavender coat with a stethoscope, arms crossed"),
    feePkr: 2000,
    isFeatured: true,
    isSample: true,
  },
  {
    id: "doc-imran-qureshi",
    slug: "dr-imran-qureshi",
    fullName: "Dr. Imran Qureshi",
    departmentId: "dept-cardiology",
    specialty: "Cardiology",
    photo: doctorPhoto("dr-imran-qureshi", "Sample doctor Dr. Imran Qureshi: a man in a white coat with a stethoscope"),
    feePkr: 3500,
    isFeatured: true,
    isSample: true,
  },
  {
    id: "doc-sana-farooqui",
    slug: "dr-sana-farooqui",
    fullName: "Dr. Sana Farooqui",
    departmentId: "dept-pediatrics",
    specialty: "Pediatrics",
    photo: doctorPhoto("dr-sana-farooqui", "Sample doctor Dr. Sana Farooqui: a smiling woman in a headscarf and dark scrubs holding a red book"),
    feePkr: 2500,
    isFeatured: true,
    isSample: true,
  },
  {
    id: "doc-ayesha-rahman",
    slug: "dr-ayesha-rahman",
    fullName: "Dr. Ayesha Rahman",
    departmentId: "dept-gynecology",
    specialty: "Gynecology",
    photo: doctorPhoto("dr-ayesha-rahman", "Sample doctor Dr. Ayesha Rahman: a woman in a white coat taking a phone call and holding a notebook"),
    feePkr: 3000,
    isFeatured: true,
    isSample: true,
  },
];
