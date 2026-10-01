import { describe, expect, it } from "vitest";
import { toWebcalUrl } from "./ical-link";

describe("toWebcalUrl", () => {
  it("https -> webcal", () => {
    expect(toWebcalUrl("https://u-scout-production.up.railway.app/api/ical/abc.ics")).toBe(
      "webcal://u-scout-production.up.railway.app/api/ical/abc.ics",
    );
  });

  it("http -> webcal y sin distinguir mayúsculas", () => {
    expect(toWebcalUrl("HTTP://localhost:3000/api/ical/abc.ics")).toBe("webcal://localhost:3000/api/ical/abc.ics");
  });

  it("no toca una URL que ya es webcal", () => {
    expect(toWebcalUrl("webcal://x.test/a.ics")).toBe("webcal://x.test/a.ics");
  });

  it("solo sustituye el esquema, no el resto de la ruta", () => {
    expect(toWebcalUrl("https://x.test/p?next=https://y.test")).toBe("webcal://x.test/p?next=https://y.test");
  });
});
