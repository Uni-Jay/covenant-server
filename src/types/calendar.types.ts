/**
 * Calendar System Types
 */

export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  event_date: string | Date;
  event_type: 'activity' | 'birthday' | 'service' | 'meeting' | 'anniversary';
  notes?: string;
  created_by: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  daysUntil?: number;
}

export interface Birthday {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth: string | Date;
  daysUntil: number;
  age: number;
  showBirthday: boolean;
}

export interface ReminderLog {
  id: number;
  event_id: number;
  user_id: number;
  reminder_type: 'event' | 'birthday';
  days_remaining: number;
  sent_at: Date;
}

export interface BirthdayGreetingSent {
  id: number;
  user_id: number;
  sent_at: Date;
}

export interface UserSettings {
  id: number;
  user_id: number;
  show_birthday: boolean;
  notification_email: boolean;
  notification_whatsapp: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WhatsAppLog {
  id: number;
  phone_number: string;
  message: string;
  status: 'sent' | 'pending' | 'failed';
  message_id?: string;
  error_message?: string;
  sent_at: Date;
}

export interface CalendarStats {
  totalEvents: number;
  upcomingEvents: number;
  birthdayUsers: number;
  reminderssentToday: number;
  birthdaysGreetedToday: number;
}

export interface SchedulerStatus {
  isActive: boolean;
  jobCount: number;
  jobs: Array<{
    name: string;
    schedule: string;
    enabled: boolean;
  }>;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  eventDate: string; // ISO format
  eventType?: 'activity' | 'birthday' | 'service' | 'meeting';
  notes?: string;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  eventDate?: string;
  eventType?: 'activity' | 'birthday' | 'service' | 'meeting';
  notes?: string;
  isActive?: boolean;
}

export interface BirthdaySettingsRequest {
  showBirthday: boolean;
}
