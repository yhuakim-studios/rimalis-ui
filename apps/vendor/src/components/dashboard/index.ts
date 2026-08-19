/**
 * Dashboard components.
 *
 * `SalesChart` is the only Client Component here — it owns hover state for the
 * tooltip. `StatTile` and `OrderRow` are server-rendered, which is why `OrderRow`
 * can be reused verbatim by the orders page without dragging a bundle along.
 */

export { StatTile, type StatTileProps } from "./StatTile";
export { SalesChart, type SalesChartDay, type SalesChartProps } from "./SalesChart";
export { OrderRow } from "./OrderRow";
