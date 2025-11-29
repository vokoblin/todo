export type ResetTime = {
  type: 'daily' | 'weekly';
  time: string; // Format: "HH:MM"
  weekday?: number; // 0-6 for weekly, 0 = Sunday
};

export type TodoStatus = 'pending' | 'completed';

export type TodoItemType = 'checkbox' | 'counter';

export type TodoItem = {
  id: string;
  name: string;
  description?: string;
  status: TodoStatus;
  resetTime?: ResetTime;
  lastReset?: number; // timestamp
  parentId?: string; // for nested items
  isSection: boolean;
  itemType?: TodoItemType; // Type of item: checkbox (default) or counter
  counterTarget?: number; // For counter type: target count to reach
  counterCurrent?: number; // For counter type: current count
};

export type TodoProject = {
  id: string;
  name: string;
  description?: string;
  items: TodoItem[];
  createdAt: number;
  isPreset?: boolean;
};

export type TodoData = {
  projects: TodoProject[];
  settings: {
    theme: 'light' | 'dark';
  };
  uiState: {
    expandedProjects: Record<string, boolean>;
    expandedSections: Record<string, boolean>;
  };
};

export type PresetProject = {
  name: string;
  description?: string;
  items: Omit<TodoItem, 'id' | 'status' | 'lastReset' | 'counterCurrent'>[];
};