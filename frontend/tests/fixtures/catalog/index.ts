import { departments } from "./departments";
import { doctors } from "./doctors";
import { labTests } from "./labTests";

/** The catalog records that have their own page, for building the page manifest in tests. */
export const fixtureCatalog = { doctors, departments, labTests };
