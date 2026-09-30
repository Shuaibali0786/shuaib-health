import type { Department, ImageAsset } from "@/types/content";

function departmentImage(slug: string, name: string): ImageAsset {
  return {
    src: `/images/departments/${slug}-placeholder.jpg`,
    alt: `${name} department (placeholder image)`,
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
    image: departmentImage("general-medicine", "General Medicine"),
    sortOrder: 1,
    isSample: true,
  },
  {
    id: "dept-cardiology",
    slug: "cardiology",
    name: "Cardiology",
    summary: "Heart and blood-pressure care, including routine heart checkups.",
    image: departmentImage("cardiology", "Cardiology"),
    sortOrder: 2,
    isSample: true,
  },
  {
    id: "dept-pediatrics",
    slug: "pediatrics",
    name: "Pediatrics",
    summary: "Care for babies, children and teenagers, from routine checkups onward.",
    image: departmentImage("pediatrics", "Pediatrics"),
    sortOrder: 3,
    isSample: true,
  },
  {
    id: "dept-gynecology",
    slug: "gynecology",
    name: "Gynecology",
    summary: "Women's health, from routine checkups to pregnancy care.",
    image: departmentImage("gynecology", "Gynecology"),
    sortOrder: 4,
    isSample: true,
  },
  {
    id: "dept-dermatology",
    slug: "dermatology",
    name: "Dermatology",
    summary: "Skin, hair and nail care for common conditions.",
    image: departmentImage("dermatology", "Dermatology"),
    sortOrder: 5,
    isSample: true,
  },
  {
    id: "dept-dental",
    slug: "dental",
    name: "Dental",
    summary: "Dental checkups, cleaning and everyday tooth care.",
    image: departmentImage("dental", "Dental"),
    sortOrder: 6,
    isSample: true,
  },
  {
    id: "dept-pathology-lab",
    slug: "pathology-lab",
    name: "Pathology Lab",
    summary: "Blood and other lab tests, with reports available online.",
    image: departmentImage("pathology-lab", "Pathology Lab"),
    sortOrder: 7,
    isSample: true,
  },
];
