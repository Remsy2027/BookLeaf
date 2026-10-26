// Opt-in live check: consumes provider quota and sends synthetic support fixtures.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createAI } from "../server/ai.js";
import { CATEGORIES } from "../server/constants.js";

const ai = createAI({ timeoutMs: 20000 });
const fixtures = [
  [
    "Royalty payment overdue",
    "I have not received royalty payments for 6 months.",
    CATEGORIES[0],
    "High",
  ],
  [
    "Wrong ISBN linked",
    "The ISBN on the listing links to another book. Please investigate this error.",
    CATEGORIES[1],
    "High",
  ],
  [
    "Printing defect",
    "My author copies have loose binding and blurry pages.",
    CATEGORIES[2],
  ],
  [
    "Listing unavailable",
    "My published book shows currently unavailable on Amazon.",
    CATEGORIES[3],
  ],
  [
    "Production update",
    "My book is in typesetting. Can you check its current production stage?",
    CATEGORIES[4],
  ],
  [
    "Account question",
    "How can I update my author biography?",
    CATEGORIES[5],
    "Low",
  ],
];
const results = [];
for (const [subject, description, category, priority] of fixtures) {
  const result = await ai.classify(subject, description);
  results.push({
    subject,
    ...result,
    passed:
      result.source === "ai" &&
      result.category === category &&
      (!priority || result.priority === priority),
  });
}
const book = {
  title: "Synthetic QA Book",
  status: "Published & Live",
  royalty_pending: 1500,
  total_copies_sold: 100,
  royalty_paid: 1000,
  total_royalty_earned: 2500,
};
const draft = await ai.draft(
  {
    category: CATEGORIES[0],
    subject: "Pending royalty",
    description:
      "Please explain the payout cycle for my pending balance. I do not know the accrual quarter.",
  },
  book,
  "Demo Author",
);
const draftCheck = {
  ...draft,
  passed:
    draft.source === "ai" &&
    /45/.test(draft.draft) &&
    /quarter/i.test(draft.draft) &&
    /1,?500/.test(draft.draft) &&
    !/queued|approved for (?:a )?transfer|(?:i|we)[’']?ve (?:flagged|escalated)|(?:i|we) have (?:flagged|escalated)|platform commission (?:is )?20%|quarter ending|2026/i.test(
      draft.draft,
    ),
};
const report = {
  testedAt: new Date().toISOString(),
  provider: process.env.AI_PROVIDER,
  model: process.env.GROQ_MODEL,
  classification: results,
  draft: draftCheck,
};
const metadataDraft = await ai.draft({category:CATEGORIES[1],subject:'Update book description',description:'Can I update the description of a published book? How long does it take?'},null,'Demo Author');
report.metadataDraft = {...metadataDraft, passed:metadataDraft.source==='ai' && /3\s*[–-]\s*5/.test(metadataDraft.draft) && !/@|https?:|Edit Metadata/.test(metadataDraft.draft)};
mkdirSync("output/qa", { recursive: true });
writeFileSync("output/qa/ai-live.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (results.some((r) => !r.passed) || !draftCheck.passed || !report.metadataDraft.passed) process.exitCode = 1;
