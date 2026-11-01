import { parseSom } from '../api/money';

const MAX_TOTAL = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_QUANTITY = 1e9;

export type ReceivingDraftItem = {
  id: string;
  name: string;
  quantity: number;
  unitCostText?: string;
};

/** Creating a product must never validate unrelated lines in the draft. */
export function validateNewReceivingItem(
  quantity: string,
  unitCostText: string,
) {
  const count = Number(quantity);
  if (!Number.isInteger(count) || count < 1 || count > MAX_QUANTITY)
    throw new Error('Укажите корректное количество (1–1 000 000 000).');

  let unitCostMinor: number;
  try {
    unitCostMinor = parseSom(unitCostText);
  } catch {
    throw new Error('Укажите корректную закупочную цену нового товара.');
  }
  if (BigInt(count) * BigInt(unitCostMinor) > MAX_TOTAL)
    throw new Error('Сумма слишком велика.');
  return { count, unitCostMinor };
}

/** Before posting, validate every line and identify the item to fix. */
export function validateReceivingDraft(lines: ReceivingDraftItem[]) {
  let total = 0n;
  return lines.map((line) => {
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_QUANTITY
    )
      throw new Error(`Укажите корректное количество для «${line.name}».`);

    let unitCostMinor: number;
    try {
      unitCostMinor = parseSom(line.unitCostText ?? '');
    } catch {
      throw new Error(
        `Укажите корректную закупочную цену для «${line.name}».`,
      );
    }
    total += BigInt(line.quantity) * BigInt(unitCostMinor);
    if (total > MAX_TOTAL) throw new Error('Сумма слишком велика.');

    return {
      variantId: line.id,
      quantity: line.quantity,
      unitCostMinor,
    };
  });
}
