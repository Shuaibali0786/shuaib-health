import { Container } from "@/components/layout/Container";
import { getSiteConfig } from "@/lib/content";

/** Thin demo notice at the top of every page (constitution I). White on navy-900 is 15.4:1. Not sticky. */
export async function NoticeBar() {
  const { demoNotice } = await getSiteConfig();
  return (
    <div className="bg-navy-900 text-white">
      <Container className="py-1.5 text-center text-[0.8125rem] leading-snug">
        <p>{demoNotice}</p>
      </Container>
    </div>
  );
}
