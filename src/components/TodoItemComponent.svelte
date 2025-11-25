<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { todoStore } from '../stores';
  import type { TodoItem } from '../types';

  export let item: TodoItem;
  export let projectId: string;
  export let allItems: TodoItem[];
  export let depth: number = 0;

  let sectionExpanded = true;
  let timeRemaining = '';
  let timeInterval: NodeJS.Timeout;

  $: childItems = allItems.filter(child => child.parentId === item.id);
  $: indentClass = `ml-${depth * 4}`;
  
  onMount(() => {
    if (!item.isSection) {
      timeRemaining = getTimeUntilReset(item.resetTime);
      // Update time remaining every minute
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
    sectionExpanded = !sectionExpanded;
  }

  function toggleStatus() {
    if (!item.isSection) {
      const newStatus = item.status === 'completed' ? 'pending' : 'completed';
      todoStore.updateTodoStatus(projectId, item.id, newStatus);
    }
  }

  function formatResetTime(resetTime: typeof item.resetTime): string {
    if (resetTime.type === 'daily') {
      return `Daily at ${resetTime.time}`;
    } else {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[resetTime.weekday || 0];
      return `Weekly ${dayName} at ${resetTime.time}`;
    }
  }

  function getTimeUntilReset(resetTime: typeof item.resetTime): string {
    const now = new Date();
    let nextReset: Date;

    if (resetTime.type === 'daily') {
      const [hours, minutes] = resetTime.time.split(':').map(Number);
      nextReset = new Date(now);
      nextReset.setHours(hours, minutes, 0, 0);
      
      // If reset time has passed today, move to tomorrow
      if (now >= nextReset) {
        nextReset.setDate(nextReset.getDate() + 1);
      }
    } else {
      const [hours, minutes] = resetTime.time.split(':').map(Number);
      const targetDay = resetTime.weekday || 0;
      nextReset = new Date(now);
      
      // Calculate days until target weekday
      const currentDay = now.getDay();
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;
      
      nextReset.setDate(nextReset.getDate() + daysUntilTarget);
      nextReset.setHours(hours, minutes, 0, 0);
      
      // If it's the same day but time has passed, move to next week
      if (daysUntilTarget === 0 && now >= nextReset) {
        nextReset.setDate(nextReset.getDate() + 7);
      }
    }

    const timeDiff = nextReset.getTime() - now.getTime();
    
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
</script>

<div class="space-y-1" style="margin-left: {depth * 1.5}rem">
  <div 
    class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    class:opacity-60={item.status === 'completed' && !item.isSection}
  >
    {#if item.isSection}
      <!-- Section header -->
      <button
        on:click={toggleSectionExpanded}
        class="flex items-center gap-2 flex-1 text-left hover:bg-gray-200 dark:hover:bg-gray-600 rounded p-1 -m-1 transition-colors"
      >
        <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 transform transition-transform {sectionExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        </svg>
        <div class="flex-1">
          <h4 class="font-medium text-gray-900 dark:text-white">{item.name}</h4>
          {#if item.description}
            <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.description}</p>
          {/if}
        </div>
      </button>
    {:else}
      <!-- Todo item -->
      <button
        on:click={toggleStatus}
        class="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-all duration-200"
        class:bg-indigo-600={item.status === 'completed'}
        class:border-indigo-600={item.status === 'completed'}
        class:dark:border-indigo-500={item.status === 'completed'}
        class:dark:bg-indigo-500={item.status === 'completed'}
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