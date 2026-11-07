import { CalendarCheck, LayoutDashboard, QrCode } from "lucide-react";

import { Breadcrumbs, type Crumb } from "@/components/layout/Breadcrumbs";
import { Container } from "@/components/layout/Container";
import { DemoDashboardButton } from "@/components/demo/DemoDashboardButton";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/IconTile";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { ROUTES } from "@/lib/routes";
import { SAMPLE_EMAIL, SAMPLE_PHONE, monogram, type SpecialtyPreset } from "@/presets/specialties";

import { PresetSwitcher } from "./PresetSwitcher";

const SLOTS = ["10:00", "10:30", "11:15", "12:00", "16:30", "17:15"];

function PreviewLabel() {
  return <span className="preset-preview-label rounded-pill px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em]">Preview</span>;
}

/**
 * One specialty preset, rendered from data (Feature 009, ADR-0012): the clinic's first screen, its
 * services and doctors, then previews of booking, the slip and the Command Centre. Every preset uses this
 * same component; only the data and the `data-preset` theme differ.
 */
export function PresetShowcase({ preset, trail }: { preset: SpecialtyPreset; trail: Crumb[] }) {
  const sampleRef = `SH-${preset.id.slice(0, 2).toUpperCase()}7K2Q`;
  const firstService = preset.services[0];
  const firstDoctor = preset.doctors[0];
  return (
    <div data-preset={preset.id} className="preset-scope">
      <section aria-labelledby="preset-title" className="preset-hero">
        <Container className="py-8 md:py-12">
          <Breadcrumbs items={trail} className="mb-5" />
          <p className="mb-2 text-sm font-semibold text-muted">Choose your specialty — the same system, dressed for your clinic.</p>
          <PresetSwitcher current={preset.id} />
          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div className="min-w-0">
              <p className="preset-eyebrow mb-3 text-[0.8125rem] font-semibold uppercase tracking-[0.08em]">{preset.eyebrow}</p>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="preset-monogram inline-flex size-12 items-center justify-center rounded-full text-lg font-bold" aria-hidden="true">
                  {monogram(preset.clinicName)}
                </span>
                <span className="text-lg font-semibold text-navy-900">{preset.clinicName}</span>
                <SampleBadge label="Sample clinic" />
              </div>
              <h1 id="preset-title" className="text-[2.1rem] font-extrabold md:text-5xl lg:leading-[1.1]">
                {preset.tagline}
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted">{preset.intro}</p>
              <p className="mt-3 text-sm text-muted">
                Open {preset.hours} · {SAMPLE_PHONE} · {SAMPLE_EMAIL}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button href={ROUTES.bookAppointment} variant="primary">
                  Try online booking
                </Button>
                <DemoDashboardButton className="inline-flex min-h-11 items-center justify-center rounded-control border-2 border-navy-900 bg-white px-5 py-2.5 font-semibold text-navy-900 hover:bg-surface">
                  Open the demo dashboard
                </DemoDashboardButton>
              </div>
            </div>
            <div className="preset-photo relative overflow-hidden rounded-card shadow-soft">
              <ImageWithFallback image={preset.heroImage} priority sizes="(min-width: 1024px) 45vw, 100vw" className="max-h-[28rem] object-cover" />
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="preset-services" className="py-12">
        <Container>
          <h2 id="preset-services" className="text-2xl font-bold md:text-3xl">
            Services
          </h2>
          <p className="mt-2 text-muted">Sample services and prices for this specialty.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {preset.services.map((service) => (
              <li key={service.name} className="flex gap-4 rounded-card border border-border bg-white p-5 shadow-soft">
                <IconTile name={service.icon} tint="preset-tint" />
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">{service.name}</h3>
                  <p className="text-sm text-muted">{service.blurb}</p>
                  <p className="preset-price mt-1 text-sm font-semibold">{service.price}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="preset-doctors" className="bg-surface py-12">
        <Container>
          <h2 id="preset-doctors" className="text-2xl font-bold md:text-3xl">
            Your team
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {preset.doctors.map((doctor) => (
              <li key={doctor.name} className="flex items-center gap-4 rounded-card border border-border bg-white p-5 shadow-soft">
                <span className="preset-monogram inline-flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-bold" aria-hidden="true">
                  {monogram(doctor.name)}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">{doctor.name}</h3>
                  <p className="text-sm text-muted">{doctor.role}</p>
                  <p className="text-sm text-muted">{doctor.days}</p>
                  <SampleBadge className="mt-1" label="Sample profile" />
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="preset-previews" className="py-12">
        <Container>
          <h2 id="preset-previews" className="text-2xl font-bold md:text-3xl">
            How it works for {preset.label.toLowerCase()} clinics
          </h2>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <article aria-labelledby="pv-booking" className="rounded-card border border-border bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <h3 id="pv-booking" className="flex items-center gap-2 text-lg font-semibold">
                  <CalendarCheck className="preset-icon size-5" aria-hidden="true" /> Online booking
                </h3>
                <PreviewLabel />
              </div>
              <ol className="mt-4 space-y-3 text-sm">
                <li>
                  <span className="text-muted">1. Service</span>
                  <div className="preset-chosen mt-1 rounded-control px-3 py-2 font-semibold">{firstService?.name}</div>
                </li>
                <li>
                  <span className="text-muted">2. Specialist</span>
                  <div className="mt-1 rounded-control border border-border px-3 py-2">{firstDoctor?.name} · {firstDoctor?.role}</div>
                </li>
                <li>
                  <span className="text-muted">3. Time</span>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {SLOTS.map((slot, index) => (
                      <span key={slot} className={index === 1 ? "preset-chosen rounded-control px-2 py-1.5 text-center font-semibold" : "rounded-control border border-border px-2 py-1.5 text-center"}>
                        {slot}
                      </span>
                    ))}
                  </div>
                </li>
              </ol>
              <Button href={ROUTES.bookAppointment} variant="outline" size="sm" className="mt-5">
                Try the real booking
              </Button>
            </article>

            <article aria-labelledby="pv-slip" className="rounded-card border border-border bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <h3 id="pv-slip" className="flex items-center gap-2 text-lg font-semibold">
                  <QrCode className="preset-icon size-5" aria-hidden="true" /> Booking slip
                </h3>
                <PreviewLabel />
              </div>
              <div className="preset-slip mt-4 rounded-card p-4 text-sm">
                <p className="text-lg font-bold">{preset.clinicName}</p>
                <p className="text-muted">{preset.visitWord} confirmed</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted">Reference</dt>
                  <dd className="font-mono font-semibold">{sampleRef}</dd>
                  <dt className="text-muted">With</dt>
                  <dd>{firstDoctor?.name}</dd>
                  <dt className="text-muted">Time</dt>
                  <dd>Tomorrow, 10:30</dd>
                  <dt className="text-muted">Phone</dt>
                  <dd>{SAMPLE_PHONE}</dd>
                </dl>
                <p className="mt-3 text-xs text-muted">PDF, QR code and a share link in the real flow.</p>
              </div>
            </article>

            <article aria-labelledby="pv-dash" className="rounded-card border border-border bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <h3 id="pv-dash" className="flex items-center gap-2 text-lg font-semibold">
                  <LayoutDashboard className="preset-icon size-5" aria-hidden="true" /> Command Centre
                </h3>
                <PreviewLabel />
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Today", "Agenda by doctor"],
                  ["Bookings", "Search, filter, status"],
                  ["Insights", "7 / 30 / 90-day charts"],
                  ["Activity", "Audit log for admins"],
                ].map(([title, text]) => (
                  <li key={title} className="rounded-control border border-border p-3">
                    <p className="font-semibold">{title}</p>
                    <p className="text-muted">{text}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">The demo dashboard uses one shared sample clinic for every specialty.</p>
              <div className="mt-4"><DemoDashboardButton className="inline-flex min-h-11 items-center justify-center rounded-control border-2 border-navy-900 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-surface">
                  Open the demo dashboard
                </DemoDashboardButton></div>
            </article>
          </div>
        </Container>
      </section>
    </div>
  );
}
