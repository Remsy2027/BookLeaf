import { test } from "node:test";
import assert from "node:assert/strict";
import { createAI } from "../server/ai.js";
const success = (value) => ({
  ok: true,
  json: async () => ({
    status: "completed",
    output: [
      { content: [{ type: "output_text", text: JSON.stringify(value) }] },
    ],
  }),
});

test("Groq uses strict schemas and validates classification and draft output", async () => {
  let captured;
  const ai = createAI({
    provider: "groq",
    apiKey: "fake-groq-key",
    fetchImpl: async (url, options) => {
      captured = { url, ...options, body: JSON.parse(options.body) };
      const value = captured.body.response_format.json_schema.schema.properties
        .draft
        ? { draft: "Thank you for your question. We will check the details." }
        : {
            category: "General Inquiry",
            priority: "Low",
            reason: "Routine account query.",
          };
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(value) },
            },
          ],
        }),
      };
    },
  });
  assert.equal((await ai.classify("Question", "Please help")).source, "ai");
  assert.equal(captured.url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(captured.headers.Authorization, "Bearer fake-groq-key");
  assert.equal(captured.body.response_format.json_schema.strict, true);
  const draft = await ai.draft(
    {
      category: "General Inquiry",
      subject: "Question",
      description: "Details",
    },
    null,
    "Demo Author",
  );
  assert.equal(draft.source, "ai");
  assert.match(draft.draft, /Thank you/);
});

test("Groq errors, refusals and truncated output fall back safely", async () => {
  for (const result of [
    { ok: false, status: 401 },
    { ok: false, status: 429 },
    {
      ok: true,
      json: async () => ({
        choices: [{ finish_reason: "length", message: { content: "{}" } }],
      }),
    },
    {
      ok: true,
      json: async () => ({
        choices: [{ finish_reason: "stop", message: { refusal: "refused" } }],
      }),
    },
  ]) {
    const ai = createAI({
      provider: "groq",
      apiKey: "fake",
      fetchImpl: async () => result,
    });
    assert.equal((await ai.classify("Question", "Details")).source, "fallback");
  }
});

test("Gemini uses server-side header authentication and structured generation", async () => {
  let request;
  const ai = createAI({
    provider: "gemini",
    apiKey: "fake-gemini-key",
    fetchImpl: async (url, options) => {
      request = { url, ...options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: "General Inquiry",
                      priority: "Low",
                      reason: "Routine query.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    },
  });
  assert.equal(
    (await ai.classify("Question", "How can I update my bio?")).source,
    "ai",
  );
  assert.match(request.url, /generativelanguage.googleapis.com/);
  assert.doesNotMatch(request.url, /fake-gemini-key/);
  assert.equal(request.headers["x-goog-api-key"], "fake-gemini-key");
  assert.equal(
    request.body.generationConfig.responseMimeType,
    "application/json",
  );
  assert.ok(
    request.body.generationConfig.responseSchema.properties.category.enum
      .length,
  );
});

test("Gemini quota failures and incomplete results fall back safely", async () => {
  for (const result of [
    { ok: false, status: 429 },
    {
      ok: true,
      json: async () => ({ candidates: [{ finishReason: "MAX_TOKENS" }] }),
    },
    {
      ok: true,
      json: async () => ({ promptFeedback: { blockReason: "SAFETY" } }),
    },
  ]) {
    const ai = createAI({
      provider: "gemini",
      apiKey: "fake",
      fetchImpl: async () => result,
    });
    assert.equal((await ai.classify("Question", "Details")).source, "fallback");
  }
});
test("AI classification uses a strict schema and validates returned enums", async () => {
  let body;
  const ai = createAI({
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      body = JSON.parse(options.body);
      return success({
        category: "ISBN & Metadata Issues",
        priority: "High",
        reason: "Wrong ISBN linked.",
      });
    },
  });
  const result = await ai.classify("Incorrect ISBN", "Another book is linked");
  assert.equal(result.source, "ai");
  assert.equal(result.priority, "High");
  assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true);
  const bad = createAI({
    apiKey: "test-key",
    fetchImpl: async () =>
      success({ category: "Invented", priority: "None", reason: "x" }),
  });
  assert.equal(
    (await bad.classify("ISBN error", "wrong isbn")).source,
    "fallback",
  );
});
test("429, network failures, malformed output and refusals degrade gracefully", async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, status: 429 }),
    async () => {
      throw new Error("Network down");
    },
    async () => ({
      ok: true,
      json: async () => ({ status: "completed", output: [] }),
    }),
    async () => ({ ok: true, json: async () => ({ status: "incomplete" }) }),
  ]) {
    const ai = createAI({ apiKey: "test-key", fetchImpl });
    assert.equal(
      (await ai.classify("Royalties overdue", "No payment for 6 months"))
        .source,
      "fallback",
    );
    assert.equal(
      (
        await ai.draft(
          {
            category: "Royalty & Payments",
            subject: "Query",
            description: "Details",
          },
          null,
          "Author",
        )
      ).source,
      "unavailable",
    );
  }
});
test("draft sends only selected policy, book facts and bounded recent public replies", async () => {
  let body;
  const ai = createAI({
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      body = JSON.parse(options.body);
      return success({
        draft: "Thanks for reaching out. We will check the payout records.",
      });
    },
  });
  const result = await ai.draft(
    {
      category: "Royalty & Payments",
      subject: "Payment",
      description: "Where is my payment?",
    },
    { royalty_pending: 3570 },
    "Priya",
    Array(10).fill({ body: "Previous response" }),
  );
  assert.equal(result.source, "ai");
  assert.match(body.instructions, /45 days/);
  assert.doesNotMatch(body.instructions, /stock sync/);
  assert.match(body.instructions, /untrusted/);
  const input = JSON.parse(body.input);
  assert.equal(input.recentReplies.length, 3);
  assert.equal(input.book.royalty_pending, 3570);
});
test("circuit breaker avoids repeated provider calls during an outage", async () => {
  let calls = 0;
  const ai = createAI({
    apiKey: "test-key",
    fetchImpl: async () => {
      calls++;
      return { ok: false, status: 503 };
    },
  });
  await ai.classify("A", "B");
  await ai.classify("C", "D");
  assert.equal(calls, 1);
});

test("drafts with invented contact destinations are withheld", async () => {
  const ai = createAI({
    provider: "openai",
    apiKey: "fake",
    fetchImpl: async () =>
      success({ draft: "Please email invented@example.com for support." }),
  });
  const result = await ai.draft(
    {
      category: "General Inquiry",
      subject: "Description",
      description: "How can I update it?",
    },
    null,
    "Demo",
  );
  assert.equal(result.source, "unavailable");
  assert.equal(result.draft, "");
});
