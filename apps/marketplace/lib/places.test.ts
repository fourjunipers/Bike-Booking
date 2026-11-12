import { describe, expect, it, vi } from "vitest";
import {
  createPlaces,
  createRateLimit,
  PLACE_CACHE_MS,
  PlacesError,
} from "./places";

const SESSION = "0b6b6c1e-3f4a-4b5c-9d6e-7f8091a2b3c4";
const PLACE = "ChIJ82ENKDJgHTERIEjiXbIAAQE";

function fakeFetch(...responses: Response[]) {
  return vi.fn<typeof fetch>(async () => responses.shift()!);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("autocomplete", () => {
  it("sends the session token and text, in any country, and reads suggestions", async () => {
    const fetchImpl = fakeFetch(
      json({
        suggestions: [
          {
            placePrediction: {
              placeId: PLACE,
              structuredFormat: {
                mainText: { text: "Chiang Mai International Airport" },
                secondaryText: { text: "Chiang Mai, Thailand" },
              },
            },
          },
          { queryPrediction: { text: { text: "chiang mai" } } },
        ],
      }),
    );
    const places = createPlaces({ apiKey: "k", fetchImpl });
    const out = await places.autocomplete(" chiang ", SESSION, "th");

    expect(out).toEqual([
      {
        placeId: PLACE,
        main: "Chiang Mai International Airport",
        secondary: "Chiang Mai, Thailand",
      },
    ]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    const body = JSON.parse(String(init!.body));
    expect(body).toEqual({
      input: "chiang",
      sessionToken: SESSION,
      languageCode: "th",
    });
    expect(body).not.toHaveProperty("includedRegionCodes");
    expect((init!.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(
      "k",
    );
  });

  it("refuses short text and missing session tokens without calling Google", async () => {
    const fetchImpl = fakeFetch();
    const places = createPlaces({ apiKey: "k", fetchImpl });
    await expect(places.autocomplete("ch", SESSION, "en")).rejects.toThrow(
      PlacesError,
    );
    await expect(places.autocomplete("chiang", "", "en")).rejects.toThrow(
      PlacesError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps errors: no key, quota reached, Google down", async () => {
    const kind = (p: Promise<unknown>) =>
      p.then(
        () => "ok",
        (e: PlacesError) => e.kind,
      );
    expect(
      await kind(
        createPlaces({ apiKey: undefined }).autocomplete(
          "bangkok",
          SESSION,
          "en",
        ),
      ),
    ).toBe("disabled");
    expect(
      await kind(
        createPlaces({
          apiKey: "k",
          fetchImpl: fakeFetch(
            json({ error: { status: "RESOURCE_EXHAUSTED" } }, 429),
          ),
        }).autocomplete("bangkok", SESSION, "en"),
      ),
    ).toBe("limit");
    expect(
      await kind(
        createPlaces({
          apiKey: "k",
          fetchImpl: fakeFetch(json({}, 500)),
        }).autocomplete("bangkok", SESSION, "en"),
      ),
    ).toBe("unavailable");
    expect(
      await kind(
        createPlaces({
          apiKey: "k",
          fetchImpl: vi.fn<typeof fetch>(async () => {
            throw new TypeError("network");
          }),
        }).autocomplete("bangkok", SESSION, "en"),
      ),
    ).toBe("unavailable");
  });
});

describe("location", () => {
  it("asks only for location (Essentials) on the same session token", async () => {
    const fetchImpl = fakeFetch(
      json({ location: { latitude: 18.7668, longitude: 98.9626 } }),
    );
    const places = createPlaces({ apiKey: "k", fetchImpl });
    expect(await places.location(PLACE, SESSION)).toEqual({
      lat: 18.7668,
      lng: 98.9626,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      `https://places.googleapis.com/v1/places/${PLACE}?sessionToken=${SESSION}`,
    );
    expect((init!.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe(
      "location",
    );
  });

  it("caches a place for a few hours, then asks again", async () => {
    let t = 0;
    const fetchImpl = fakeFetch(
      json({ location: { latitude: 1, longitude: 2 } }),
      json({ location: { latitude: 3, longitude: 4 } }),
    );
    const places = createPlaces({ apiKey: "k", fetchImpl, now: () => t });
    await places.location(PLACE, SESSION);
    t = PLACE_CACHE_MS - 1;
    expect(await places.location(PLACE, null)).toEqual({ lat: 1, lng: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t = PLACE_CACHE_MS + 1;
    expect(await places.location(PLACE, null)).toEqual({ lat: 3, lng: 4 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refuses odd place IDs", async () => {
    const places = createPlaces({ apiKey: "k", fetchImpl: fakeFetch() });
    await expect(places.location("../secret", SESSION)).rejects.toThrow(
      PlacesError,
    );
  });
});

describe("rate limit", () => {
  it("allows the limit per window, then refuses until the window resets", () => {
    const ok = createRateLimit(2, 1000);
    expect(ok("a", 0)).toBe(true);
    expect(ok("a", 1)).toBe(true);
    expect(ok("a", 2)).toBe(false);
    expect(ok("b", 2)).toBe(true);
    expect(ok("a", 1001)).toBe(true);
  });
});
