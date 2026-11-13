import { describe, expect, it } from "vitest";
import { DICT_KEYS } from "../i18n";

describe("translations", () => {
  it("Italian and English have exactly the same keys", () => {
    const it_ = new Set(DICT_KEYS.it);
    const en = new Set(DICT_KEYS.en);
    expect(DICT_KEYS.it.filter((k) => !en.has(k))).toEqual([]);
    expect(DICT_KEYS.en.filter((k) => !it_.has(k))).toEqual([]);
  });
});
