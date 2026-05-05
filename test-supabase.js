require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testConnection() {
  console.log("Testing Supabase connection...");

  const { data, error } = await supabase
    .from("kb_documents")
    .select("*")
    .limit(3);

  if (error) {
    console.error("Supabase error:", error.message);
    return;
  }

  console.log("Connected successfully!");
  console.log("Sample data:", data);
}

testConnection();