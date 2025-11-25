import { writable } from 'svelte/store';
import type { TodoData, TodoProject, TodoItem, ResetTime } from './types';

const STORAGE_KEY = 'game-todo-data';

const defaultData: TodoData = {
  projects: [],
  settings: {
    theme: 'light'
  },
  uiState: {
    expandedProjects: {},
    expandedSections: {}
  }
};

function createTodoStore() {
  const { subscribe, set, update } = writable<TodoData>(defaultData);

  return {
    subscribe,
    
    // Initialize from localStorage
    init: () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            // Ensure backward compatibility by adding uiState if missing
            if (!data.uiState) {
              data.uiState = {
                expandedProjects: {},
                expandedSections: {}
              };
            }
            set(data);
          } catch (e) {
            console.error('Failed to parse stored todo data:', e);
          }
        }
      }
    },
    
    // Save to localStorage
    save: (data: TodoData) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      set(data);
    },
    
    // Add new project
    addProject: (project: TodoProject) => {
      update(data => {
        const newData = { ...data, projects: [...data.projects, project] };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        return newData;
      });
    },
    
    // Update project
    updateProject: (projectId: string, updates: Partial<TodoProject>) => {
      update(data => {
        const newData = {
          ...data,
          projects: data.projects.map(p => 
            p.id === projectId ? { ...p, ...updates } : p
          )
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        return newData;
      });
    },
    
    // Delete project
    deleteProject: (projectId: string) => {
      update(data => {
        const newData = {
          ...data,
          projects: data.projects.filter(p => p.id !== projectId)
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        return newData;
      });
    },
    
    // Update todo item status
    updateTodoStatus: (projectId: string, itemId: string, status: 'pending' | 'completed') => {
      update(data => {
        const newData = {
          ...data,
          projects: data.projects.map(project => {
            if (project.id === projectId) {
              return {
                ...project,
                items: project.items.map(item => 
                  item.id === itemId ? { ...item, status } : item
                )
              };
            }
            return project;
          })
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        return newData;
      });
    },
    
    // Add todo item to project
    addTodoItem: (projectId: string, item: TodoItem) => {
      update(data => {
        const newData = {
          ...data,
          projects: data.projects.map(project => 
            project.id === projectId 
              ? { ...project, items: [...project.items, item] }
              : project
          )
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        return newData;
      });
    },
    
    // Update settings
    updateSettings: (settings: Partial<TodoData['settings']>) => {
      update(data => {
        const newData = { 
          ...data, 
          settings: { ...data.settings, ...settings } 
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        return newData;
      });
    },
    
    // Check and reset todos based on reset time
    checkResets: () => {
      update(data => {
        const now = Date.now();
        let hasChanges = false;
        
        const newData = {
          ...data,
          projects: data.projects.map(project => ({
            ...project,
            items: project.items.map(item => {
              if (shouldReset(item.resetTime, item.lastReset, now)) {
                hasChanges = true;
                return { ...item, status: 'pending', lastReset: now };
              }
              return item;
            })
          }))
        };
        
        if (hasChanges && typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        
        return newData;
      });
    },

    // Toggle project expanded state
    toggleProjectExpanded: (projectId: string) => {
      update(data => {
        const newData = {
          ...data,
          uiState: {
            ...data.uiState,
            expandedProjects: {
              ...data.uiState.expandedProjects,
              [projectId]: !data.uiState.expandedProjects[projectId]
            }
          }
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        return newData;
      });
    },

    // Toggle section expanded state
    toggleSectionExpanded: (sectionId: string) => {
      update(data => {
        const newData = {
          ...data,
          uiState: {
            ...data.uiState,
            expandedSections: {
              ...data.uiState.expandedSections,
              [sectionId]: !data.uiState.expandedSections[sectionId]
            }
          }
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        return newData;
      });
    }
  };
}

function shouldReset(resetTime: ResetTime, lastReset: number, now: number): boolean {
  const lastResetDate = new Date(lastReset);
  const nowDate = new Date(now);
  
  if (resetTime.type === 'daily') {
    // Check if it's past reset time today and we haven't reset today
    const [hours, minutes] = resetTime.time.split(':').map(Number);
    const resetToday = new Date(nowDate);
    resetToday.setHours(hours, minutes, 0, 0);
    
    // If reset time hasn't passed today, check yesterday
    if (nowDate < resetToday) {
      resetToday.setDate(resetToday.getDate() - 1);
    }
    
    return lastReset < resetToday.getTime();
  } else if (resetTime.type === 'weekly') {
    const [hours, minutes] = resetTime.time.split(':').map(Number);
    const resetDay = resetTime.weekday || 0;
    
    // Find the most recent reset day
    const resetThisWeek = new Date(nowDate);
    const dayDiff = resetThisWeek.getDay() - resetDay;
    resetThisWeek.setDate(resetThisWeek.getDate() - (dayDiff >= 0 ? dayDiff : dayDiff + 7));
    resetThisWeek.setHours(hours, minutes, 0, 0);
    
    // If reset time hasn't passed this week, check last week
    if (nowDate < resetThisWeek) {
      resetThisWeek.setDate(resetThisWeek.getDate() - 7);
    }
    
    return lastReset < resetThisWeek.getTime();
  }
  
  return false;
}

export const todoStore = createTodoStore();