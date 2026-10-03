/**
 * Layout classes for the department cards, shared by Home and /departments.
 *
 * Phones and tablets keep a two-column grid. From lg the list becomes a centred, wrapping row, so a
 * short last row (7 cards make 3 + 3 + 1 on lg and 4 + 3 on xl) sits in the middle instead of
 * hugging the left edge. Card widths are worked out from the 1.25 rem gap: three across is
 * (100% - 2 gaps) / 3 and four across is (100% - 3 gaps) / 4.
 */
export const DEPARTMENT_LIST = "grid grid-cols-2 gap-3 sm:gap-5 lg:flex lg:flex-wrap lg:justify-center";

export const DEPARTMENT_ITEM = "flex lg:w-[calc((100%-2.5rem)/3)] xl:w-[calc((100%-3.75rem)/4)]";
