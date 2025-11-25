<script lang="ts">
  import { todoStore } from '../stores';
  import type { TodoProject } from '../types';
  import TodoItemComponent from './TodoItemComponent.svelte';

  export let project: TodoProject;

  $: expanded = $todoStore.uiState?.expandedProjects?.[project.id] ?? false;
  $: completedCount = project.items.filter(item => !item.isSection && item.status === 'completed').length;
  $: totalTasks = project.items.filter(item => !item.isSection).length;
  $: completionPercentage = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
  $: rootItems = project.items.filter(item => !item.parentId);

  function toggleExpanded() {
    todoStore.toggleProjectExpanded(project.id);
  }

  function deleteProject() {
    if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
      todoStore.deleteProject(project.id);
    }
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
  <div class="p-6">
    <div class="flex items-start justify-between mb-4">
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{project.name}</h3>
        {#if project.description}
          <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">{project.description}</p>
        {/if}
        
        <!-- Progress bar -->
        <div class="flex items-center gap-3 mb-3">
          <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              class="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
              style="width: {completionPercentage}%"
            ></div>
          </div>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            {completedCount}/{totalTasks}
          </span>
        </div>
      </div>
      
      <div class="flex items-center gap-2 ml-4">
        <button
          on:click={toggleExpanded}
          class="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <svg class="w-5 h-5 transform transition-transform {expanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <button
          on:click={deleteProject}
          class="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Delete project"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    {#if expanded}
      <div class="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
        {#each rootItems as item (item.id)}
          <TodoItemComponent 
            {item} 
            projectId={project.id}
            allItems={project.items}
            depth={0}
          />
        {/each}
      </div>
    {/if}
  </div>
</div>