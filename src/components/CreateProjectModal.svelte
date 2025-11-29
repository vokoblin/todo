<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { todoStore } from '../stores';
  import type { TodoProject, TodoItem, PresetProject, ResetTime } from '../types';

  const dispatch = createEventDispatcher();

  export let editingProject: TodoProject | null = null;

  let showPresets = true;
  let presets: PresetProject[] = [];
  let selectedPreset: PresetProject | null = null;

  // Group presets by category
  $: examplePresets = presets.filter(p => p.category === 'example');
  $: communityPresets = presets.filter(p => p.category === 'community');

  // Custom project form
  let projectName = '';
  let projectDescription = '';
  let customItems: TodoItem[] = [];
  let editingItem: TodoItem | null = null;
  let showItemForm = false;
  let draggedItem: TodoItem | null = null;
  let itemsContainer: HTMLElement;
  let autoScrollInterval: NodeJS.Timeout | null = null;

  onMount(async () => {
    await loadPresets();

    // If editing a project, pre-populate the form
    if (editingProject) {
      showPresets = false;
      projectName = editingProject.name;
      projectDescription = editingProject.description || '';
      customItems = JSON.parse(JSON.stringify(editingProject.items)); // Deep clone
    }
  });

  onDestroy(() => {
    // Clean up auto-scroll interval if component unmounts while dragging
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  });

  async function loadPresets() {
    try {
      const presetNames = ['mmo-dailies', 'gacha-game', 'where-winds-meet'];
      const loadedPresets = await Promise.all(
        presetNames.map(async (name) => {
          const response = await fetch(`/presets/${name}.json`);
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

    // First pass: create ID mapping from old preset IDs to new generated IDs
    const idMap = new Map<string, string>();
    selectedPreset.items.forEach(item => {
      idMap.set(item.id, generateId());
    });

    const project: TodoProject = {
      id: generateId(),
      name: selectedPreset.name,
      description: selectedPreset.description,
      items: selectedPreset.items.map(item => ({
        ...item,
        id: idMap.get(item.id)!,
        status: 'pending' as const,
        lastReset: item.resetTime ? 0 : undefined,
        parentId: item.parentId ? idMap.get(item.parentId) || null : null,
        counterCurrent: item.itemType === 'counter' ? 0 : undefined
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

    if (editingProject) {
      // Update existing project
      todoStore.updateProject(editingProject.id, {
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        items: customItems
      });
    } else {
      // Create new project
      const project: TodoProject = {
        id: generateId(),
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        items: customItems,
        createdAt: Date.now()
      };
      todoStore.addProject(project);
    }

    close();
  }

  function addCustomItem() {
    showItemForm = true;
    editingItem = {
      id: generateId(),
      name: '',
      description: '',
      status: 'pending',
      resetTime: undefined,
      lastReset: undefined,
      parentId: undefined,
      isSection: false,
      itemType: 'checkbox',
      counterTarget: undefined,
      counterCurrent: undefined
    };
  }

  function editItem(item: TodoItem) {
    showItemForm = true;
    editingItem = JSON.parse(JSON.stringify(item)); // Deep clone
  }

  function saveItem() {
    if (!editingItem?.name.trim()) return;

    // Ensure counter items have proper initialization
    if (editingItem.itemType === 'counter') {
      if (editingItem.counterCurrent === undefined || editingItem.counterCurrent === null) {
        editingItem.counterCurrent = 0;
      }
      if (!editingItem.counterTarget) {
        editingItem.counterTarget = 5; // Default target
      }
    } else {
      // Not a counter, clear counter fields
      editingItem.counterTarget = undefined;
      editingItem.counterCurrent = undefined;
    }

    const itemIndex = customItems.findIndex(item => item.id === editingItem!.id);
    if (itemIndex >= 0) {
      // Update existing item - create new array to trigger reactivity
      customItems = customItems.map(item =>
        item.id === editingItem!.id ? { ...editingItem } : item
      );
    } else {
      // Add new item
      customItems = [...customItems, { ...editingItem }];
    }

    cancelItemEdit();
  }

  function cancelItemEdit() {
    editingItem = null;
    showItemForm = false;
  }

  function removeItem(itemId: string) {
    const item = customItems.find(item => item.id === itemId);
    if (item?.isSection) {
      // When removing a section, move its children to root level
      customItems = customItems.map(item => 
        item.parentId === itemId ? { ...item, parentId: undefined } : item
      ).filter(item => item.id !== itemId);
    } else {
      // Remove task normally
      customItems = customItems.filter(item => item.id !== itemId);
    }
  }

  function generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Helper function to check if an item is a descendant of another (prevents circular nesting)
  function isDescendantOf(itemId: string, ancestorId: string): boolean {
    const item = customItems.find(i => i.id === itemId);
    if (!item || !item.parentId) return false;
    if (item.parentId === ancestorId) return true;
    return isDescendantOf(item.parentId, ancestorId);
  }

  // Drag and Drop handlers
  function handleDragStart(event: DragEvent, item: TodoItem) {
    draggedItem = item;
    event.dataTransfer!.effectAllowed = 'move';
  }

  function handleDragOver(event: DragEvent, targetItem: TodoItem) {
    event.preventDefault();
    if (draggedItem && draggedItem.id !== targetItem.id) {
      // Prevent dropping a section into itself or its descendants
      if (draggedItem.isSection && isDescendantOf(targetItem.id, draggedItem.id)) {
        event.dataTransfer!.dropEffect = 'none';
        return;
      }
      event.dataTransfer!.dropEffect = 'move';
    }
  }

  function handleDrop(event: DragEvent, targetItem: TodoItem) {
    event.preventDefault();
    if (draggedItem && draggedItem.id !== targetItem.id) {
      // Prevent dropping a section into itself or its descendants
      if (draggedItem.isSection && isDescendantOf(targetItem.id, draggedItem.id)) {
        draggedItem = null;
        return;
      }

      if (targetItem.isSection) {
        // Drop item (task or section) into section
        customItems = customItems.map(item =>
          item.id === draggedItem!.id
            ? { ...item, parentId: targetItem.id }
            : item
        );
      } else {
        // Dropping on a non-section item
        const draggedParentId = draggedItem.parentId;
        const targetParentId = targetItem.parentId;

        // Update parent if needed
        const updatedItems = customItems.map(item =>
          item.id === draggedItem!.id
            ? { ...item, parentId: targetParentId }
            : item
        );

        // Reorder items within the same parent
        const draggedIndex = updatedItems.findIndex(item => item.id === draggedItem!.id);
        const targetIndex = updatedItems.findIndex(item => item.id === targetItem.id);

        // Remove dragged item from its current position
        const [removed] = updatedItems.splice(draggedIndex, 1);

        // Find new target index (it may have shifted after removal)
        const newTargetIndex = updatedItems.findIndex(item => item.id === targetItem.id);

        // Insert before or after target based on drag direction
        if (draggedIndex < targetIndex) {
          // Dragging down - insert after target
          updatedItems.splice(newTargetIndex + 1, 0, removed);
        } else {
          // Dragging up - insert before target
          updatedItems.splice(newTargetIndex, 0, removed);
        }

        customItems = updatedItems;
      }
    }
    draggedItem = null;
  }

  function handleDragEnd() {
    draggedItem = null;
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  }

  function handleContainerDragOver(event: DragEvent) {
    if (!draggedItem || !itemsContainer) return;

    const rect = itemsContainer.getBoundingClientRect();
    const scrollThreshold = 50; // pixels from edge to trigger scroll
    const scrollSpeed = 10; // pixels per frame
    const mouseY = event.clientY;

    // Clear any existing interval
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }

    if (mouseY - rect.top < scrollThreshold && itemsContainer.scrollTop > 0) {
      // Scroll up
      autoScrollInterval = setInterval(() => {
        if (itemsContainer.scrollTop > 0) {
          itemsContainer.scrollTop -= scrollSpeed;
        } else {
          clearInterval(autoScrollInterval!);
          autoScrollInterval = null;
        }
      }, 16);
    } else if (rect.bottom - mouseY < scrollThreshold) {
      // Scroll down
      const maxScroll = itemsContainer.scrollHeight - itemsContainer.clientHeight;
      if (itemsContainer.scrollTop < maxScroll) {
        autoScrollInterval = setInterval(() => {
          const maxScroll = itemsContainer.scrollHeight - itemsContainer.clientHeight;
          if (itemsContainer.scrollTop < maxScroll) {
            itemsContainer.scrollTop += scrollSpeed;
          } else {
            clearInterval(autoScrollInterval!);
            autoScrollInterval = null;
          }
        }, 16);
      }
    }
  }

  function handleRootDropZoneDragOver(event: DragEvent) {
    event.preventDefault();
    if (draggedItem) {
      event.dataTransfer!.dropEffect = 'move';
    }
  }

  function handleRootDropZoneDrop(event: DragEvent) {
    event.preventDefault();
    if (draggedItem) {
      customItems = customItems.map(item =>
        item.id === draggedItem!.id
          ? { ...item, parentId: undefined }
          : item
      );
    }
    draggedItem = null;
  }

  // Reactive declaration for hierarchical items
  $: hierarchicalItems = (() => {
    const rootItems = customItems.filter(item => !item.parentId);
    const result: (TodoItem & { level: number })[] = [];

    function addItemsRecursively(items: TodoItem[], level: number) {
      items.forEach(item => {
        result.push({ ...item, level });
        if (item.isSection) {
          const children = customItems.filter(child => child.parentId === item.id);
          if (children.length > 0) {
            addItemsRecursively(children, level + 1);
          }
        }
      });
    }

    addItemsRecursively(rootItems, 0);
    return result;
  })();

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
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          {editingProject ? 'Edit TODO' : 'Create New TODO'}
        </h2>
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
            <p class="text-gray-600 dark:text-gray-300">Start with a pre-configured template or create a custom TODO</p>
          </div>

          <!-- Examples Section -->
          {#if examplePresets.length > 0}
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h4 class="text-base font-semibold text-gray-900 dark:text-white">Examples</h4>
              </div>
              <div class="grid gap-3">
                {#each examplePresets as preset (preset.name)}
                  <button
                    on:click={() => selectPreset(preset)}
                    class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg text-left hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    <h5 class="font-medium text-gray-900 dark:text-white mb-1">{preset.name}</h5>
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
            </div>
          {/if}

          <!-- Community Section -->
          {#if communityPresets.length > 0}
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h4 class="text-base font-semibold text-gray-900 dark:text-white">Community</h4>
              </div>
              <div class="grid gap-3">
                {#each communityPresets as preset (preset.name)}
                  <button
                    on:click={() => selectPreset(preset)}
                    class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg text-left hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                  >
                    <h5 class="font-medium text-gray-900 dark:text-white mb-1">{preset.name}</h5>
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
            </div>
          {/if}

          <div class="border-t border-gray-200 dark:border-gray-600 pt-6">
            <button
              on:click={switchToCustom}
              class="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <svg class="w-8 h-8 mx-auto text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span class="text-sm font-medium text-gray-900 dark:text-white">Create Custom TODO</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Custom TODO Creation -->
        <div class="space-y-6">
          <div>
            {#if !editingProject}
              <button
                on:click={() => showPresets = true}
                class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-4"
              >
                ← Back to Presets
              </button>
            {/if}
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  TODO Name *
                </label>
                <input
                  bind:value={projectName}
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter TODO name"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  bind:value={projectDescription}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Describe your TODO"
                  rows="2"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Custom Items -->
          <div>
            <div class="mb-4">
              <div class="flex items-center justify-between mb-2">
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
              {#if customItems.length > 0}
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  💡 Drag items onto sections to nest them, or drag to other positions to reorder. Sections can be nested within other sections.
                </p>
              {/if}
            </div>

            <div
              class="space-y-2 max-h-96 overflow-y-auto"
              bind:this={itemsContainer}
              on:dragover={handleContainerDragOver}
            >
              {#each hierarchicalItems as item (item.id)}
                <div
                  class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-move transition-all duration-200
                    {draggedItem?.id === item.id ? 'opacity-50 scale-95' : ''}
                    {item.isSection ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' : ''}
                    {draggedItem && draggedItem.id !== item.id && item.isSection && !(draggedItem.isSection && isDescendantOf(item.id, draggedItem.id)) ? 'ring-2 ring-blue-300 dark:ring-blue-600' : ''}"
                  style="margin-left: {item.level * 20}px"
                  draggable="true"
                  on:dragstart={(e) => handleDragStart(e, item)}
                  on:dragover={(e) => handleDragOver(e, item)}
                  on:drop={(e) => handleDrop(e, item)}
                  on:dragend={handleDragEnd}
                >
                  <div class="flex items-center gap-2 flex-1">
                    {#if item.level > 0}
                      <span class="text-gray-400 dark:text-gray-500">└─</span>
                    {/if}
                    <span class="font-medium text-gray-900 dark:text-white">
                      {item.isSection ? '📁' : '📋'} {item.name}
                    </span>
                    {#if item.isSection && customItems.filter(child => child.parentId === item.id).length > 0}
                      <span class="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                        {customItems.filter(child => child.parentId === item.id).length} items
                      </span>
                    {/if}
                  </div>
                  {#if item.description}
                    <p class="text-sm text-gray-600 dark:text-gray-300 flex-1">{item.description}</p>
                  {/if}
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400 cursor-grab">⋮⋮</span>
                    <button
                      on:click={() => editItem(item)}
                      class="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                      title="Edit item"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      on:click={() => removeItem(item.id)}
                      class="text-gray-400 hover:text-red-600"
                      title="Delete item"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
              
              {#if customItems.length === 0}
                <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                  <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p class="text-sm">No tasks or sections yet</p>
                  <p class="text-xs">Click "Add Item" to get started</p>
                </div>
              {:else}
                <!-- Drop zone for moving items back to root -->
                <div
                  class="mt-2 p-4 border-2 border-dashed rounded-lg text-center transition-all duration-200
                    {draggedItem ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30'}"
                  on:dragover={handleRootDropZoneDragOver}
                  on:drop={handleRootDropZoneDrop}
                >
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {draggedItem ? '📦 Drop here to move to root level' : 'Drop items here to move to root level'}
                  </p>
                </div>
              {/if}
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
              {editingProject ? 'Save Changes' : 'Create TODO'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showItemForm && editingItem}
  <!-- Item Form Modal -->
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[70]">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
        {#if customItems.some(item => item.id === editingItem.id)}
          {editingItem.isSection ? 'Edit Section' : 'Edit Task'}
        {:else}
          {editingItem.isSection ? 'Add Section' : 'Add Task'}
        {/if}
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
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Type</label>
            <select
              bind:value={editingItem.itemType}
              on:change={() => {
                if (editingItem.itemType === 'counter') {
                  editingItem.counterTarget = 5;
                  editingItem.counterCurrent = 0;
                } else {
                  editingItem.counterTarget = undefined;
                  editingItem.counterCurrent = undefined;
                }
              }}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="checkbox">Checkbox (Complete once)</option>
              <option value="counter">Counter (Complete multiple times)</option>
            </select>
          </div>

          {#if editingItem.itemType === 'counter'}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Count</label>
              <input
                bind:value={editingItem.counterTarget}
                type="number"
                min="1"
                max="999"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Number of times to complete this task</p>
            </div>
          {/if}
        {/if}

        {#if !editingItem.isSection}
          <div>
            <label class="flex items-center">
              <input
                type="checkbox"
                checked={!!editingItem.resetTime}
                on:change={(e) => {
                  if (e.currentTarget.checked) {
                    editingItem.resetTime = { type: 'daily', time: '20:00' };
                    editingItem.lastReset = 0;
                  } else {
                    editingItem.resetTime = undefined;
                    editingItem.lastReset = undefined;
                  }
                }}
                class="mr-2"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Enable automatic reset</span>
            </label>
          </div>

          {#if editingItem.resetTime}
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
          {#if customItems.some(item => item.id === editingItem.id)}
            Save {editingItem.isSection ? 'Section' : 'Task'}
          {:else}
            Add {editingItem.isSection ? 'Section' : 'Task'}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}