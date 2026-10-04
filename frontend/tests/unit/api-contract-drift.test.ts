import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { DoctorSchema, pageSchema } from "@/lib/api/schemas";

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
