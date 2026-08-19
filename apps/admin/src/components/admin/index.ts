/**
 * The components admin lists and detail screens share.
 *
 * `FilterBar` and `StatusTabs` are both filters and are deliberately different
 * things — see the note in StatusTabs.tsx on when to reach for which.
 */

export { FilterBar, type FilterBarProps, type FilterField } from "./FilterBar";
export { StatusTabs, type StatusTab, type StatusTabsProps } from "./StatusTabs";
export { ConfirmAction, type ConfirmActionProps } from "./ConfirmAction";
export { CommissionRateForm } from "./CommissionRateForm";
export {
  accountState,
  productStatus,
  stockPurchaseStatus,
  userRole,
  vendorStatus,
  verificationState,
} from "./status";
