/**
 * Viber notification helper.
 */
export async function sendViberNotification(env, text) {
  if (!env.VIBER_BOT_TOKEN || !env.VIBER_RECEIVER_ID) return;
  const url = "https://chatapi.viber.com/pa/send_message";
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "X-Viber-Auth-Token": env.VIBER_BOT_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        receiver: env.VIBER_RECEIVER_ID,
        sender: { name: "Dispatch HQ" },
        type: "text",
        text: text
      })
    });
  } catch(e) {
    console.error("Viber notification error", e);
  }
}