// Runtime validation for the catalog API (contract: specs/003-catalog-api/contracts/openapi.yaml).
// One schema per component schema; z.infer must equal the generated type (tests/unit/api-contract.test.ts).
// Unknown keys are stripped, so additive API changes are safe; a missing or mistyped field fails the resource.
import { z } from "zod";

const Slug = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const Uuid = z.string().uuid();
const HHMM = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);
const Weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const Price = z.number().int().min(0);
const HexColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const ImageAssetSchema = z.object({
  // Images stay local (research R8), so anything else is rejected.
  src: z.string().startsWith("/images/"),
  alt: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});

export const PhoneNumberSchema = z.object({
  display: z.string(),
  tel: z.string(),
});

export const OpeningHoursRuleSchema = z.object({
  days: z.array(Weekday),
  opens: HHMM,
  closes: HHMM,
});

export const ClinicSettingsSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  fullTitle: z.string(),
  demoNotice: z.string(),
  emergencyPhone: PhoneNumberSchema,
  generalPhone: PhoneNumberSchema,
  address: z.array(z.string()),
  timeZone: z.string(),
  openingHours: z.array(OpeningHoursRuleSchema),
  labHours: z.array(OpeningHoursRuleSchema),
  mapArea: z.object({
    // The generator emits number[] for a 4-item array, so the tuple is narrowed where SiteConfig is built.
    bbox: z.array(z.number()).length(4),
    label: z.string(),
  }),
  credit: z.object({ text: z.string(), href: z.string().url() }),
  indexable: z.boolean(),
  isSample: z.boolean(),
  logo: ImageAssetSchema,
  brandColors: z.object({ primary: HexColour, accent: HexColour }),
});

export const ClinicRuleSchema = z.object({
  id: Uuid,
  sortOrder: z.number().int(),
  text: z.string(),
  isSample: z.boolean(),
});

export const DepartmentSchema = z.object({
  id: Uuid,
  slug: Slug,
  name: z.string(),
  summary: z.string(),
  image: ImageAssetSchema,
  sortOrder: z.number().int(),
  overview: z.string(),
  conditions: z.array(z.string()),
  services: z.array(z.string()),
  relatedTestSlugs: z.array(Slug),
  isSample: z.boolean(),
});

export const ScheduleSessionSchema = z.object({
  day: Weekday,
  start: HHMM,
  end: HHMM,
  slotMinutes: z.number().int().min(5).max(120),
});

export const DoctorSchema = z.object({
  id: Uuid,
  slug: Slug,
  fullName: z.string(),
  departmentId: Uuid,
  specialty: z.string(),
  photo: ImageAssetSchema,
  feePkr: Price,
  qualifications: z.array(z.string()),
  experienceYears: z.number().int(),
  languages: z.array(z.enum(["Urdu", "English", "Sindhi", "Punjabi"])),
  bio: z.string(),
  schedule: z.array(ScheduleSessionSchema),
  isFeatured: z.boolean(),
  isSample: z.boolean(),
});

export const LabTestCategorySchema = z.object({
  id: Uuid,
  slug: Slug,
  name: z.string(),
  iconName: z.string(),
});

export const LabTestSchema = z.object({
  id: Uuid,
  slug: Slug,
  name: z.string(),
  alsoKnownAs: z.array(z.string()),
  categoryId: Uuid,
  pricePkr: Price,
  sampleType: z.string(),
  reportTime: z.string(),
  preparation: z.string(),
  homeCollection: z.boolean(),
  about: z.string(),
  relatedDepartmentIds: z.array(Uuid),
  isSample: z.boolean(),
});

export const HealthPackageSchema = z.object({
  id: Uuid,
  slug: Slug,
  name: z.string(),
  iconName: z.string(),
  whoFor: z.string(),
  testSlugs: z.array(Slug),
  packagePricePkr: Price,
  preparation: z.string(),
  homeCollection: z.boolean(),
  isSample: z.boolean(),
});

/** The paging envelope `{ items, total, page, pageSize }`. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });
}

export type ImageAssetApi = z.infer<typeof ImageAssetSchema>;
export type ClinicSettings = z.infer<typeof ClinicSettingsSchema>;
export type ClinicRuleApi = z.infer<typeof ClinicRuleSchema>;
export type DepartmentApi = z.infer<typeof DepartmentSchema>;
export type DoctorApi = z.infer<typeof DoctorSchema>;
export type LabTestCategoryApi = z.infer<typeof LabTestCategorySchema>;
export type LabTestApi = z.infer<typeof LabTestSchema>;
export type HealthPackageApi = z.infer<typeof HealthPackageSchema>;
