import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { DoctorSchema, pageSchema } from "@/lib/api/schemas";
import {
  AppointmentViewSchema,
  BookingConflictSchema,
  DoctorSlotsSchema,
  SlotDaySchema,
  SlotSchema,
} from "@/lib/booking/schemas";

import { generateTypes, readApiFixture, readCommittedTypes, readContract } from "./helpers/api-contract";

/**
 * SC-007: contract drift must be caught. Each drift is applied to a copy of the contract and
 * to a copy of the recorded fixture, as the API would then behave. Check (1) is "committed
 * types differ from a fresh generation"; check (4) is "a recorded fixture fails its schema".
 */
type Doc = { components: { schemas: { Doctor: { required: string[]; properties: Record<string, unknown> } } } };

function drifted(change: (doctor: Doc["components"]["schemas"]["Doctor"]) => void): Doc {
  const doc = parse(readContract()) as Doc;
  change(doc.components.schemas.Doctor);
  return doc;
}

type DoctorRow = Record<string, unknown>;
function fixtureWith(change: (doctor: DoctorRow) => void): unknown {
  const page = structuredClone(readApiFixture("doctors")) as { items: DoctorRow[] };
  for (const doctor of page.items) change(doctor);
  return page;
}

const drifts = [
  {
    name: "remove bio",
    contract: drifted((d) => {
      delete d.properties.bio;
      d.required = d.required.filter((k) => k !== "bio");
    }),
    fixture: fixtureWith((d) => delete d.bio),
    fixtureDetects: true,
  },
  {
    name: "rename fullName to name",
    contract: drifted((d) => {
      d.properties.name = d.properties.fullName;
      delete d.properties.fullName;
      d.required = d.required.map((k) => (k === "fullName" ? "name" : k));
    }),
    fixture: fixtureWith((d) => {
      d.name = d.fullName;
      delete d.fullName;
    }),
    fixtureDetects: true,
  },
  {
    name: "change feePkr to string",
    contract: drifted((d) => {
      d.properties.feePkr = { type: "string" };
    }),
    fixture: fixtureWith((d) => {
      d.feePkr = String(d.feePkr);
    }),
    fixtureDetects: true,
  },
  {
    name: "add newly required rating",
    contract: drifted((d) => {
      d.properties.rating = { type: "number" };
      d.required.push("rating");
    }),
    // A new field is stripped by zod, so only the generated-types check can see this one.
    fixture: fixtureWith((d) => {
      d.rating = 4.5;
    }),
    fixtureDetects: false,
  },
];

describe("contract drift is detected (SC-007)", () => {
  it("the unmodified contract passes both checks", async () => {
    expect(await generateTypes(readContract())).toBe(readCommittedTypes());
    expect(pageSchema(DoctorSchema).safeParse(readApiFixture("doctors")).success).toBe(true);
  });

  it.each(drifts)("$name", async ({ contract, fixture, fixtureDetects }) => {
    const checkOneDetects = (await generateTypes(contract)) !== readCommittedTypes();
    const checkFourDetects = !pageSchema(DoctorSchema).safeParse(fixture).success;
    expect(checkOneDetects, "check (1): committed types differ from the drifted contract").toBe(true);
    expect(checkFourDetects, "check (4): fixture fails its schema").toBe(fixtureDetects);
  });
});

/**
 * Same idea for the booking shapes (Feature 005): each drift is applied to a copy of the contract
 * (check 1: generated types change) and to a valid sample (check 4: the zod schema rejects it).
 */
type BookingDoc = { components: { schemas: Record<string, { required: string[]; properties: Record<string, unknown> }> } };

function bookingDrifted(schema: string, change: (s: BookingDoc["components"]["schemas"][string]) => void): BookingDoc {
  const doc = parse(readContract()) as BookingDoc;
  change(doc.components.schemas[schema]!);
  return doc;
}

const slot = { startsAt: "2026-10-06T05:00:00Z", endsAt: "2026-10-06T05:15:00Z", localTime: "10:00" };
const sample = {
  Slot: slot,
  SlotDay: { date: "2026-10-06", weekday: "tue", status: "available", slots: [slot] },
  DoctorSlots: {
    doctorSlug: "dr-omar-sheikh",
    timeZone: "Asia/Karachi",
    windowDays: 14,
    generatedAt: "2026-10-05T04:00:00Z",
    days: [{ date: "2026-10-06", weekday: "tue", status: "available", slots: [slot] }],
  },
  AppointmentView: {
    reference: "ABCDE-FGHJK",
    status: "confirmed",
    doctor: { slug: "dr-omar-sheikh", fullName: "Dr. Omar Sheikh", specialty: "Cardiology" },
    department: { slug: "cardiology", name: "Cardiology" },
    startsAt: "2026-10-06T05:00:00Z",
    endsAt: "2026-10-06T05:15:00Z",
    localDate: "2026-10-06",
    localTime: "10:00",
    timeZone: "Asia/Karachi",
    feePkr: 1500,
    patientNameMasked: "A**** K****",
    mobileMasked: "0300****567",
    isSample: true,
  },
  BookingConflict: { error: { code: "slot_taken", message: "Sorry, this slot was just taken.", requestId: "r1" } },
} as const;

const schemas = {
  Slot: SlotSchema,
  SlotDay: SlotDaySchema,
  DoctorSlots: DoctorSlotsSchema,
  AppointmentView: AppointmentViewSchema,
  BookingConflict: BookingConflictSchema,
};

describe("booking contract drift is detected", () => {
  it.each(Object.keys(schemas) as (keyof typeof schemas)[])("the unmodified %s sample parses", (name) => {
    expect(schemas[name].safeParse(sample[name]).success).toBe(true);
  });

  const typeDrifts: { name: string; schema: keyof typeof schemas; field: string }[] = [
    { name: "AppointmentView", schema: "AppointmentView", field: "feePkr" },
    { name: "Slot", schema: "Slot", field: "startsAt" },
    { name: "SlotDay", schema: "SlotDay", field: "status" },
    { name: "DoctorSlots", schema: "DoctorSlots", field: "windowDays" },
  ];

  it.each(typeDrifts)("$name: removed field", async ({ schema, field }) => {
    const doc = bookingDrifted(schema, (s) => {
      delete s.properties[field];
      s.required = s.required.filter((k) => k !== field);
    });
    const broken = structuredClone(sample[schema]) as Record<string, unknown>;
    delete broken[field];
    expect(await generateTypes(doc)).not.toBe(readCommittedTypes());
    expect(schemas[schema].safeParse(broken).success).toBe(false);
  });

  it.each(typeDrifts)("$name: renamed field", async ({ schema, field }) => {
    const doc = bookingDrifted(schema, (s) => {
      s.properties[`${field}X`] = s.properties[field];
      delete s.properties[field];
      s.required = s.required.map((k) => (k === field ? `${field}X` : k));
    });
    const broken = structuredClone(sample[schema]) as Record<string, unknown>;
    broken[`${field}X`] = broken[field];
    delete broken[field];
    expect(await generateTypes(doc)).not.toBe(readCommittedTypes());
    expect(schemas[schema].safeParse(broken).success).toBe(false);
  });

  it.each(typeDrifts)("$name: changed type", async ({ schema, field }) => {
    const doc = bookingDrifted(schema, (s) => {
      s.properties[field] = { type: "boolean" };
    });
    const broken = structuredClone(sample[schema]) as Record<string, unknown>;
    broken[field] = true;
    expect(await generateTypes(doc)).not.toBe(readCommittedTypes());
    expect(schemas[schema].safeParse(broken).success).toBe(false);
  });

  it.each(typeDrifts)("$name: newly required field", async ({ schema }) => {
    const doc = bookingDrifted(schema, (s) => {
      s.properties.rating = { type: "number" };
      s.required.push("rating");
    });
    // A new field is stripped by zod, so only the generated-types check can see this one.
    expect(await generateTypes(doc)).not.toBe(readCommittedTypes());
  });
});
