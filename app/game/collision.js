/**
 * Coleta por cilindro, mais tolerante que uma esfera única: aproximar-se pela
 * lateral ou atravessar a moeda durante um salto continua contando.
 */
export function coinWithinPickup(player, coin) {
  const horizontal = Math.hypot(player.x - coin.x, player.z - coin.z);
  const vertical = Math.abs(player.y - coin.y);
  return horizontal <= 1.25 && vertical <= 1.35;
}

/**
 * Distingue contato por cima de contato lateral usando a altura dos pés.
 * O limite de velocidade positivo aceita pousos próximos ao ápice do salto,
 * quando a gravidade ainda não produziu uma velocidade negativa expressiva.
 */
export function classifyEnemyContact({
  horizontalDistance,
  playerFeetY,
  enemyTopY,
  verticalVelocity,
}) {
  if (horizontalDistance > 1.05) return "none";
  const feetFromTop = playerFeetY - enemyTopY;
  if (verticalVelocity <= 1.5 && feetFromTop >= -.36) return "stomp";
  if (feetFromTop >= -1.65 && feetFromTop < -.36) return "hurt";
  return "none";
}
