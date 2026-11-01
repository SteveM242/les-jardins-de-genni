// Rattachement de commandes passées sans compte à un compte client.
// À n'appeler qu'une fois la propriété de l'email prouvée (lien reçu en boîte mail).
async function linkGuestOrdersByEmail(db, customerId, email) {
  const { rows } = await db.query(
    `UPDATE orders SET customer_id = $1
     WHERE customer_id IS NULL AND email <> '' AND lower(email) = lower($2)
     RETURNING order_number`,
    [customerId, email]
  );
  return rows.length;
}

module.exports = { linkGuestOrdersByEmail };
