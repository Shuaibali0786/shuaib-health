import type { FaqGroup } from "@/types/content";

/**
 * Sample FAQ for the demo. Answers never claim a live service: booking, online payment and the
 * report portal are described as planned, and home collection is described as a sample service.
 * The group slugs are anchors (/faq#home-sample-collection); the Home quick action links to one.
 */
export const faqGroups: FaqGroup[] = [
  {
    id: "faq-appointments",
    slug: "appointments",
    title: "Appointments",
    items: [
      {
        id: "faq-appointments-book",
        question: "How do I book an appointment?",
        answer:
          "Online booking is planned but not available in this demo yet. The Book appointment buttons lead to a holding page. You can already browse the sample doctors and their weekly schedules.",
      },
      {
        id: "faq-appointments-schedule",
        question: "Where can I see when a doctor is available?",
        answer:
          "Each sample doctor's page shows a weekly schedule in Asia/Karachi time, and the Doctors list can be filtered by the day a doctor sits. All schedules are samples.",
      },
      {
        id: "faq-appointments-change",
        question: "Can I change or cancel an appointment?",
        answer:
          "There are no real appointments in this demo, so there is nothing to change or cancel. A live version would let you do both from your account.",
      },
      {
        id: "faq-appointments-hours",
        question: "What are the clinic hours?",
        answer: "The sample clinic is open Monday to Saturday, 9 AM to 9 PM (Pakistan time), and closed on Sundays. The lab has its own sample hours, shown on the Contact page.",
      },
      {
        id: "faq-appointments-emergency",
        question: "What should I do in an emergency?",
        answer:
          "This demo cannot help in an emergency and its phone numbers do not connect. If you or someone else needs urgent care, contact your local emergency services or go to the nearest emergency department.",
      },
    ],
  },
  {
    id: "faq-lab-tests-reports",
    slug: "lab-tests-reports",
    title: "Lab tests & reports",
    items: [
      {
        id: "faq-lab-find",
        question: "How do I find a lab test?",
        answer: "Use the Lab Tests page to search by test name or an alternative name such as HbA1c or CBC, or choose a category. Each test has its own page.",
      },
      {
        id: "faq-lab-prepare",
        question: "Do I need to prepare for a test?",
        answer:
          "Some tests ask you to fast, and others need no preparation. The preparation for each sample test is shown on its page. Always follow your doctor's instructions about preparation.",
      },
      {
        id: "faq-lab-reports-time",
        question: "How long do reports take?",
        answer: "Each test page shows a sample report time, for example the same day. These times are samples and are not a promise.",
      },
      {
        id: "faq-lab-reports-online",
        question: "Can I get my reports online?",
        answer:
          "An online report portal is planned for a later version. In this demo no reports exist and nothing is stored. In a live version, only you and authorised staff would be able to open your reports.",
      },
      {
        id: "faq-lab-results",
        question: "Will you explain what my results mean?",
        answer: "This website does not explain results. Your doctor is the right person to do that, so please discuss your reports with them.",
      },
    ],
  },
  {
    id: "faq-payments",
    slug: "payments",
    title: "Payments",
    items: [
      {
        id: "faq-payments-prices",
        question: "Are the prices real?",
        answer: "No. Every fee and price on this site is an invented sample, and each one is labelled as a sample price.",
      },
      {
        id: "faq-payments-online",
        question: "Can I pay online?",
        answer: "Online payment is planned but not available. This demo takes no payments and asks for no card or bank details.",
      },
      {
        id: "faq-payments-packages",
        question: "How do health package prices work?",
        answer:
          "A package price is a sample price for a set of tests. The Health Packages page shows the tests added up one by one, the package price and the difference in PKR.",
      },
      {
        id: "faq-payments-receipts",
        question: "Will I get a receipt?",
        answer: "There are no real payments here, so no receipts are issued. A live version would provide them.",
      },
    ],
  },
  {
    id: "faq-home-sample-collection",
    slug: "home-sample-collection",
    title: "Home sample collection",
    items: [
      {
        id: "faq-home-what",
        question: "What is home sample collection?",
        answer:
          "It is a service where a trained person collects a sample, such as blood, at your home instead of you visiting the lab. In this demo it is a sample service described for illustration; nobody will come to your door.",
      },
      {
        id: "faq-home-which",
        question: "Which tests can be collected at home?",
        answer: "Most sample tests allow it, and each test page says Home collection Yes or No. A few tests, such as urine culture, are collected at the lab.",
      },
      {
        id: "faq-home-hours",
        question: "When would collection happen?",
        answer: "Sample lab hours are Monday to Saturday, 8 AM to 8 PM (Pakistan time), and sample collection would end when the lab closes.",
      },
      {
        id: "faq-home-prepare",
        question: "How do I prepare for a home visit?",
        answer: "Follow the preparation shown on the test page, for example fasting. Keep the doctor's request or the test name ready, and make sure someone is at home.",
      },
    ],
  },
  {
    id: "faq-privacy",
    slug: "privacy",
    title: "Privacy",
    items: [
      {
        id: "faq-privacy-collect",
        question: "Does this demo collect my personal data?",
        answer:
          "No. The contact form checks what you type in your browser, shows a message, and then stops. Nothing is sent, saved or stored, and no tracking cookies are set.",
      },
      {
        id: "faq-privacy-health",
        question: "How would health data be protected in a real version?",
        answer:
          "A live version would limit who can see health data, so a patient sees only their own records, and it would keep reports private. The Privacy page describes the plan in more detail.",
      },
      {
        id: "faq-privacy-map",
        question: "Does the map track me?",
        answer: "The map is off until you press Show map. Showing it contacts OpenStreetMap, an outside map provider, which then sees your request. If you prefer not to, leave it hidden and use the text address.",
      },
      {
        id: "faq-privacy-more",
        question: "Where can I read more?",
        answer: "The Privacy and Terms pages explain how this demo handles information and what it does and does not offer.",
      },
    ],
  },
];
