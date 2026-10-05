import { clinicImage } from "@/data/homeContent";
import type { AboutContent, ImageAsset } from "@/types/content";

function departmentPhoto(slug: string, alt: string): ImageAsset {
  return { src: `/images/departments/${slug}.jpg`, alt, width: 800, height: 600 };
}

/**
 * The honest About page. It says plainly that Shuaib Health is a portfolio demo, and it contains
 * no founding date, history, staff or patient numbers, awards, accreditations or testimonials.
 * Photos are existing stock images, each captioned "Illustrative image ...".
 */
export const aboutContent: AboutContent = {
  mission:
    "To show what a clear, calm and honest clinic website can look like: easy to find a doctor, easy to understand a lab test, and always clear about what is real and what is not.",
  story: [
    "Shuaib Health is a portfolio demo. It is not a real clinic, hospital or laboratory, and nothing on this site is medical advice. The doctors, prices, schedules, packages, articles and contact details are all invented samples, and each one is labelled as such.",
    "The site was built to practise designing a healthcare website that visitors can trust at a glance: plain language, large readable text, keyboard-friendly pages and no hidden claims. It is the front end only for now. There is no booking system, no patient accounts and no online reports yet.",
    "Because nothing here is real, you will not find a founding story, headcounts or quotes from patients. We would rather leave those out than invent them.",
  ],
  values: [
    {
      id: "value-honesty",
      title: "Honesty first",
      text: "Sample content is always labelled as sample. We do not invent statistics, praise or credentials.",
    },
    {
      id: "value-clarity",
      title: "Clear language",
      text: "Pages say what a test is for, how to prepare and what happens next, in plain words.",
    },
    {
      id: "value-access",
      title: "Easy for everyone",
      text: "Readable text, strong contrast, large tap targets and pages that work with a keyboard and on small phones.",
    },
    {
      id: "value-privacy",
      title: "Respect for privacy",
      text: "This demo keeps booking details only until 7 days after the appointment time, and sets no tracking cookies.",
    },
  ],
  facilityPhotos: [
    { image: clinicImage, caption: "Illustrative image of a clinic reception. Not our actual facility." },
    {
      image: departmentPhoto("general-medicine", "Doctor reviewing a folder with a patient in a consultation room"),
      caption: "Illustrative image of a consultation room. Not our actual facility.",
    },
    {
      image: departmentPhoto("pathology-lab", "Laboratory scientist in a blue gown using a microscope"),
      caption: "Illustrative image of a laboratory. Not our actual facility.",
    },
    {
      image: departmentPhoto("dental", "Two dental staff reviewing an X-ray on a screen beside a dental chair"),
      caption: "Illustrative image of a dental room. Not our actual facility.",
    },
  ],
  visitSteps: [
    {
      id: "step-find",
      title: "Find a doctor or a test",
      text: "Browse the doctors, departments and lab tests, and see schedules, preparation and sample prices.",
      iconName: "stethoscope",
    },
    {
      id: "step-book",
      title: "Book",
      text: "Online booking works as a demo with sample doctors; bookings are not real.",
      iconName: "calendar-check",
    },
    {
      id: "step-visit",
      title: "Visit, or choose home collection",
      text: "A real clinic would see you at the clinic or collect a sample at home. Both are described here for illustration only.",
      iconName: "house",
    },
    {
      id: "step-reports",
      title: "Receive reports online",
      text: "Online reports are planned for a later version. Nothing is sent or stored in this demo.",
      iconName: "file-text",
    },
    {
      id: "step-follow-up",
      title: "Follow up",
      text: "Talk to your doctor about your results and next steps. A website cannot replace that conversation.",
      iconName: "clipboard-check",
    },
  ],
};
