/**
 * Unit tests for the pure MCQ domain logic.
 * Run with:  npx vitest run
 */
import { describe, expect, it } from "vitest";
import {
  answerLetters,
  buildMcq,
  csvField,
  isValidMcq,
  letter,
  parseJsonImport,
  shuffle,
  toCsv,
  toJsonEnvelope,
  validateDraft,
  type Draft,
  type Mcq,
} from "./mcq";

/** A draft that is intentionally valid — tests mutate copies of it. */
function validDraft(): Draft {
  return {
    question: "Which planet has the most moons?",
    mode: "single",
    options: [
      { id: "a", text: "Mars" },
      { id: "b", text: "Saturn" },
      { id: "c", text: "Venus" },
    ],
    correctIds: ["b"],
    shuffle: false,
    explanation: "",
  };
}

describe("letter()", () => {
  it("maps indexes to uppercase letters", () => {
    expect(letter(0)).toBe("A");
    expect(letter(7)).toBe("H");
    expect(letter(25)).toBe("Z");
  });
});

describe("validateDraft()", () => {
  it("accepts a valid draft", () => {
    expect(validateDraft(validDraft())).toEqual([]);
  });

  it("requires question text", () => {
    const d = { ...validDraft(), question: "   " };
    expect(validateDraft(d).some((i) => i.field === "question")).toBe(true);
  });

  it("rejects empty options", () => {
    const d = validDraft();
    d.options[1].text = "  ";
    const issues = validateDraft(d);
    expect(issues.some((i) => i.field === `option-b`)).toBe(true);
  });

  it("rejects duplicate option text (case-insensitive)", () => {
    const d = validDraft();
    d.options[2].text = "mars";
    expect(validateDraft(d).some((i) => i.message.includes("duplicates"))).toBe(true);
  });

  it("requires a correct answer", () => {
    const d = { ...validDraft(), correctIds: [] };
    expect(validateDraft(d).some((i) => i.field === "correct")).toBe(true);
  });

  it("rejects multiple correct answers in single mode", () => {
    const d = { ...validDraft(), correctIds: ["a", "b"] };
    expect(validateDraft(d).length).toBeGreaterThan(0);
    const multi = { ...d, mode: "multiple" as const };
    expect(validateDraft(multi)).toEqual([]);
  });

  it("rejects fewer than two options", () => {
    const d = validDraft();
    d.options = d.options.slice(0, 1);
    d.correctIds = ["a"];
    expect(validateDraft(d).some((i) => i.field === "options")).toBe(true);
  });
});

describe("shuffle()", () => {
  it("is a permutation, not a mutation", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src);
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]); // original untouched
  });

  it("is identity for rng -> 0.999… (deterministic)", () => {
    const rng = () => 0.999999;
    expect(shuffle(["a", "b", "c", "d"], rng)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("buildMcq()", () => {
  it("trims text and keeps correctness across a shuffle", () => {
    const d = validDraft();
    d.options[0].text = "  Mars  ";
    const mcq = buildMcq({ ...d, shuffle: true }, { rng: () => 0.999999 });
    expect(mcq.options[0].text).toBe("Mars");
    expect(mcq.correctIds).toEqual(["b"]);
    expect(mcq.shuffled).toBe(true);
    expect(answerLetters(mcq)).toBe("B");
  });

  it("omits empty explanations and derives type from mode", () => {
    const mcq = buildMcq(validDraft());
    expect(mcq.explanation).toBeUndefined();
    expect(mcq.multiple).toBe(false);
  });
});

describe("answerLetters()", () => {
  it("lists all correct letters", () => {
    const mcq = buildMcq({
      ...validDraft(),
      mode: "multiple",
      correctIds: ["a", "c"],
    });
    expect(answerLetters(mcq)).toBe("A, C");
  });
});

describe("CSV", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('say "hi", then go\nhome')).toBe('"say ""hi"", then go\nhome"');
  });

  it("produces a header sized to the widest option set", () => {
    const mcq = buildMcq(validDraft(), { id: "x1", createdAt: 0 });
    const csv = toCsv([mcq]);
    const [header, row] = csv.split("\r\n");
    expect(header).toContain("Option C");
    expect(header.startsWith("ID,Question,Type,Correct,")).toBe(true);
    expect(row).toContain("single");
    expect(row).toContain(",B,");
  });
});

describe("JSON export/import round-trip", () => {
  it("round-trips through the envelope", () => {
    const mcq = buildMcq(validDraft(), { id: "x1", createdAt: 0 });
    const json = toJsonEnvelope([mcq]);
    const result = parseJsonImport(json);
    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].question).toBe(mcq.question);
    expect(result.skipped).toBe(0);
  });

  it("accepts a bare array and skips malformed entries", () => {
    const mcq = buildMcq(validDraft());
    const bad = { question: "", options: [], correctIds: [] };
    const result = parseJsonImport(JSON.stringify([mcq, bad]));
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("reports invalid JSON without throwing", () => {
    const result = parseJsonImport("{not json");
    expect(result.error).toBeTruthy();
  });
});

describe("isValidMcq()", () => {
  it("rejects correct ids that do not exist in options", () => {
    const mcq: Mcq = buildMcq(validDraft());
    const tampered = { ...mcq, correctIds: ["ghost"] };
    expect(isValidMcq(tampered)).toBe(false);
    expect(isValidMcq(mcq)).toBe(true);
  });
});
