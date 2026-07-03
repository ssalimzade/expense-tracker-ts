// SHA-256 flag_id, matching the Python make_transaction_id:
//   sha256(f"{description}|{created_iso}").hexdigest()
// created_iso is the strftime("%Y-%m-%dT%H:%M:%S") form (see transactions.ts).

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function makeTransactionId(
  description: string,
  createdIso: string,
): Promise<string> {
  return sha256Hex(`${description}|${createdIso}`);
}
