import { supabase } from "./supabase";

/**
 * Enregistre le vrai impact sur la Grande caisse d'une opération (achat, dépense,
 * création de lot...) selon la source de financement choisie :
 * - "caisse"           : décaissement réel (peut faire passer la caisse en négatif)
 * - "apport_personnel" : injection (capital) + décaissement immédiat (neutre sur la caisse,
 *                        mais augmente le Capital cumulé)
 * - "benefice"         : aucun mouvement de caisse (déjà géré comme charge dans le calcul du Bénéfice)
 * - "credit"           : aucun mouvement de caisse maintenant (dette), sera créé au remboursement
 */
export async function recordSourceMovement(
  source: string,
  amount: number,
  ownerId: string | undefined,
  reason: string
) {
  if (amount <= 0) return;
  const today = new Date().toISOString().slice(0, 10);

  if (source === "caisse") {
    await supabase.from("cash_transactions").insert({
      type: "decaissement",
      amount,
      reason,
      transaction_date: today,
      owner_id: ownerId,
    });
  } else if (source === "apport_personnel") {
    await supabase.from("cash_transactions").insert([
      {
        type: "injection",
        amount,
        reason: `Apport personnel — ${reason}`,
        transaction_date: today,
        owner_id: ownerId,
      },
      {
        type: "decaissement",
        amount,
        reason,
        transaction_date: today,
        owner_id: ownerId,
      },
    ]);
  }
  // "benefice" et "credit" : pas de mouvement de caisse immédiat.
}
