export type Role = "CASHIER" | "KITCHEN" | "MANAGER";

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
};

export type Category = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MenuItemModifier = {
  id: string;
  menuItemId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  optionGroup?: string | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MenuItemOption = MenuItemModifier;
export type MenuItemSize = MenuItemModifier;

export type MenuItem = {
  id: string;
  itemNumber: string | null;
  name: string;
  description: string | null;
  price: number;
  sortOrder: number;
  isAvailable: boolean;
  categoryId: string;
  options?: MenuItemOption[];
  sizes?: MenuItemSize[];
  createdAt: string;
  updatedAt: string;
};

export type ApiError = {
  status: string;
  message: string;
};

export type OrderStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "FINISHED"
  | "COMPLETED"
  | "CANCELLED";

export type TenderType = "CASH" | "CARD" | "SPLIT";

export type PaidStatus = "UNPAID" | "PAID" | "REFUNDED";

export type TenderPayload = {
  method: TenderType;
  cardAmount?: number;
};

export type RefundPayload = TenderPayload;

export type OrderUser = {
  id: string;
  email: string;
  role: Role;
};

export type OrderItemOption = {
  id: string;
  name: string;
  priceDelta: number;
};

export type OrderItem = {
  id: string;
  menuItemId: string | null;
  itemCode: string | null;
  name: string;
  sizeName: string | null;
  price: number;
  quantity: number;
  preferences: string | null;
  options: OrderItemOption[];
};

export type Order = {
  id: string;
  ticketNumber: number;
  businessDate: string;
  status: OrderStatus;
  previousStatus: OrderStatus | null;
  payAtPickup: boolean;
  tenderType: TenderType | null;
  paidStatus: PaidStatus;
  cardAmount: number | null;
  cashAmount: number | null;
  refundTenderType: TenderType | null;
  refundedCardAmount: number | null;
  refundedCashAmount: number | null;
  refundedAt: string | null;
  refundedBy: OrderUser | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledBy: OrderUser | null;
  finishedAt: string | null;
  finishedBy: OrderUser | null;
  completedAt: string | null;
  completedBy: OrderUser | null;
  placedBy: OrderUser;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};
