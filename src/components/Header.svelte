<script lang="ts">
  import { todoStore } from '../stores';

  let theme = 'light';
  let fileInput: HTMLInputElement;
  let errorMessage = '';
  let successMessage = '';

  todoStore.subscribe(data => {
    theme = data.settings.theme;
    // Apply theme to document
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  });

  function toggleTheme() {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    todoStore.updateSettings({ theme: newTheme });
  }

  function handleExport() {
    try {
      todoStore.exportData();
      showSuccess('Data exported successfully!');
    } catch (e) {
      showError('Failed to export data');
    }
  }

  function handleImportClick() {
    fileInput.click();
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = todoStore.smartImport(content);

      if (result.success) {
        if (result.type === 'full') {
          showSuccess('Full backup imported successfully!');
        } else if (result.type === 'project') {
          showSuccess('Project imported successfully!');
        } else {
          showSuccess('Data imported successfully!');
        }
      } else {
        showError(result.error || 'Failed to import data');
      }
    };
    reader.onerror = () => {
      showError('Failed to read file');
    };
    reader.readAsText(file);

    // Reset input
    input.value = '';
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

<header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center py-4">
      <div class="flex items-center">
        <svg class="w-8 h-8 text-indigo-600 dark:text-indigo-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-xl font-semibold text-gray-900 dark:text-white">Game TODO</span>
      </div>

      <div class="flex items-center gap-2">
        <!-- Export button -->
        <button
          on:click={handleExport}
          class="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Export data"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>

        <!-- Import button -->
        <button
          on:click={handleImportClick}
          class="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Import data"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>

        <!-- Theme toggle button -->
        <button
          on:click={toggleTheme}
          class="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Toggle theme"
        >
          {#if theme === 'light'}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          {/if}
        </button>
      </div>
    </div>

    <!-- Notifications -->
    {#if successMessage}
      <div class="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200 rounded-lg">
        {successMessage}
      </div>
    {/if}

    {#if errorMessage}
      <div class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
        {errorMessage}
      </div>
    {/if}
  </div>

  <!-- Hidden file input for import -->
  <input
    bind:this={fileInput}
    type="file"
    accept=".json"
    on:change={handleFileSelect}
    class="hidden"
  />
</header>