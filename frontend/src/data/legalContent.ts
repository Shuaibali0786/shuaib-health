import type { ArticleBlock, LegalContent } from "@/types/content";

const paragraph = (text: string): ArticleBlock => ({ type: "paragraph", text });
const list = (...items: string[]): ArticleBlock => ({ type: "list", items });

/**
 * Plain-language Privacy and Terms for the portfolio demo (FR-077 to FR-079). They say what the
 * demo does today, and describe what a real version would have to do. They are not legal advice
 * and do not claim any certification or compliance.
 */
export const LEGAL_LAST_UPDATED = "2026-10-02";

export const privacyContent: LegalContent = {
  slug: "privacy",
  title: "Privacy",
  lastUpdated: LEGAL_LAST_UPDATED,
  intro:
    "Shuaib Health is a portfolio demo, not a real clinic, and this page is not legal advice. It explains in plain language what this demo does with your information, and what a real version of a clinic website would need to do.",
  sections: [
    {
      id: "this-demo",
      heading: "What this demo collects",
      blocks: [
        paragraph(
          "The booking form collects your name, your mobile number and, if you give them, an email address and a reason for the visit. They are used only to show you the demo booking.",
        ),
        paragraph("Demo bookings are deleted automatically 7 days after the appointment time."),
        paragraph(
          "To stop abuse, a non-reversible network fingerprint (not your IP address) is kept in audit records for 90 days.",
        ),
        paragraph("No SMS or email is ever sent. Nobody will contact you."),
        paragraph(
          "The contact form still sends nothing: it checks what you type in your browser and then stops. There are no accounts and no payment forms.",
        ),
        paragraph("The demo sets no tracking cookies and uses no analytics."),
      ],
    },
    {
      id: "data-a-real-app-would-collect",
      heading: "Data a real app would collect",
      blocks: [
        paragraph("A real clinic app would need to hold some personal and health information, and it should collect only what it needs. For example:"),
        list(
          "Contact details, such as your name, phone number and email address.",
          "Appointment details, such as the doctor, the date and the reason for the visit.",
          "Lab test requests and the reports that come from them.",
          "Payment records, kept separate from health information.",
        ),
      ],
    },
    {
      id: "how-health-data-would-be-protected",
      heading: "How health data would be protected",
      blocks: [
        paragraph("Health information is sensitive. A real version would protect it in several ways, none of which exist in this demo:"),
        list(
          "Data would travel over an encrypted connection and be stored in a protected database.",
          "People would sign in, and each person would see only what their role needs.",
          "Access to health records would be logged, so unusual access could be noticed.",
          "Data would be kept only as long as it is needed.",
        ),
      ],
    },
    {
      id: "roles-and-what-they-can-see",
      heading: "Roles and what each can see",
      blocks: [
        paragraph("A real version would have five kinds of users. Each would see only what the job needs, and a patient sees only their own data."),
        list(
          "Patient: their own appointments, lab reports and details. Nobody else's.",
          "Receptionist: appointments and contact details needed to run the front desk, but not lab results.",
          "Doctor: the records of the patients they are caring for.",
          "Lab staff: lab test requests and the reports they prepare, but not unrelated medical history.",
          "Admin: settings and accounts for running the system, with access to health records limited and recorded.",
        ),
      ],
    },
    {
      id: "lab-report-access",
      heading: "How lab reports would be accessed",
      blocks: [
        paragraph(
          "In a real version, a lab report could be opened only by the person it belongs to and by authorised staff who need it. Reports would never be reachable through a public link that anyone could open or share by accident. This demo has no reports at all.",
        ),
      ],
    },
    {
      id: "cookies",
      heading: "Cookies",
      blocks: [
        paragraph(
          "This demo sets no tracking cookies. Showing the map on the Contact page is optional and is off until you press Show map. When you do, your browser contacts OpenStreetMap, an outside map provider, to load the map. If you would rather not, leave the map hidden and use the text address.",
        ),
      ],
    },
    {
      id: "questions",
      heading: "Questions",
      blocks: [
        paragraph(
          "This is a demo, so there is nobody to answer privacy requests. For a real clinic, this page would say who to contact and how to ask to see, correct or delete your data.",
        ),
      ],
    },
  ],
};

export const termsContent: LegalContent = {
  slug: "terms",
  title: "Terms",
  lastUpdated: LEGAL_LAST_UPDATED,
  intro:
    "These terms are for a portfolio demo called Shuaib Health. They are written in plain language, and they are not legal advice. By using this site you agree to use it as the demo it is.",
  sections: [
    {
      id: "purpose-of-the-demo",
      heading: "Purpose of the demo",
      blocks: [
        paragraph(
          "Shuaib Health is a portfolio project that shows how a clinic and diagnostics website could look and work. It is not a real clinic, hospital or laboratory, and it does not offer any real healthcare service.",
        ),
      ],
    },
    {
      id: "sample-content",
      heading: "Sample content",
      blocks: [
        paragraph(
          "Everything on the site is sample content made up for the demo: doctors, schedules, fees, lab tests, prices, packages, articles, addresses and phone numbers. Names may match real people by chance. Photos are stock photos of models or illustrative images, not our staff or facilities. Sample items are labelled as samples where they appear.",
        ),
      ],
    },
    {
      id: "no-medical-advice",
      heading: "No medical advice",
      blocks: [
        paragraph(
          "Nothing on this site is medical advice, a diagnosis or a recommendation for treatment. The health tips are general information only. If you are worried about your health, please talk to a doctor. In an emergency, contact your local emergency services; the phone numbers on this site do not connect to anyone.",
        ),
      ],
    },
    {
      id: "using-the-site",
      heading: "Using the site",
      blocks: [
        paragraph("You are welcome to browse the demo. Please:"),
        list(
          "Do not enter real personal or health information into the contact or booking forms.",
          "Do not try to disrupt the site or use it to harm others.",
          "Do not present the sample content as real.",
        ),
      ],
    },
    {
      id: "bookings-and-payments",
      heading: "Bookings and payments are not live",
      blocks: [
        paragraph(
          "You can make a demo booking with a sample doctor. It is not a real appointment and no one will contact you. You cannot pay for a test or receive a report through this demo.",
        ),
      ],
    },
    {
      id: "limits-of-responsibility",
      heading: "Limits of responsibility",
      blocks: [
        paragraph(
          "The demo is provided as it is, with no promise that it is complete, accurate or always available. Because it is sample content, you should not rely on it for any decision about your health or money. To the extent the law allows, the maker of the demo is not responsible for loss arising from using it.",
        ),
        paragraph("These terms may change as the demo changes. The date at the top shows when they were last updated."),
      ],
    },
  ],
};

export const legalContent: Record<"privacy" | "terms", LegalContent> = {
  privacy: privacyContent,
  terms: termsContent,
};
