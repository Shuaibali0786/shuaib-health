import type { HealthTip } from "@/types/content";

/**
 * Sample general-wellbeing articles. Generic lifestyle text only: no
 * diagnosis, dosage or treatment claims. Every card shows a "Sample" badge.
 */
export const healthTips: HealthTip[] = [
  {
    id: "tip-staying-hydrated",
    slug: "staying-hydrated",
    title: "Small habits for staying hydrated",
    summary: "Simple ideas to help you drink enough water through a busy day.",
    category: "Nutrition",
    publishedAt: "2026-09-12T09:00:00+05:00",
    image: {
      src: "/images/tips/staying-hydrated-placeholder.jpg",
      alt: "Glass of water on a table (placeholder image)",
      width: 800,
      height: 500,
    },
    isSample: true,
  },
  {
    id: "tip-healthy-sleep-habits",
    slug: "healthy-sleep-habits",
    title: "A calmer routine for better sleep",
    summary: "A regular bedtime and a quiet, dim room can make winding down easier.",
    category: "Sleep",
    publishedAt: "2026-09-05T09:00:00+05:00",
    image: {
      src: "/images/tips/healthy-sleep-habits-placeholder.jpg",
      alt: "Calm bedroom with soft light (placeholder image)",
      width: 800,
      height: 500,
    },
    isSample: true,
  },
  {
    id: "tip-balanced-plate",
    slug: "balanced-plate",
    title: "Building a balanced plate",
    summary: "A simple way to think about vegetables, protein and grains at each meal.",
    category: "Nutrition",
    publishedAt: "2026-08-28T09:00:00+05:00",
    image: {
      src: "/images/tips/balanced-plate-placeholder.jpg",
      alt: "Balanced meal with vegetables (placeholder image)",
      width: 800,
      height: 500,
    },
    isSample: true,
  },
  {
    id: "tip-daily-walk",
    slug: "daily-walk",
    title: "Adding a short daily walk",
    summary: "Ten minutes of walking is an easy way to add more movement to your day.",
    category: "Activity",
    publishedAt: "2026-08-14T09:00:00+05:00",
    image: {
      src: "/images/tips/daily-walk-placeholder.jpg",
      alt: "Person walking in a park (placeholder image)",
      width: 800,
      height: 500,
    },
    isSample: true,
  },
];
