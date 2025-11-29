<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { todoStore } from '../stores';
  import type { TodoItem } from '../types';

  export let item: TodoItem;
  export let projectId: string;
  export let allItems: TodoItem[];
  export let depth: number = 0;

  let timeRemaining = '';
  let timeInterval: NodeJS.Timeout;

  let sectionExpanded = true;
  
  $: {
    if (item.isSection) {
      if ($todoStore.uiState && $todoStore.uiState.expandedSections) {
        sectionExpanded = $todoStore.uiState.expandedSections[item.id] === true;
      } else {
        sectionExpanded = false;
      }
    } else {
      sectionExpanded = true;
    }
  }
  $: childItems = allItems.filter(child => child.parentId === item.id);

  // Check if all non-section child items are completed
  $: allTasksCompleted = (() => {
    if (item.isSection) {
      const getAllDescendantTasks = (sectionId: string): TodoItem[] => {
        const children = allItems.filter(child => child.parentId === sectionId);
        let tasks: TodoItem[] = [];
        children.forEach(child => {
          if (child.isSection) {
            tasks = [...tasks, ...getAllDescendantTasks(child.id)];
          } else {
            tasks.push(child);
          }
        });
        return tasks;
      };

      const allTasks = getAllDescendantTasks(item.id);
      return allTasks.length > 0 && allTasks.every(task => task.status === 'completed');
    } else {
      return false;
    }
  })();

  // Compute container classes
  $: containerClasses = [
    'flex items-center gap-3 p-3 rounded-lg transition-colors',
    item.isSection && !allTasksCompleted && 'bg-white dark:bg-gray-800',
    item.isSection && 'border-l-4',
    item.isSection && !allTasksCompleted && 'border-l-indigo-500',
    item.isSection && 'shadow-sm',
    item.isSection && allTasksCompleted && 'bg-green-100 dark:bg-green-800/50',
    item.isSection && allTasksCompleted && 'border-l-green-600',
    !item.isSection && item.status === 'pending' && 'bg-gray-50 dark:bg-gray-700/30',
    !item.isSection && item.status === 'completed' && 'bg-green-100 dark:bg-green-800/40',
    !item.isSection && 'border border-gray-200 dark:border-gray-600',
    !item.isSection && item.status === 'pending' && 'hover:bg-gray-100 dark:hover:bg-gray-700',
    !item.isSection && item.status === 'completed' && 'hover:bg-green-200 dark:hover:bg-green-800/50',
  ].filter(Boolean).join(' ');

  // Compute checkbox button classes
  $: checkboxClasses = [
    'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200',
    item.status === 'completed' ? 'bg-indigo-500 border-indigo-500 dark:border-indigo-400 dark:bg-indigo-400' : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400',
  ].join(' ');

  // Compute title classes
  $: titleClasses = [
    'font-medium transition-colors',
    item.status === 'pending' && 'text-gray-900 dark:text-white',
    item.status === 'completed' && 'text-gray-500 dark:text-gray-400 line-through',
  ].filter(Boolean).join(' ');

  // Compute description classes
  $: descriptionClasses = [
    'text-sm transition-colors',
    item.status === 'pending' && 'text-gray-600 dark:text-gray-300',
    item.status === 'completed' && 'text-gray-400 dark:text-gray-500',
  ].filter(Boolean).join(' ');

  onMount(() => {
    if (!item.isSection) {
      timeRemaining = getTimeUntilReset(item.resetTime);
      timeInterval = setInterval(() => {
        timeRemaining = getTimeUntilReset(item.resetTime);
      }, 60000);
    }
  });

  onDestroy(() => {
    if (timeInterval) {
      clearInterval(timeInterval);
    }
  });

  function toggleSectionExpanded() {
    if (item.isSection) {
      todoStore.toggleSectionExpanded(item.id);
    }
  }

  function toggleStatus() {
    if (!item.isSection) {
      const newStatus = item.status === 'completed' ? 'pending' : 'completed';
      todoStore.updateTodoStatus(projectId, item.id, newStatus);
    }
  }

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function formatResetTime(resetTime: typeof item.resetTime): string {
    if (resetTime.type === 'daily') {
      return `Daily at ${resetTime.time}`;
    }
    const dayName = WEEKDAYS[resetTime.weekday || 0];
    return `Weekly ${dayName} at ${resetTime.time}`;
  }

  function parseTimeString(timeStr: string): [number, number] {
    return timeStr.split(':').map(Number) as [number, number];
  }

  function calculateNextDailyReset(now: Date, hours: number, minutes: number): Date {
    const nextReset = new Date(now);
    nextReset.setHours(hours, minutes, 0, 0);
    
    if (now >= nextReset) {
      nextReset.setDate(nextReset.getDate() + 1);
    }
    
    return nextReset;
  }

  function calculateNextWeeklyReset(now: Date, hours: number, minutes: number, targetDay: number): Date {
    const nextReset = new Date(now);
    const currentDay = now.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    
    nextReset.setDate(nextReset.getDate() + daysUntilTarget);
    nextReset.setHours(hours, minutes, 0, 0);
    
    if (daysUntilTarget === 0 && now >= nextReset) {
      nextReset.setDate(nextReset.getDate() + 7);
    }
    
    return nextReset;
  }

  function formatTimeDifference(timeDiff: number): string {
    if (timeDiff <= 0) return 'Reset now';
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }

  function getTimeUntilReset(resetTime: typeof item.resetTime): string {
    const now = new Date();
    const [hours, minutes] = parseTimeString(resetTime.time);
    
    let nextReset: Date;
    if (resetTime.type === 'daily') {
      nextReset = calculateNextDailyReset(now, hours, minutes);
    } else {
      nextReset = calculateNextWeeklyReset(now, hours, minutes, resetTime.weekday || 0);
    }

    const timeDiff = nextReset.getTime() - now.getTime();
    return formatTimeDifference(timeDiff);
  }
</script>

<div class="space-y-1" style="margin-left: {depth * 0.75}rem">
  <div class={containerClasses}>
    {#if item.isSection}
      <!-- Section header -->
      <button
        on:click={toggleSectionExpanded}
        class="flex items-center gap-3 flex-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-2 -m-2 transition-colors"
      >
        <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 transform transition-transform {sectionExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900 dark:text-white text-base">{item.name}</h4>
          {#if item.description}
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
          {/if}
        </div>
      </button>
    {:else}
      <!-- Todo item -->
      <button
        on:click={toggleStatus}
        class={checkboxClasses}
      >
        {#if item.status === 'completed'}
          <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        {/if}
      </button>
      
      <div class="flex-1">
        <div class="flex items-center justify-between gap-3">
          <h4 class={titleClasses}>
            {item.name}
          </h4>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">
            {formatResetTime(item.resetTime)}
          </span>
        </div>
        <div class="flex items-center justify-between gap-3 mt-1">
          {#if item.description}
            <p class={descriptionClasses}>
              {item.description}
            </p>
          {:else}
            <div></div>
          {/if}
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex-shrink-0">
            {timeRemaining}
          </span>
        </div>
      </div>
    {/if}
  </div>

  <!-- Render child items -->
  {#if !item.isSection || sectionExpanded}
    {#each childItems as childItem (childItem.id)}
      <svelte:self 
        item={childItem} 
        {projectId} 
        {allItems} 
        depth={depth + 1}
      />
    {/each}
  {/if}
</div>