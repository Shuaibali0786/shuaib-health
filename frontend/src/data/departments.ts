import type { Department, ImageAsset } from "@/types/content";

function departmentImage(slug: string, alt: string): ImageAsset {
  return {
    src: `/images/departments/${slug}-placeholder.jpg`,
    alt,
    width: 800,
    height: 600,
  };
}

/** Sample departments, in display order. */
export const departments: Department[] = [
  {
    id: "dept-general-medicine",
    slug: "general-medicine",
    name: "General Medicine",
    summary: "Everyday health concerns, checkups and ongoing care for adults.",
    image: departmentImage("general-medicine", "Doctor reviewing a folder with a patient in a consultation room"),
    sortOrder: 1,
    isSample: true,
  },
  {
    id: "dept-cardiology",
    slug: "cardiology",
    name: "Cardiology",
    summary: "Heart and blood-pressure care, including routine heart checkups.",
    image: departmentImage("cardiology", "Smiling nurse in green scrubs holding a paper heart"),
    sortOrder: 2,
    isSample: true,
  },
  {
    id: "dept-pediatrics",
    slug: "pediatrics",
    name: "Pediatrics",
    summary: "Care for babies, children and teenagers, from routine checkups onward.",
    image: departmentImage("pediatrics", "Doctor listening to a young girl's chest with a stethoscope"),
    sortOrder: 3,
    isSample: true,
  },
  {
    id: "dept-gynecology",
    slug: "gynecology",
    name: "Gynecology",
    summary: "Women's health, from routine checkups to pregnancy care.",
    image: departmentImage("gynecology", "Doctor and two women gathered around a table during a consultation"),
    sortOrder: 4,
    isSample: true,
  },
  {
    id: "dept-dermatology",
    slug: "dermatology",
    name: "Dermatology",
    summary: "Skin, hair and nail care for common conditions.",
    image: departmentImage("dermatology", "Doctor examining a skin image on a tablet beside a patient"),
    sortOrder: 5,
    isSample: true,
  },
  {
    id: "dept-dental",
    slug: "dental",
    name: "Dental",
    summary: "Dental checkups, cleaning and everyday tooth care.",
    image: departmentImage("dental", "Two dental staff reviewing an X-ray on a screen beside a dental chair"),
    sortOrder: 6,
    isSample: true,
  },
  {
    id: "dept-pathology-lab",
    slug: "pathology-lab",
    name: "Pathology Lab",
    summary: "Blood and other lab tests, with reports available online.",
    image: departmentImage("pathology-lab", "Laboratory scientist in a blue gown using a microscope"),
    sortOrder: 7,
    isSample: true,
  },
];
