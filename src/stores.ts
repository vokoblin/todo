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

    // Increment counter for counter-type items
    incrementCounter: (projectId: string, itemId: string) => {
      update(data => {
        const newData = {
          ...data,
          projects: data.projects.map(project => {
            if (project.id === projectId) {
              return {
                ...project,
                items: project.items.map(item => {
                  if (item.id === itemId && item.itemType === 'counter') {
                    const newCurrent = (item.counterCurrent ?? 0) + 1;
                    const target = item.counterTarget ?? 0;
                    return {
                      ...item,
                      counterCurrent: newCurrent,
                      status: newCurrent >= target ? 'completed' : 'pending'
                    };
                  }
                  return item;
                })
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

    // Decrement counter for counter-type items
    decrementCounter: (projectId: string, itemId: string) => {
      update(data => {
        const newData = {
          ...data,
          projects: data.projects.map(project => {
            if (project.id === projectId) {
              return {
                ...project,
                items: project.items.map(item => {
                  if (item.id === itemId && item.itemType === 'counter') {
                    const newCurrent = Math.max(0, (item.counterCurrent ?? 0) - 1);
                    const target = item.counterTarget ?? 0;
                    return {
                      ...item,
                      counterCurrent: newCurrent,
                      status: newCurrent >= target ? 'completed' : 'pending'
                    };
                  }
                  return item;
                })
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
              // Skip items without reset time
              if (!item.resetTime) {
                return item;
              }

              // Initialize lastReset if missing (for legacy data or edge cases)
              if (item.lastReset === undefined || item.lastReset === null) {
                hasChanges = true;
                return { ...item, lastReset: 0 };
              }

              // Check if item needs to be reset
              if (shouldReset(item.resetTime, item.lastReset, now)) {
                hasChanges = true;
                // For counter items, also reset the counter
                if (item.itemType === 'counter') {
                  return { ...item, status: 'pending', lastReset: now, counterCurrent: 0 };
                }
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
    },

    // Export data as JSON file
    exportData: () => {
      let currentData: TodoData = defaultData;
      const unsubscribe = subscribe(data => {
        currentData = data;
      });
      unsubscribe();

      const jsonString = JSON.stringify(currentData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      link.download = `game-todo-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    // Export single project as JSON file
    exportProject: (projectId: string) => {
      let currentData: TodoData = defaultData;
      const unsubscribe = subscribe(data => {
        currentData = data;
      });
      unsubscribe();

      const project = currentData.projects.find(p => p.id === projectId);
      if (!project) {
        console.error('Project not found');
        return;
      }

      const jsonString = JSON.stringify(project, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      link.download = `todo-${fileName}-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    // Smart import that handles both full data and single project
    smartImport: (jsonString: string): { success: boolean; error?: string; type?: 'full' | 'project' } => {
      try {
        const data = JSON.parse(jsonString);

        if (!data || typeof data !== 'object') {
          return { success: false, error: 'Invalid JSON format' };
        }

        // Check if it's a full data export (has projects array and settings)
        if (Array.isArray(data.projects) && data.settings) {
          // It's a full data export
          const result = { success: false, error: '' };

          // Validate the structure
          if (!data.settings || typeof data.settings !== 'object') {
            return { success: false, error: 'Missing or invalid settings' };
          }

          // Ensure uiState exists
          if (!data.uiState) {
            data.uiState = {
              expandedProjects: {},
              expandedSections: {}
            };
          }

          // Validate and fix each project
          for (const project of data.projects) {
            if (!project.id || !project.name || !Array.isArray(project.items)) {
              return { success: false, error: 'Invalid project structure' };
            }

            // Validate and fix each item
            for (let i = 0; i < project.items.length; i++) {
              const item = project.items[i];
              if (!item.id) {
                return { success: false, error: `Item ${i} missing 'id' field` };
              }
              if (!item.name) {
                return { success: false, error: `Item ${i} (${item.id}) missing 'name' field` };
              }

              // Provide defaults for missing fields
              if (item.status === undefined || item.status === null) {
                item.status = 'pending';
              }
              if (typeof item.isSection !== 'boolean') {
                item.isSection = false;
              }
              // Ensure itemType has a default
              if (!item.itemType) {
                item.itemType = 'checkbox';
              }
              // Ensure counter items have proper fields
              if (item.itemType === 'counter') {
                if (typeof item.counterCurrent !== 'number') {
                  item.counterCurrent = 0;
                }
                if (typeof item.counterTarget !== 'number') {
                  item.counterTarget = 5; // Default target
                }
              } else {
                // Not a counter, remove counter fields
                item.counterCurrent = undefined;
                item.counterTarget = undefined;
              }
              // Ensure resetTime and lastReset are consistent
              if (item.resetTime && typeof item.lastReset !== 'number') {
                item.lastReset = 0; // Set to 0 so it will reset on first check
              }
              // Remove lastReset if no resetTime
              if (!item.resetTime && item.lastReset !== undefined) {
                item.lastReset = undefined;
              }
            }
          }

          // If all validations pass, save the data
          set(data);
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          }

          return { success: true, type: 'full' };
        }
        // Check if it's a single project export (has id, name, items)
        else if (data.id && data.name && Array.isArray(data.items)) {
          // It's a single project export
          const project = data;

          // Validate and fix each item
          for (let i = 0; i < project.items.length; i++) {
            const item = project.items[i];
            if (!item.id) {
              return { success: false, error: `Item ${i} missing 'id' field` };
            }
            if (!item.name) {
              return { success: false, error: `Item ${i} (${item.id}) missing 'name' field` };
            }

            // Provide defaults for missing fields
            if (item.status === undefined || item.status === null) {
              item.status = 'pending';
            }
            if (typeof item.isSection !== 'boolean') {
              item.isSection = false;
            }
            // Ensure itemType has a default
            if (!item.itemType) {
              item.itemType = 'checkbox';
            }
            // Ensure counter items have proper fields
            if (item.itemType === 'counter') {
              if (typeof item.counterCurrent !== 'number') {
                item.counterCurrent = 0;
              }
              if (typeof item.counterTarget !== 'number') {
                item.counterTarget = 5; // Default target
              }
            } else {
              // Not a counter, remove counter fields
              item.counterCurrent = undefined;
              item.counterTarget = undefined;
            }
            // Ensure resetTime and lastReset are consistent
            if (item.resetTime && typeof item.lastReset !== 'number') {
              item.lastReset = 0; // Set to 0 so it will reset on first check
            }
            // Remove lastReset if no resetTime
            if (!item.resetTime && item.lastReset !== undefined) {
              item.lastReset = undefined;
            }
          }

          // Check if project with same ID exists
          update(currentData => {
            const existingIndex = currentData.projects.findIndex(p => p.id === project.id);

            let newProjects;
            if (existingIndex !== -1) {
              // Replace existing project
              newProjects = [...currentData.projects];
              newProjects[existingIndex] = project;
            } else {
              // Add new project
              newProjects = [...currentData.projects, project];
            }

            const newData = {
              ...currentData,
              projects: newProjects
            };

            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
            }

            return newData;
          });

          return { success: true, type: 'project' };
        } else {
          return { success: false, error: 'Unrecognized file format. File must be either a full backup or a single project export.' };
        }
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to parse JSON' };
      }
    }
  };
}

/**
 * Calculates the most recent scheduled reset time that has already occurred
 */
function getMostRecentResetTime(resetTime: ResetTime, now: number): number {
  const nowDate = new Date(now);
  const [hours, minutes] = resetTime.time.split(':').map(Number);

  if (resetTime.type === 'daily') {
    // Create reset time for today
    const resetToday = new Date(nowDate);
    resetToday.setHours(hours, minutes, 0, 0);

    // If reset time hasn't passed today yet, use yesterday's reset time
    if (nowDate < resetToday) {
      resetToday.setDate(resetToday.getDate() - 1);
    }

    return resetToday.getTime();
  } else if (resetTime.type === 'weekly') {
    const targetDay = resetTime.weekday || 0;
    const currentDay = nowDate.getDay();

    // Calculate days since the most recent target weekday
    let daysSince = (currentDay - targetDay + 7) % 7;

    // Create reset time for the most recent target weekday
    const mostRecentReset = new Date(nowDate);
    mostRecentReset.setDate(mostRecentReset.getDate() - daysSince);
    mostRecentReset.setHours(hours, minutes, 0, 0);

    // If we're on the target day but haven't reached reset time yet,
    // use last week's reset time instead
    if (daysSince === 0 && nowDate < mostRecentReset) {
      mostRecentReset.setDate(mostRecentReset.getDate() - 7);
    }

    return mostRecentReset.getTime();
  }

  return now;
}

/**
 * Determines if a todo item should be reset based on its reset schedule.
 * Returns true if lastReset is before the most recent scheduled reset time.
 */
function shouldReset(resetTime: ResetTime, lastReset: number, now: number): boolean {
  const mostRecentResetTime = getMostRecentResetTime(resetTime, now);
  return lastReset < mostRecentResetTime;
}

export const todoStore = createTodoStore();