// Stand-in for `@/lib/api/cached` in unit tests: serves the sample catalog fixtures so content
// accessors and server components can run without Next's data cache or a network.
// Use it as: vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);
import { departments } from "../../fixtures/catalog/departments";
import { doctors } from "../../fixtures/catalog/doctors";
import { healthPackages } from "../../fixtures/catalog/healthPackages";
import { labTestCategories, labTests } from "../../fixtures/catalog/labTests";

const unused = (name: string) => async () => {
  throw new Error(`${name} is not part of the catalog fixtures`);
};

export const catalogApiMock = {
  CATALOG_REVALIDATE: 300,
  cachedClinic: unused("cachedClinic"),
  cachedClinicRules: unused("cachedClinicRules"),
  cachedDepartments: async () => departments,
  cachedDoctors: async () => doctors,
  cachedLabTestCategories: async () => labTestCategories,
  cachedLabTests: async () => labTests,
  cachedHealthPackages: async () => healthPackages,
};
