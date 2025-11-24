<script lang="ts">
  import { onMount } from 'svelte';
  import TailwindCss from "./lib/TailwindCSS.svelte";
  import TodoList from "./components/TodoList.svelte";
  import { todoStore } from './stores';

  onMount(() => {
    todoStore.init();
    // Check for resets every minute
    const interval = setInterval(() => {
      todoStore.checkResets();
    }, 60000);
    
    return () => clearInterval(interval);
  });
</script>

<TailwindCss />

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
  <TodoList />
</div>
