// The booking flow keeps its non-personal choices in the URL, so Back works and a doctor page can
// pre-select. Only slugs, a date, a time and the step name are ever written (FR-051): never a name,
// mobile number, email or reason.

export const FLOW_STEPS = ["department", "doctor", "date", "time", "details"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

export interface FlowParams {
  department?: string;
  doctor?: string;
  date?: string;
  time?: string;
  step: FlowStep;
}

export interface FlowCatalog {
  departments: { id: string; slug: string }[];
  doctors: { slug: string; departmentId: string }[];
}

type SearchParamsLike = { get(name: string): string | null };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validDate(value: string | null): value is string {
  const match = value === null ? null : DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const real = new Date(Date.UTC(year, month - 1, day));
  return real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === day;
}

/**
 * Reads the flow from the URL, dropping anything the catalog does not know or that is malformed.
 * The step is the deepest one the choices allow; an earlier `step` (Back) is honoured.
 */
export function parseFlowParams(searchParams: SearchParamsLike, catalog: FlowCatalog): FlowParams {
  let department = catalog.departments.find((candidate) => candidate.slug === searchParams.get("department")) ?? undefined;
  let doctor = catalog.doctors.find((candidate) => candidate.slug === searchParams.get("doctor")) ?? undefined;

  if (doctor && department && doctor.departmentId !== department.id) doctor = undefined;
  if (doctor && !department) department = catalog.departments.find((candidate) => candidate.id === doctor?.departmentId);

  const dateParam = searchParams.get("date");
  const timeParam = searchParams.get("time");
  const date = doctor && validDate(dateParam) ? dateParam : undefined;
  const time = date && timeParam !== null && TIME.test(timeParam) ? timeParam : undefined;

  const deepest: FlowStep = !department ? "department" : !doctor ? "doctor" : !date ? "date" : !time ? "time" : "details";
  const requested = FLOW_STEPS.find((candidate) => candidate === searchParams.get("step"));
  const step = requested && FLOW_STEPS.indexOf(requested) < FLOW_STEPS.indexOf(deepest) ? requested : deepest;

  const params: FlowParams = { step };
  if (department) params.department = department.slug;
  if (doctor) params.doctor = doctor.slug;
  if (date) params.date = date;
  if (time) params.time = time;
  return params;
}

/** `?department=…&doctor=…&date=…&time=…&step=…`, in that order, with only the keys that are set. */
export function serializeFlowParams(params: FlowParams): string {
  const parts: string[] = [];
  const add = (key: string, value: string | undefined) => {
    if (value) parts.push(`${key}=${encodeURIComponent(value).replace(/%3A/gi, ":")}`);
  };
  add("department", params.department);
  add("doctor", params.doctor);
  add("date", params.date);
  add("time", params.time);
  add("step", params.step);
  return `?${parts.join("&")}`;
}
