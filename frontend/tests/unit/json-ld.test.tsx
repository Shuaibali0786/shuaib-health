import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JsonLd } from "@/components/seo/JsonLd";

// A backslash, "u003c": what "<" becomes inside the script text.
const ESCAPED_LT = String.fromCharCode(92) + "u003c";

describe("JsonLd", () => {
  const hostile = { name: "</script><script>alert(1)</script>", note: "<!-- x -->", ok: "Dr. A & B" };

  it("never lets data close the script tag or open another", () => {
    const html = renderToStaticMarkup(<JsonLd data={hostile} />);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"))).not.toContain("<");
  });

  it("escapes < in the script text and still parses back to the same data", () => {
    const { container } = render(<JsonLd data={hostile} />);
    const script = container.querySelector('script[type="application/ld+json"]')!;
    expect(script.innerHTML).toContain(`${ESCAPED_LT}/script>`);
    expect(JSON.parse(script.textContent ?? "")).toEqual(hostile);
  });
});
