<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { todoStore } from '../stores';
  import type { TodoProject, TodoItem, PresetProject, ResetTime } from '../types';

  const dispatch = createEventDispatcher();

  let showPresets = true;
  let presets: PresetProject[] = [];
  let selectedPreset: PresetProject | null = null;
  
  // Custom project form
  let projectName = '';
  let projectDescription = '';
  let customItems: TodoItem[] = [];
  let editingItem: TodoItem | null = null;
  let showItemForm = false;

  onMount(async () => {
    await loadPresets();
  });

  async function loadPresets() {
    try {
      const presetNames = ['mmo-dailies', 'gacha-game'];
      const loadedPresets = await Promise.all(
        presetNames.map(async (name) => {
          const response = await fetch(`/todo/presets/${name}.json`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        })
      );
      presets = loadedPresets.filter(p => p !== null);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }

  function selectPreset(preset: PresetProject) {
    selectedPreset = preset;
    createProjectFromPreset();
  }

  function createProjectFromPreset() {
    if (!selectedPreset) return;
    
    const project: TodoProject = {
      id: generateId(),
      name: selectedPreset.name,
      description: selectedPreset.description,
      items: selectedPreset.items.map(item => ({
        ...item,
        id: generateId(),
        status: 'pending' as const,
        lastReset: 0,
        parentId: null // Simplified: all items at root level for now
      })),
      createdAt: Date.now(),
      isPreset: true
    };

    todoStore.addProject(project);
    close();
  }

  function getOriginalId(item: any): string {
    // Generate a consistent ID based on item properties for mapping
    return item.name.toLowerCase().replace(/\s+/g, '-');
  }

  function switchToCustom() {
    showPresets = false;
    selectedPreset = null;
  }

  function createCustomProject() {
    if (!projectName.trim()) return;

    const project: TodoProject = {
      id: generateId(),
      name: projectName.trim(),
      description: projectDescription.trim() || undefined,
      items: customItems,
      createdAt: Date.now()
    };

    todoStore.addProject(project);
    close();
  }

  function addCustomItem() {
    showItemForm = true;
    editingItem = {
      id: generateId(),
      name: '',
      description: '',
      status: 'pending',
      resetTime: { type: 'daily', time: '20:00' },
      lastReset: 0,
      parentId: null,
      isSection: false
    };
  }

  function saveItem() {
    if (!editingItem?.name.trim()) return;
    
    const itemIndex = customItems.findIndex(item => item.id === editingItem!.id);
    if (itemIndex >= 0) {
      customItems[itemIndex] = { ...editingItem };
    } else {
      customItems = [...customItems, { ...editingItem }];
    }
    
    cancelItemEdit();
  }

  function cancelItemEdit() {
    editingItem = null;
    showItemForm = false;
  }

  function removeItem(itemId: string) {
    customItems = customItems.filter(item => item.id !== itemId);
  }

  function generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  function close() {
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }
</script>

<div 
  class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
  on:click={handleBackdropClick}
>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Create New Project</h2>
        <button
          on:click={close}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {#if showPresets}
        <!-- Preset Selection -->
        <div class="space-y-6">
          <div class="text-center">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Choose a Preset</h3>
            <p class="text-gray-600 dark:text-gray-300">Start with a pre-configured template or create a custom project</p>
          </div>

          <div class="grid gap-4">
            {#each presets as preset (preset.name)}
              <button
                on:click={() => selectPreset(preset)}
                class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg text-left hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <h4 class="font-medium text-gray-900 dark:text-white mb-1">{preset.name}</h4>
                {#if preset.description}
                  <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">{preset.description}</p>
                {/if}
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {preset.items.filter(item => !item.isSection).length} tasks, 
                  {preset.items.filter(item => item.isSection).length} sections
                </p>
              </button>
            {/each}
          </div>

          <div class="border-t border-gray-200 dark:border-gray-600 pt-6">
            <button
              on:click={switchToCustom}
              class="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <svg class="w-8 h-8 mx-auto text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span class="text-sm font-medium text-gray-900 dark:text-white">Create Custom Project</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Custom Project Creation -->
        <div class="space-y-6">
          <div>
            <button
              on:click={() => showPresets = true}
              class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-4"
            >
              ← Back to Presets
            </button>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  bind:value={projectName}
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter project name"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  bind:value={projectDescription}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Describe your project"
                  rows="2"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Custom Items -->
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Tasks & Sections</h3>
              <button
                on:click={addCustomItem}
                class="inline-flex items-center px-3 py-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Item
              </button>
            </div>

            <div class="space-y-2 max-h-40 overflow-y-auto">
              {#each customItems as item (item.id)}
                <div class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div class="flex-1">
                    <span class="font-medium text-gray-900 dark:text-white">
                      {item.isSection ? '📁' : '📋'} {item.name}
                    </span>
                    {#if item.description}
                      <p class="text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
                    {/if}
                  </div>
                  <button
                    on:click={() => removeItem(item.id)}
                    class="text-gray-400 hover:text-red-600"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          </div>

          <div class="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-600">
            <button
              on:click={close}
              class="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              on:click={createCustomProject}
              disabled={!projectName.trim()}
              class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create Project
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showItemForm && editingItem}
  <!-- Item Form Modal -->
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-60">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
        {editingItem.isSection ? 'Add Section' : 'Add Task'}
      </h3>
      
      <div class="space-y-4">
        <div class="flex gap-4 mb-4">
          <label class="flex items-center">
            <input
              type="radio"
              bind:group={editingItem.isSection}
              value={false}
              class="mr-2"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">Task</span>
          </label>
          <label class="flex items-center">
            <input
              type="radio"
              bind:group={editingItem.isSection}
              value={true}
              class="mr-2"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">Section</span>
          </label>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
          <input
            bind:value={editingItem.name}
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <input
            bind:value={editingItem.description}
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {#if !editingItem.isSection}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reset Schedule</label>
            <select
              bind:value={editingItem.resetTime.type}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
              <input
                bind:value={editingItem.resetTime.time}
                type="time"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            {#if editingItem.resetTime.type === 'weekly'}
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day</label>
                <select
                  bind:value={editingItem.resetTime.weekday}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex gap-2 mt-6">
        <button
          on:click={cancelItemEdit}
          class="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          on:click={saveItem}
          disabled={!editingItem.name.trim()}
          class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add {editingItem.isSection ? 'Section' : 'Task'}
        </button>
      </div>
    </div>
  </div>
{/if}