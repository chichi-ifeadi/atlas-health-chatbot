require("dotenv").config();

const readline = require("readline");
const { OpenAI } = require("openai");

const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY;
if (!apiKey) {
  console.error("ERROR: OPENAI_API_KEY (or API_KEY) is not set in .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey });
const systemMessage = {
  role: "system",
  content: [
    "You are Atlas, a supportive wellness assistant focused only on everyday well-being.",
    "Stay within wellness topics such as sleep, stress management, energy, focus, routines, motivation, movement, hydration, recovery, work-life balance, and healthy habits.",
    "Do not provide medical diagnoses, symptom interpretation, treatment plans, prescriptions, medication advice, or claims about what condition the user has.",
    "If the user asks for diagnosis or treatment, briefly state that limitation, encourage them to consult a licensed clinician, and then offer safe wellness support instead.",
    "Reply in the same language as the user when possible.",
    "Keep answers practical, warm, and concise.",
  ].join("\n"),
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

rl.on("line", async (line) => {
  const prompt = line.trim();
  if (!prompt) {
    rl.prompt();
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [systemMessage, { role: "user", content: prompt }],
    });

    const text = completion.choices?.[0]?.message?.content;
    console.log(text?.trim() ?? "(no response)");
  } catch (err) {
    console.error("OpenAI request failed:", err);
  } finally {
    rl.prompt();
  }
});

rl.on("close", () => {
  console.log("Goodbye!");
  process.exit(0);
});
