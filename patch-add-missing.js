#!/usr/bin/env node

/**
 * Patch: Add Generative AI functions + missing functions to tracker.json
 * 
 * Run from the same directory as tracker.json:
 *   node patch-add-missing.js
 */

const fs = require('fs');

const TRACKER_PATH = './tracker.json';

// All Generative AI functions from splashkit.io/api/generative-ai/
const GENERATIVE_AI = [
  {
    functionName: "conversation_add_message",
    description: "Adds a user message to a Conversation, triggering the language model to begin generating a reply.",
  },
  {
    functionName: "conversation_get_reply",
    description: "Returns the full reply from a Conversation. Overloaded: can include or exclude model thoughts.",
  },
  {
    functionName: "conversation_get_reply_piece",
    description: "Returns one piece of a reply at a time (streaming). Use in a loop with conversation_is_replying.",
  },
  {
    functionName: "conversation_is_replying",
    description: "Checks if the language model is still generating a reply within a Conversation.",
  },
  {
    functionName: "conversation_is_thinking",
    description: "Checks if the model is in its 'thinking' phase while generating. Use to filter or display thoughts separately.",
  },
  {
    functionName: "create_conversation",
    description: "Creates a new Conversation object. Overloaded: can use default model or a specified language_model.",
  },
  {
    functionName: "free_all_conversations",
    description: "Releases all Conversation objects that have been created.",
  },
  {
    functionName: "free_conversation",
    description: "Frees the resources associated with a specific Conversation object.",
  },
  {
    functionName: "generate_reply",
    description: "Generates a chat-style reply to a prompt. Overloaded: can use default model or a specified language_model. Instruct/Thinking models recommended.",
  },
  {
    functionName: "generate_text",
    description: "Generates continuation text from a prompt (not chat). Overloaded: with/without model, with/without max_tokens. Base models recommended.",
  },
];

// Other functions found in unmatched PRs that weren't in the original scrape
const OTHER_MISSING = [
  { functionName: "square_root", category: "Utilities", description: "Computes the square root of a given number." },
  { functionName: "greatest_common_divisor", category: "Utilities", description: "Finds the greatest common divisor of two integers." },
  { functionName: "replace_all", category: "Utilities", description: "Replaces all occurrences of a substring within a string." },
  { functionName: "calculate_collision_direction", category: "Physics", description: "Calculates the direction of a collision between two objects." },
  { functionName: "triangle_to_string", category: "Geometry", description: "Converts a triangle's coordinates to a string representation." },
  { functionName: "widest_points", category: "Geometry", description: "Returns the widest points of a circle as a line." },
  { functionName: "circle_ray_intersection", category: "Geometry", description: "Detects if a ray intersects a circle and optionally returns hit point and distance." },
  { functionName: "circle_triangle_intersect", category: "Geometry", description: "Detects if a circle intersects with a triangle." },
];

// Load existing tracker
if (!fs.existsSync(TRACKER_PATH)) {
  console.error(`${TRACKER_PATH} not found. Run this from the tracker directory.`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf-8'));
const entries = data.entries || [];

// Helper: check if a function already exists
const existingNames = new Set(entries.map(e => e.functionName.toLowerCase()));

let added = 0;

// Add Generative AI functions
for (const func of GENERATIVE_AI) {
  if (existingNames.has(func.functionName.toLowerCase())) {
    console.log(`  skip: ${func.functionName} (already exists)`);
    continue;
  }
  entries.push({
    id: `genai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    functionName: func.functionName,
    description: func.description,
    category: "Generative AI",
    status: "available",
    claimedBy: "",
    prLink: "",
    createdAt: new Date().toISOString(),
  });
  console.log(`  added: ${func.functionName} (Generative AI)`);
  added++;
}

// Add other missing functions
for (const func of OTHER_MISSING) {
  if (existingNames.has(func.functionName.toLowerCase())) {
    console.log(`  skip: ${func.functionName} (already exists)`);
    continue;
  }
  entries.push({
    id: `patch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    functionName: func.functionName,
    description: func.description,
    category: func.category,
    status: "available",
    claimedBy: "",
    prLink: "",
    createdAt: new Date().toISOString(),
  });
  console.log(`  added: ${func.functionName} (${func.category})`);
  added++;
}

data.entries = entries;
data.lastUpdated = new Date().toISOString();
fs.writeFileSync(TRACKER_PATH, JSON.stringify(data, null, 2));

console.log(`\nDone! Added ${added} new functions. Total entries: ${entries.length}`);
console.log('Now re-run sync.js to match these against existing PRs.');
