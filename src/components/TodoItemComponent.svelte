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
  <div 
    class="flex items-center gap-3 p-3 rounded-lg transition-colors"
    class:"bg-white dark:bg-gray-800 border-l-4 border-l-indigo-500 shadow-sm"={item.isSection}
    class:"bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"={!item.isSection}
    class:opacity-60={item.status === 'completed' && !item.isSection}
  >
    {#if item.isSection}
      <!-- Section header -->
      <button
        on:click={toggleSectionExpanded}
        class="flex items-center gap-3 flex-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-2 -m-2 transition-colors"
      >
        <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 transform transition-transform {sectionExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <div class="w-2 h-8 bg-indigo-500 rounded-full flex-shrink-0"></div>
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
        class="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-all duration-200 hover:border-indigo-400"
        class:bg-indigo-500={item.status === 'completed'}
        class:border-indigo-500={item.status === 'completed'}
        class:dark:border-indigo-400={item.status === 'completed'}
        class:dark:bg-indigo-400={item.status === 'completed'}
      >
        {#if item.status === 'completed'}
          <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        {/if}
      </button>
      
      <div class="flex-1">
        <div class="flex items-start justify-between">
          <h4 
            class="font-medium transition-colors"
            class:text-gray-900={item.status === 'pending'}
            class:dark:text-white={item.status === 'pending'}
            class:text-gray-500={item.status === 'completed'}
            class:dark:text-gray-400={item.status === 'completed'}
            class:line-through={item.status === 'completed'}
          >
            {item.name}
          </h4>
          <div class="text-right ml-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {formatResetTime(item.resetTime)}
            </div>
            <div class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              {timeRemaining}
            </div>
          </div>
        </div>
        {#if item.description}
          <p 
            class="text-sm mt-1 transition-colors"
            class:text-gray-600={item.status === 'pending'}
            class:dark:text-gray-300={item.status === 'pending'}
            class:text-gray-400={item.status === 'completed'}
            class:dark:text-gray-500={item.status === 'completed'}
          >
            {item.description}
          </p>
        {/if}
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