import type { ArticleBlock, LegalContent, SiteConfig } from "@/types/content";

const paragraph = (text: string): ArticleBlock => ({ type: "paragraph", text });
const list = (...items: string[]): ArticleBlock => ({ type: "list", items });

/**
 * Privacy and Terms as a template a clinic adapts before use. The clinic's name and contact come
 * from its settings; nothing here is legal advice and nothing claims compliance or certification.
 * While the site runs on sample data (`isSample`), the demo-specific facts are shown as well.
 * Laws are named only in the "laws-by-country" section, as pointers for the clinic to check.
 */
export const LEGAL_LAST_UPDATED = "2026-11-07";

/** "at +92 21 0000 0001, Sample Road, Karachi, Pakistan, or the Contact page" from whatever the settings hold. */
function contactLine(site: SiteConfig): string {
  const parts = [site.generalPhone.display, site.address.join(", ")].filter((part) => part.trim() !== "");
  return parts.length > 0 ? `at ${parts.join(", ")}, or through the Contact page` : "through the Contact page";
}

function templateNotice(site: SiteConfig): string {
  return `Template: ${site.name} must check and adapt this page with a qualified legal adviser for each country it serves before relying on it.`;
}

export function buildPrivacyContent(site: SiteConfig): LegalContent {
  const demo = site.isSample
    ? [
        {
          id: "this-demo",
          heading: "What this demo collects",
          blocks: [
            paragraph(
              "This site is a portfolio demo with sample data. The booking form collects your name, your mobile number and, if you give them, an email address and a reason for the visit. They are used only to show you the demo booking.",
            ),
            paragraph("Demo bookings are deleted automatically 7 days after the appointment time."),
            paragraph("To stop abuse, a non-reversible network fingerprint (not your IP address) is kept in audit records for 90 days."),
            paragraph("No SMS or email is ever sent. Nobody will contact you."),
            paragraph(
              "The contact form still sends nothing: it checks what you type in your browser and then stops. There are no patient accounts and no payment forms.",
            ),
            paragraph("The demo sets no tracking cookies and uses no analytics."),
          ],
        },
      ]
    : [];

  return {
    slug: "privacy",
    title: "Privacy",
    lastUpdated: LEGAL_LAST_UPDATED,
    intro: site.isSample
      ? `${site.name} is a portfolio demo, not a real clinic, and this page is not legal advice. It is a plain-language privacy notice that a clinic can adapt, followed by what this demo actually does.`
      : `This notice explains in plain language how ${site.name} collects, uses and protects your personal and health information. It is not legal advice.`,
    templateNotice: templateNotice(site),
    sections: [
      {
        id: "who-we-are",
        heading: "Who we are",
        blocks: [
          paragraph(
            `${site.name} ("we") decides how your information on this website is used and is responsible for it. You can reach us ${contactLine(site)}.`,
          ),
        ],
      },
      ...demo,
      {
        id: "what-we-collect",
        heading: "What we collect",
        blocks: [
          paragraph("We collect only what we need to arrange and provide your care:"),
          list(
            "Contact details: your name, mobile number and, if you give it, an email address.",
            "Appointment details: the doctor, department, date and time, and the reason for the visit you choose to share.",
            "Health information that you or your doctor add for your care, such as lab test requests and their reports.",
            "Technical records needed to run the site safely, such as an abuse-prevention fingerprint and error logs with personal details removed.",
          ),
          paragraph("Health information is sensitive, so we handle it with extra care and only for your care."),
        ],
      },
      {
        id: "why-we-use-it",
        heading: "Why we use it",
        blocks: [
          list(
            "To book, change and remind you about appointments you ask for.",
            "To provide and record your care, as doctors and clinics are required to do.",
            "To meet legal duties, such as keeping medical and financial records.",
            "To keep the site safe and stop abuse.",
          ),
          paragraph(
            "We do not sell your information, and we do not use it for advertising. Where the law asks for your consent, we ask for it clearly, and you can withdraw it at any time.",
          ),
        ],
      },
      {
        id: "roles-and-what-they-can-see",
        heading: "Roles and what each can see",
        blocks: [
          paragraph("Staff see only what their job needs, and a patient sees only their own data. A clinic usually has these roles:"),
          list(
            "Patient: their own appointments, lab reports and details. Nobody else's.",
            "Receptionist: appointments and contact details needed to run the front desk, but not lab results.",
            "Doctor: the records of the patients they are caring for.",
            "Lab staff: lab test requests and the reports they prepare, but not unrelated medical history.",
            "Admin: settings and accounts for running the system, with access to health records limited and recorded.",
          ),
          paragraph(
            "Staff sign in to a private dashboard. Phone numbers are partly hidden on screen and on printed lists, and important actions are recorded in an activity log.",
          ),
        ],
      },
      {
        id: "lab-report-access",
        heading: "How lab reports are accessed",
        blocks: [
          paragraph(
            "A lab report can be opened only by the person it belongs to and by authorised staff who need it. Reports must never be reachable through a public link that anyone could open or share by accident.",
          ),
        ],
      },
      {
        id: "who-we-share-it-with",
        heading: "Who we share it with",
        blocks: [
          paragraph("We share your information only when we need to:"),
          list(
            "Service providers who host the website and database or help us find errors. They act on our instructions and may not use your information for their own purposes.",
            "Other healthcare providers, when you are referred or it is needed for your care.",
            "Authorities, when the law requires it.",
          ),
          paragraph(
            "The website and database of this system run on cloud servers in Singapore. When information moves between countries, we use the safeguards the law of your country asks for. Some countries expect health data to stay inside the country; a clinic must check this before going live.",
          ),
        ],
      },
      {
        id: "how-long-we-keep-it",
        heading: "How long we keep it",
        blocks: [
          paragraph(
            "We keep information only as long as we need it. Medical records are kept for the period the law and medical rules in our country require. Booking requests that never became a visit, and technical records, are deleted sooner.",
          ),
        ],
      },
      {
        id: "how-we-protect-it",
        heading: "How we protect it",
        blocks: [
          list(
            "Information travels over an encrypted connection (HTTPS).",
            "Staff accounts have strong passwords and sign-in protection, and each role sees only what it needs.",
            "Access to records and important changes is logged, so unusual access can be noticed.",
            "Personal details are removed from error reports and logs.",
          ),
          paragraph("No system can be perfectly safe. If a breach puts you at risk, we will tell you and the regulator when the law requires it."),
        ],
      },
      {
        id: "your-rights",
        heading: "Your rights",
        blocks: [
          paragraph("Depending on where you live, you can ask us to:"),
          list(
            "Show you the information we hold about you and give you a copy.",
            "Correct information that is wrong or incomplete.",
            "Delete information we no longer need, unless the law requires us to keep it.",
            "Limit or object to some uses, or withdraw consent you gave.",
          ),
          paragraph(
            `To ask, contact ${site.name} ${contactLine(site)}. We may need to confirm who you are first, and we will answer within the time the law sets. You can also complain to the data protection regulator in your country.`,
          ),
        ],
      },
      {
        id: "laws-by-country",
        heading: "Laws by country",
        blocks: [
          paragraph(
            "These are pointers for the clinic, not a full list. The clinic must confirm which rules apply to it and keep this page up to date.",
          ),
          list(
            "United Kingdom: the UK GDPR and the Data Protection Act 2018. Health data is special category data. Patients can complain to the Information Commissioner's Office.",
            "European Union: the GDPR, with the data protection authority of each country.",
            "United Arab Emirates: Federal Decree-Law No. 45 of 2021 on personal data, and Federal Law No. 2 of 2019 on technology in health fields, which limits storing health data outside the UAE. The DIFC and ADGM free zones have their own data protection laws.",
            "Saudi Arabia: the Personal Data Protection Law, supervised by the Saudi Data and Artificial Intelligence Authority (SDAIA), including rules on sending data abroad.",
            "Qatar, Bahrain, Oman and Kuwait: each has its own data protection rules that a clinic there must check.",
            "Pakistan: the Prevention of Electronic Crimes Act 2016 (PECA) makes unauthorised access to information systems and misuse of personal identity information offences. A general personal data protection law has been proposed; the clinic must check whether one is in force. Doctors' duty of confidentiality applies as well.",
          ),
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        blocks: [
          paragraph(
            "The public site sets no tracking cookies. Staff sign-in uses a necessary session cookie. Showing the map on the Contact page is optional and is off until you press Show map. When you do, your browser contacts OpenStreetMap, an outside map provider, to load the map. If you would rather not, leave the map hidden and use the text address.",
          ),
        ],
      },
      {
        id: "children",
        heading: "Children",
        blocks: [
          paragraph(
            "A parent or guardian should book for a child and give the child's details. We use a child's information only for their care, with the same protections as for adults.",
          ),
        ],
      },
      {
        id: "changes",
        heading: "Changes to this notice",
        blocks: [
          paragraph(
            "We may update this notice when our services or the law change. The date at the top shows when it was last updated. Important changes will be shown clearly on the site.",
          ),
        ],
      },
    ],
  };
}

export function buildTermsContent(site: SiteConfig): LegalContent {
  const demo = site.isSample
    ? [
        {
          id: "purpose-of-the-demo",
          heading: "Purpose of the demo",
          blocks: [
            paragraph(
              `${site.name} is a portfolio project that shows how a clinic and diagnostics website could look and work. It is not a real clinic, hospital or laboratory, and it does not offer any real healthcare service.`,
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
          id: "bookings-and-payments",
          heading: "Bookings and payments are not live",
          blocks: [
            paragraph(
              "You can make a demo booking with a sample doctor. It is not a real appointment and no one will contact you. You cannot pay for a test or receive a report through this demo.",
            ),
          ],
        },
      ]
    : [];

  return {
    slug: "terms",
    title: "Terms",
    lastUpdated: LEGAL_LAST_UPDATED,
    intro: site.isSample
      ? `These terms are for a portfolio demo called ${site.name}, written as a template a clinic can adapt. They are in plain language and are not legal advice. By using this site you agree to use it as the demo it is.`
      : `These terms explain the rules for using the ${site.name} website and booking appointments online. They are in plain language and are not legal advice. By using the site you agree to them.`,
    templateNotice: templateNotice(site),
    sections: [
      {
        id: "who-we-are",
        heading: "Who we are",
        blocks: [
          paragraph(
            `This website is run by ${site.name}. You can reach us ${contactLine(site)}. Our Privacy page explains how we handle your information.`,
          ),
        ],
      },
      ...demo,
      {
        id: "no-medical-advice",
        heading: "No medical advice",
        blocks: [
          paragraph(
            "Nothing on this site is medical advice, a diagnosis or a recommendation for treatment. The health tips are general information only. If you are worried about your health, please talk to a doctor. In an emergency, contact your local emergency services straight away; do not use online booking or the chat.",
          ),
        ],
      },
      {
        id: "booking-appointments",
        heading: "Booking appointments",
        blocks: [
          list(
            "Give your own correct details, or those of the person you are booking for with their permission.",
            "A booking is a request for a time with a doctor. The clinic may need to move or cancel it, for example if a doctor is unavailable, and will try to tell you as early as it can.",
            "If you cannot come, please cancel or change your booking as early as you can, so someone else can use the time.",
            "Fees shown on the site are a guide. The fee you pay is confirmed at the clinic, and payment is made there unless the clinic tells you otherwise.",
          ),
        ],
      },
      {
        id: "using-the-site",
        heading: "Using the site",
        blocks: [
          paragraph("You are welcome to use the site. Please:"),
          list(
            "Do not enter real personal or health information into the contact or booking forms of the demo.",
            "Do not try to disrupt the site, get into accounts that are not yours, or use it to harm others.",
            "Do not copy the site's content to present it as your own or as real.",
          ),
        ],
      },
      {
        id: "limits-of-responsibility",
        heading: "Limits of responsibility",
        blocks: [
          paragraph(
            "We work to keep the site accurate and available, but it is provided as it is, and doctors' times, fees and services can change. To the extent the law allows, we are not responsible for loss arising from using the site. Nothing in these terms limits rights that the law of your country does not allow to be limited.",
          ),
        ],
      },
      {
        id: "governing-law",
        heading: "Governing law",
        blocks: [
          paragraph(
            `These terms are governed by the law of the country where ${site.name} is registered, and its courts deal with any dispute, unless the law of your country gives you other rights.`,
          ),
        ],
      },
      {
        id: "changes",
        heading: "Changes to these terms",
        blocks: [
          paragraph("These terms may change as the site and our services change. The date at the top shows when they were last updated."),
        ],
      },
    ],
  };
}
