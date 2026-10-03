// Pre-built study plan templates
export type Template = {
  id: string;
  title: string;
  emoji: string;
  days: number;
  prompt: string;
  description: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "exam-cram",
    emoji: "🚨",
    title: "Exam Cram (3 days)",
    days: 3,
    description: "High-intensity review with key concepts, common pitfalls, and practice questions.",
    prompt:
      "Create a 3-day intensive exam preparation focusing on the most-tested concepts, common mistakes, and rapid-fire practice questions. Emphasize active recall.",
  },
  {
    id: "deep-dive",
    emoji: "🔬",
    title: "Concept Deep Dive (5 days)",
    days: 5,
    description: "Slow, thorough exploration with examples, edge cases, and cross-connections.",
    prompt:
      "Create a 5-day deep dive covering fundamentals, mechanisms, real-world examples, edge cases, and connections to related topics. Each day should build on the previous.",
  },
  {
    id: "quick-overview",
    emoji: "⚡",
    title: "Quick Overview (1 day)",
    days: 1,
    description: "A clear, focused summary you can finish today.",
    prompt:
      "Create a one-day concise overview hitting the key ideas, simple analogies, and a short self-check at the end.",
  },
  {
    id: "language-basics",
    emoji: "🗣️",
    title: "Language Fundamentals (5 days)",
    days: 5,
    description: "Build vocabulary, grammar, and simple conversation patterns.",
    prompt:
      "Create a 5-day language fundamentals plan: Day 1 alphabet & pronunciation, Day 2 core vocabulary, Day 3 basic grammar, Day 4 useful phrases, Day 5 short conversations with practice prompts.",
  },
  {
    id: "interview-prep",
    emoji: "💼",
    title: "Interview Prep (3 days)",
    days: 3,
    description: "Concepts, behavioral framing, and likely interview questions.",
    prompt:
      "Create a 3-day interview prep plan: Day 1 core concepts & definitions, Day 2 practical problems with solutions, Day 3 behavioral STAR-format answers and likely follow-up questions.",
  },
  {
    id: "skill-builder",
    emoji: "🛠️",
    title: "New Skill Builder (4 days)",
    days: 4,
    description: "Theory + small hands-on exercises each day.",
    prompt:
      "Create a 4-day skill-building plan with a small hands-on exercise each day. Day 1 motivation & vocabulary, Day 2 core moves, Day 3 combining moves on a small project, Day 4 review & next-steps.",
  },
  {
    id: "exam-sprint",
    emoji: "🎯",
    title: "Standardized Exam Sprint (3 days)",
    days: 3,
    description: "JAMB, WAEC, SAT-style drills: high-yield topics, formulas and past-question traps.",
    prompt:
      "Create a 3-day standardized exam sprint: Day 1 high-yield topics and must-know formulas, Day 2 past-question style practice with worked solutions, Day 3 common traps, timing strategy and a mock test.",
  },
  {
    id: "research-paper",
    emoji: "📄",
    title: "Research Paper Breakdown (4 days)",
    days: 4,
    description: "Understand methods, findings and critique of any paper or thesis.",
    prompt:
      "Create a 4-day research paper breakdown: Day 1 context and research question, Day 2 methodology explained simply, Day 3 results and what they mean, Day 4 critique, limitations and defense-style questions.",
  },
  {
    id: "coding-algorithms",
    emoji: "💻",
    title: "Coding & Algorithms (5 days)",
    days: 5,
    description: "Data structures, problem patterns and edge cases with practice problems.",
    prompt:
      "Create a 5-day coding plan: Day 1 core data structures, Day 2 two-pointer and sliding window, Day 3 recursion and trees, Day 4 dynamic programming, Day 5 edge cases and mixed practice problems with solutions.",
  },
  {
    id: "case-study",
    emoji: "📊",
    title: "Business Case Study (3 days)",
    days: 3,
    description: "Problem framing, SWOT, financial impact and a strategy pitch.",
    prompt:
      "Create a 3-day business case study plan: Day 1 problem identification and stakeholders, Day 2 SWOT and financial/operational analysis, Day 3 strategic recommendations and pitch practice.",
  },
];
