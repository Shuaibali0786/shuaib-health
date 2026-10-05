import { describe, expect, expectTypeOf, it } from "vitest";
import { parse } from "yaml";
import type { z } from "zod";

import type { components } from "@/lib/api/schema.gen";
import {
  ClinicRuleSchema,
  ClinicSettingsSchema,
  DepartmentSchema,
  DoctorSchema,
  HealthPackageSchema,
  ImageAssetSchema,
  LabTestCategorySchema,
  LabTestSchema,
  OpeningHoursRuleSchema,
  PhoneNumberSchema,
  ScheduleSessionSchema,
  pageSchema,
} from "@/lib/api/schemas";
import {
  AlternativeSlotSchema,
  AppointmentViewSchema,
  BookingConflictSchema,
  DoctorSlotsSchema,
  ErrorInfoSchema,
  SlotDaySchema,
  SlotSchema,
} from "@/lib/booking/schemas";
import type {
  ClinicRule,
  Department,
  Doctor,
  HealthPackage,
  ImageAsset,
  LabTest,
  LabTestCategory,
  SiteConfig,
} from "@/types/content";

import {
  type FixtureName,
  firstDifference,
  generateTypes,
  readApiFixture,
  readCommittedTypes,
  readContract,
} from "./helpers/api-contract";

type Schemas = components["schemas"];

describe("API contract", () => {
  it("(1) schema.gen.ts matches a fresh generation from the contract", async () => {
    const generated = await generateTypes(readContract());
    const committed = readCommittedTypes();
    expect(
      committed === generated,
      `schema.gen.ts is out of date (${firstDifference(committed, generated)}). Run npm run api:types and commit it.`,
    ).toBe(true);
  });

  it("(2) every zod schema infers exactly the generated type", () => {
    // Compile-time checks, enforced by `npm run typecheck`. The mutual assignability form is used
    // because the generator describes pages as `PageMeta & { items }` intersections.
    expectTypeOf<z.infer<typeof ImageAssetSchema>>().toEqualTypeOf<Schemas["ImageAsset"]>();
    expectTypeOf<z.infer<typeof PhoneNumberSchema>>().toEqualTypeOf<Schemas["PhoneNumber"]>();
    expectTypeOf<z.infer<typeof OpeningHoursRuleSchema>>().toEqualTypeOf<Schemas["OpeningHoursRule"]>();
    expectTypeOf<z.infer<typeof ClinicSettingsSchema>>().toEqualTypeOf<Schemas["ClinicSettings"]>();
    expectTypeOf<z.infer<typeof ClinicRuleSchema>>().toEqualTypeOf<Schemas["ClinicRule"]>();
    expectTypeOf<z.infer<typeof DepartmentSchema>>().toEqualTypeOf<Schemas["Department"]>();
    expectTypeOf<z.infer<typeof ScheduleSessionSchema>>().toEqualTypeOf<Schemas["ScheduleSession"]>();
    expectTypeOf<z.infer<typeof DoctorSchema>>().toEqualTypeOf<Schemas["Doctor"]>();
    expectTypeOf<z.infer<typeof LabTestCategorySchema>>().toEqualTypeOf<Schemas["LabTestCategory"]>();
    expectTypeOf<z.infer<typeof LabTestSchema>>().toEqualTypeOf<Schemas["LabTest"]>();
    expectTypeOf<z.infer<typeof HealthPackageSchema>>().toEqualTypeOf<Schemas["HealthPackage"]>();

    expectTypeOf<z.infer<typeof SlotSchema>>().toEqualTypeOf<Schemas["Slot"]>();
    expectTypeOf<z.infer<typeof AlternativeSlotSchema>>().toEqualTypeOf<Schemas["AlternativeSlot"]>();
    expectTypeOf<z.infer<typeof SlotDaySchema>>().toEqualTypeOf<Schemas["SlotDay"]>();
    expectTypeOf<z.infer<typeof DoctorSlotsSchema>>().toEqualTypeOf<Schemas["DoctorSlots"]>();
    expectTypeOf<z.infer<typeof AppointmentViewSchema>>().toEqualTypeOf<Schemas["AppointmentView"]>();
    expectTypeOf<z.infer<typeof ErrorInfoSchema>>().toEqualTypeOf<Schemas["ErrorInfo"]>();
    expectTypeOf<z.infer<typeof BookingConflictSchema>>().toEqualTypeOf<Schemas["BookingConflict"]>();

    type DoctorPage = z.infer<ReturnType<typeof pageSchema<typeof DoctorSchema>>>;
    expectTypeOf<DoctorPage>().toMatchTypeOf<Schemas["DoctorPage"]>();
    expectTypeOf<Schemas["DoctorPage"]>().toMatchTypeOf<DoctorPage>();
    expect(true).toBe(true);
  });

  it("(3) generated types are assignable to the component types", () => {
    // Three relaxations, each a place where the generator is wider than the component type, so the
    // mapping layer narrows it: ScheduleSession.day (generated allows "sun"), iconName (generated is
    // string, component type is the IconName union) and mapArea.bbox (generated number[], component tuple).
    expectTypeOf<Schemas["ImageAsset"]>().toMatchTypeOf<ImageAsset>();
    expectTypeOf<Schemas["Department"]>().toMatchTypeOf<Department>();
    expectTypeOf<Omit<Schemas["Doctor"], "schedule">>().toMatchTypeOf<Omit<Doctor, "schedule">>();
    expectTypeOf<Omit<Schemas["ScheduleSession"], "day">>().toMatchTypeOf<Omit<Doctor["schedule"][number], "day">>();
    expectTypeOf<Omit<Schemas["LabTestCategory"], "iconName">>().toMatchTypeOf<Omit<LabTestCategory, "iconName">>();
    expectTypeOf<Schemas["LabTest"]>().toMatchTypeOf<LabTest>();
    expectTypeOf<Omit<Schemas["HealthPackage"], "iconName">>().toMatchTypeOf<Omit<HealthPackage, "iconName">>();
    expectTypeOf<Schemas["ClinicRule"]>().toMatchTypeOf<ClinicRule>();
    expectTypeOf<Omit<Schemas["ClinicSettings"], "mapArea">>().toMatchTypeOf<Omit<SiteConfig, "mapArea">>();
    expectTypeOf<Schemas["ClinicSettings"]["mapArea"]["label"]>().toEqualTypeOf<SiteConfig["mapArea"]["label"]>();
    expect(true).toBe(true);
  });

  const parsers: Record<FixtureName, (data: unknown) => { success: boolean }> = {
    clinic: (d) => ClinicSettingsSchema.safeParse(d),
    "clinic-rules": (d) => pageSchema(ClinicRuleSchema).safeParse(d),
    departments: (d) => pageSchema(DepartmentSchema).safeParse(d),
    doctors: (d) => pageSchema(DoctorSchema).safeParse(d),
    "lab-test-categories": (d) => pageSchema(LabTestCategorySchema).safeParse(d),
    "lab-tests": (d) => pageSchema(LabTestSchema).safeParse(d),
    "health-packages": (d) => pageSchema(HealthPackageSchema).safeParse(d),
  };

  it.each(Object.keys(parsers) as FixtureName[])("(4) recorded fixture %s parses with its schema", (name) => {
    expect(parsers[name](readApiFixture(name)).success).toBe(true);
  });

  // Every contract property of the booking shapes exists in its zod schema, and the schema adds none.
  const bookingShapes = {
    Slot: SlotSchema,
    SlotDay: SlotDaySchema,
    DoctorSlots: DoctorSlotsSchema,
    AppointmentView: AppointmentViewSchema,
    BookingConflict: BookingConflictSchema,
  } as const;

  it.each(Object.keys(bookingShapes) as (keyof typeof bookingShapes)[])(
    "(5) %s has the same properties in the contract and in its zod schema",
    (name) => {
      const contract = parse(readContract()) as { components: { schemas: Record<string, { properties: object }> } };
      expect(Object.keys(bookingShapes[name].shape).sort()).toEqual(
        Object.keys(contract.components.schemas[name]?.properties ?? {}).sort(),
      );
    },
  );
});
