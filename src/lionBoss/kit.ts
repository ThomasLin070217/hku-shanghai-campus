import type {Inventory} from '../items/inventory';

/** Only the layout belongs to the encounter. The items themselves come from the opening. */
export function restoreKitLayout(inventory:Inventory, order:unknown, hotbar:unknown) {
  if (!Array.isArray(order) || order.length !== inventory.slots.length ||
      typeof hotbar !== 'number' || !Number.isInteger(hotbar) || hotbar < 0 || hotbar > 8) return;
  const items = new Map(inventory.slots.flatMap(item => item ? [[item.instanceId,item] as const] : []));
  const layout = [];
  for (const id of order) {
    if (id === null) { layout.push(null); continue; }
    const item = items.get(id);
    if (!item) return;
    layout.push(item);
    items.delete(id);
  }
  if (items.size > 0) return;
  inventory.slots.splice(0,order.length,...layout);
  inventory.selectedHotbar = hotbar;
  inventory.revision++;
}
