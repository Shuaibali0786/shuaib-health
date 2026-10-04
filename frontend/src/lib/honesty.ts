/**
 * Honesty text fixed by the constitution (Principle I), not by data. The demo notice and the author
 * credit are rendered from these constants everywhere, so an API or fallback value can never remove
 * or change them. A unit test pins them to the constitution text and checks the seed matches.
 */
export const DEMO_NOTICE = "Portfolio demo — not a real clinic, not medical advice.";

export const CREDIT = {
  text: "Designed & built by Shuaib Ali",
  href: "https://github.com/Shuaibali0786",
} as const;
