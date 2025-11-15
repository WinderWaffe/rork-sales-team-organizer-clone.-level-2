export interface ContactLog {
  id: string;
  repId: string;
  leaderId: string;
  timestamp: string;
}

export interface Todo {
  id: string;
  repId: string;
  title: string;
  completed: boolean;
  description?: string;
  status: 'open' | 'done';
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  completedAt?: string;
}

export interface SalesRep {
  id: string;
  name: string;
  phoneNumber?: string;
  instagram?: string;
  notes: string;
  belongsToLeader: string | null;
  lastContactDate: string | null;
  createdAt: string;
  last_contacted_at: string | null;
  previous_last_contacted_at: string | null;
  contacted_today: boolean;
  todos: Todo[];
}
