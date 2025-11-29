<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { todoStore } from '../stores';
  import type { TodoProject } from '../types';
  import TodoItemComponent from './TodoItemComponent.svelte';

  const dispatch = createEventDispatcher();

  export let project: TodoProject;

  let expanded = false;
  let errorMessage = '';
  let successMessage = '';

  $: {
    if ($todoStore.uiState && $todoStore.uiState.expandedProjects) {
      expanded = $todoStore.uiState.expandedProjects[project.id] === true;
    } else {
      expanded = false;
    }
  }
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

  function editProject() {
    dispatch('edit', project);
  }

  function handleExportProject() {
    try {
      todoStore.exportProject(project.id);
      showSuccess('Project exported successfully!');
    } catch (e) {
      showError('Failed to export project');
    }
  }

  function showSuccess(message: string) {
    successMessage = message;
    errorMessage = '';
    setTimeout(() => {
      successMessage = '';
    }, 3000);
  }

  function showError(message: string) {
    errorMessage = message;
    successMessage = '';
    setTimeout(() => {
      errorMessage = '';
    }, 5000);
  }
</script>

<div
  class="rounded-xl shadow-sm border overflow-hidden transition-all duration-300 {expanded ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 shadow-lg' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}"
>
  <div class="p-6">
    <!-- Header with title and actions -->
    <div class="flex items-start justify-between mb-4">
      <div class="flex-1 min-w-0">
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{project.name}</h3>
        {#if project.description}
          <p class="text-base text-gray-600 dark:text-gray-300">{project.description}</p>
        {/if}
      </div>

      <div class="flex items-center gap-2 ml-6 flex-shrink-0">
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
          on:click={handleExportProject}
          class="p-2 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          title="Export project"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>

        <button
          on:click={editProject}
          class="p-2 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          title="Edit TODO"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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

    <!-- Progress bar - full width -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
        <span class="text-sm font-semibold text-gray-900 dark:text-white">
          {completedCount}/{totalTasks} ({Math.round(completionPercentage)}%)
        </span>
      </div>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
        <div
          class="bg-indigo-600 dark:bg-indigo-500 h-3 rounded-full transition-all duration-300"
          style="width: {completionPercentage}%"
        ></div>
      </div>
    </div>

    <!-- Notifications -->
    {#if successMessage}
      <div class="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200 rounded-lg text-sm">
        {successMessage}
      </div>
    {/if}

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg text-sm">
        {errorMessage}
      </div>
    {/if}

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