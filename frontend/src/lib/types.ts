// Mirrors the DTOs of the Keyzo API (camelCase JSON).
export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number }

export type Role = 'SuperAdmin' | 'Owner' | 'Manager' | 'Tenant' | 'MaintenanceStaff'

export type User = {
  id: number; email: string; fullName: string; phone: string | null; avatarUrl: string | null
  isActive: boolean; roles: Role[]; createdAt: string
}
export type AuthResponse = { accessToken: string; accessExpiresAt: string; refreshToken: string; user: User }
export type UserLookup = { id: number; fullName: string; email: string; role: string }

export type Amenity = { id: number; name: string; icon: string | null }
export type Img = { id: number; url: string; isCover: boolean }

export type UnitCard = {
  unitId: number; propertyId: number; propertyName: string; propertyType: string; city: string; state: string; unitNumber: string
  bedrooms: number; bathrooms: number; areaSqft: number; monthlyRent: number; depositAmount: number; coverImage: string | null; amenities: string[]
}
export type PublicUnitDetail = {
  card: UnitCard; description: string | null; propertyDescription: string | null; addressLine: string; postalCode: string
  floorNo: number; images: string[]; amenities: Amenity[]; otherAvailableUnits: number; reserved: boolean
}
export type TourStopDto = {
  id: number; seq: number; roomType: string; imageId: number; imageUrl: string; title: string; caption: string | null; focalX: number; focalY: number
}
/** Custom house tour of a unit; empty `stops` = use the built-in photo library. */
export type UnitTour = { unitId: number; stops: TourStopDto[] }
export type PublicStats ={ properties: number; units: number; occupiedUnits: number; cities: number; activeLeases: number; occupancyPct: number }

export type PropertyListItem = {
  id: number; name: string; propertyType: string; addressLine: string; city: string; state: string; isActive: boolean
  ownerName: string; managerName: string | null; totalUnits: number; occupiedUnits: number; minRent: number | null; maxRent: number | null; coverImage: string | null
}
export type Unit = {
  id: number; propertyId: number; unitNumber: string; floorNo: number; bedrooms: number; bathrooms: number; areaSqft: number
  monthlyRent: number; depositAmount: number; status: string; description: string | null; currentTenant: string | null
}
export type PropertyDetail = {
  id: number; name: string; description: string | null; propertyType: string; addressLine: string; city: string; state: string
  postalCode: string; country: string; isActive: boolean; ownerId: number; ownerName: string; managerId: number | null; managerName: string | null
  amenities: Amenity[]; images: Img[]; units: Unit[]
}

export type TenantDoc = { id: number; docType: string; originalName: string; isVerified: boolean; uploadedAt: string; applicationId: number | null }
export type TenantProfile = {
  id: number; userId: number; fullName: string; email: string; phone: string | null; dateOfBirth: string | null; occupation: string | null
  employer: string | null; monthlyIncome: number | null; emergencyContactName: string | null; emergencyContactPhone: string | null
  permanentAddress: string | null; idProofType: string | null; idProofNumber: string | null; documents: TenantDoc[]
}
export type TenantListItem = {
  id: number; fullName: string; email: string; phone: string | null; occupation: string | null; currentUnit: string | null
  currentProperty: string | null; outstanding: number; leaseCount: number
}

export type Application = {
  id: number; unitId: number; unitNumber: string; propertyId: number; propertyName: string; monthlyRent: number
  tenantId: number; tenantName: string; tenantEmail: string; tenantPhone: string | null; tenantIncome: number | null
  desiredMoveIn: string; leaseMonths: number; occupants: number; message: string | null; status: string; reviewNote: string | null
  reviewedAt: string | null; createdAt: string; documentCount: number; verifiedDocuments: number; leaseId: number | null
}

export type LeaseItem = {
  id: number; unitId: number; unitNumber: string; propertyId: number; propertyName: string; tenantId: number; tenantName: string
  startDate: string; endDate: string; monthlyRent: number; securityDeposit: number; status: string; daysToExpiry: number
  outstanding: number; renewalPending: boolean
}
export type Renewal = {
  id: number; leaseId: number; requestedEndDate: string; proposedRent: number | null; note: string | null; status: string
  createdAt: string; decidedAt: string | null; unitNumber?: string | null; propertyName?: string | null; tenantName?: string | null
}
export type Deposit = {
  id: number; leaseId: number; amount: number; receivedOn: string; status: string; refundedAmount: number; refundedOn: string | null
  deductionReason: string | null; tenantName: string; unitNumber: string; propertyName: string
}
export type LeaseDetail = {
  lease: LeaseItem; rentDueDay: number; lateFee: number; terms: string | null; applicationId: number | null; createdAt: string
  versions: { versionNo: number; startDate: string; endDate: string; monthlyRent: number; securityDeposit: number; changeReason: string | null; createdAt: string }[]
  renewals: Renewal[]; deposit: Deposit | null
}

export type Invoice = {
  id: number; invoiceNumber: string; leaseId: number; unitId: number; unitNumber: string; propertyName: string; tenantName: string
  periodMonth: string; issueDate: string; dueDate: string; amount: number; lateFee: number; amountPaid: number; balance: number; status: string
}
export type Payment = {
  id: number; invoiceId: number; invoiceNumber: string; receiptNumber: string; amount: number; paidAt: string; method: string
  referenceNo: string | null; note: string | null; tenantName: string; unitNumber: string; propertyName: string; recordedBy: string | null
}

export type MaintItem = {
  id: number; title: string; category: string; priority: string; status: string; unitId: number; unitNumber: string; propertyId: number
  propertyName: string; tenantName: string; assignedTo: string | null; scheduledFor: string | null; createdAt: string; completedAt: string | null; totalCost: number
}
export type MaintDetail = {
  item: MaintItem; description: string; assignedStaffId: number | null; images: { id: number }[]
  logs: { id: number; status: string; note: string | null; cost: number; author: string | null; createdAt: string }[]
}
export type Expense = {
  id: number; propertyId: number; propertyName: string; unitNumber: string | null; requestId: number | null; category: string
  description: string; amount: number; expenseDate: string; recordedBy: string | null
}

export type Notification = { id: number; type: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: string }
export type AuditLog = { id: number; userId: number | null; userName: string | null; action: string; entity: string; entityId: number | null; details: string | null; createdAt: string }

export type MonthPoint = { month: string; billed: number; collected: number }
export type NamedValue = { name: string; value: number }
export type OccupancyPoint = { propertyId: number; property: string; totalUnits: number; occupiedUnits: number; occupancyPct: number }
export type Dashboard = {
  view: 'admin' | 'operator' | 'tenant' | 'staff'
  admin: {
    totalUsers: number; activeUsers: number; inactiveUsers: number; newUsersThisMonth: number; administrators: number
    usersByRole: NamedValue[]; auditEventsToday: number; recentActivity: AuditLog[]
  } | null
  operator: {
    properties: number; units: number; occupiedUnits: number; occupancyPct: number; activeLeases: number; expiringLeases: number
    pendingApplications: number; openMaintenance: number; urgentMaintenance: number; collectedThisMonth: number; billedThisMonth: number
    outstanding: number; overdueInvoices: number; expensesThisMonth: number
  } | null
  tenant: {
    activeLease: { leaseId: number; unitNumber: string; propertyName: string; monthlyRent: number; endDate: string; daysToExpiry: number } | null
    nextInvoice: Invoice | null; outstanding: number; openRequests: number; pendingApplications: number
  } | null
  staff: { assigned: number; inProgress: number; completedThisMonth: number; urgent: number } | null
  rentByMonth: MonthPoint[]; occupancy: OccupancyPoint[]; expensesByCategory: NamedValue[]; maintenanceByStatus: NamedValue[]
}
export type IncomeRow = { month: string; billed: number; collected: number; outstanding: number; expenses: number; net: number }
export type IncomeReport = {
  months: IncomeRow[]; totals: IncomeRow
  properties: { propertyId: number; property: string; billed: number; collected: number; outstanding: number; expenses: number; net: number }[]
}
export type OutstandingRow = {
  invoiceId: number; invoiceNumber: string; dueDate: string; balance: number; daysOverdue: number; property: string; unit: string; tenantId: number; tenant: string
}
export type ExpenseReport = { byCategory: NamedValue[]; byProperty: NamedValue[]; byMonth: NamedValue[]; total: number }
