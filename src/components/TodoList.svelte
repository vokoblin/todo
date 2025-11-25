<script lang="ts">
  import { todoStore } from '../stores';
  import type { TodoProject } from '../types';
  import ProjectCard from './ProjectCard.svelte';
  import CreateProjectModal from './CreateProjectModal.svelte';
  import Header from './Header.svelte';

  let showCreateModal = false;
  let editingProject: TodoProject | null = null;
  let projects: TodoProject[] = [];

  todoStore.subscribe(data => {
    projects = data.projects;
  });

  function openCreateModal() {
    editingProject = null;
    showCreateModal = true;
  }

  function openEditModal(event: CustomEvent<TodoProject>) {
    editingProject = event.detail;
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
    editingProject = null;
  }
</script>

<Header />

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="flex justify-between items-center mb-8">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Game TODO Tracker</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-300">Track your daily and weekly game activities</p>
    </div>
    <button
      on:click={openCreateModal}
      class="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-colors"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      Add TODO
    </button>
  </div>

  {#if projects.length === 0}
    <div class="text-center py-12">
      <svg class="w-24 h-24 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">No TODOs yet</h2>
      <p class="text-gray-600 dark:text-gray-300 mb-6">Create your first TODO to start tracking game activities</p>
      <button
        on:click={openCreateModal}
        class="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-colors"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Create Your First TODO
      </button>
    </div>
  {:else}
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
      {#each projects as project (project.id)}
        <ProjectCard {project} on:edit={openEditModal} />
      {/each}
    </div>
  {/if}
</main>

{#if showCreateModal}
  <CreateProjectModal {editingProject} on:close={closeCreateModal} />
{/if}