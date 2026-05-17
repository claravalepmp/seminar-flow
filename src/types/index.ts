export interface Advisor {
  advisor_id: string;
  user_id?: string;
  advisor_name: string;
  company_name?: string;
  phone?: string;
  email: string;
  group_id?: string;  // Links to AdvisorGroup
  created_at: string;
  updated_at: string;
}

export interface Order {
  order_id: string;
  order_number: number;
  advisor_id: string;
  // Workshop details
  event_type: string;           // R90, R101, SS101, W101, etc.
  region_id?: string;           // Links to Region table
  charity_id?: string;          // Links to Charity table
  // First event
  first_event_date: string;
  first_event_time?: string;
  first_event_end_time?: string;
  // Second event (most workshops have 2)
  second_event_date?: string;
  second_event_time?: string;
  second_event_end_time?: string;
  // Third/Fourth events (rare)
  third_event_date?: string;
  fourth_event_date?: string;
  // Venue
  venue_name?: string;
  address?: string;
  // Mailing
  mail_piece?: string;          // postcard_standard, letter_personalized, tbd, etc.
  mailing_quantity: number;
  // Digital
  digital_budget?: string;
  // Status & workflow
  status: OrderStatus;
  proof_url?: string;
  proof_feedback?: string;
  admin_notes?: string;
  client_notes?: string;
  // Timestamps
  created_at: string;
  updated_at: string;
  // Joined data (populated at runtime)
  advisor?: Advisor;
  client_status?: string;
}

export type OrderStatus =
  | 'pending_orders'      // Just created, needs details
  | 'pending_details'     // Waiting on venue/date info
  | 'all_details_added'   // Ready for design
  | 'in_design'           // Manny working on it
  | 'in_revision'         // Client requested changes
  | 'approval_requested'  // Proof sent, waiting approval
  | 'approved'            // Client approved
  | 'order_sent'          // Sent to printer
  | 'digital'             // Digital campaign setup
  | 'campaign_running'    // Live campaign
  | 'complete'            // Done
  | 'issues';             // Problem to resolve

export interface OrderComment {
  id: string;
  order_id: string;
  user_id?: string;
  user_name: string;
  user_type: 'admin' | 'client';
  comment: string;
  created_at: string;
}

export interface OrderAttachment {
  id: string;
  order_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  uploaded_by?: string;
  created_at: string;
}

export const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'pending_orders', label: 'Pending', color: 'bg-orange-100 text-orange-800' },
  { value: 'pending_details', label: 'Needs Details', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'all_details_added', label: 'Ready for Design', color: 'bg-blue-50 text-blue-700' },
  { value: 'in_design', label: 'In Design', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_revision', label: 'In Revision', color: 'bg-amber-100 text-amber-800' },
  { value: 'approval_requested', label: 'Needs Approval', color: 'bg-purple-100 text-purple-800' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' },
  { value: 'order_sent', label: 'Order Sent', color: 'bg-blue-200 text-blue-900' },
  { value: 'digital', label: 'Digital Setup', color: 'bg-sky-100 text-sky-800' },
  { value: 'campaign_running', label: 'Campaign Live', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'complete', label: 'Complete', color: 'bg-gray-100 text-gray-800' },
  { value: 'issues', label: 'Issues', color: 'bg-red-100 text-red-800' },
];

export function getStatusInfo(status: OrderStatus) {
  return ORDER_STATUSES.find((s) => s.value === status) || ORDER_STATUSES[0];
}
